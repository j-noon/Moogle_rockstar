import datetime as py_datetime
from datetime import timedelta  # ✅ needed (you use timedelta in multiple tests)

from django.contrib.auth import get_user_model
from django.contrib.messages import get_messages
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from unittest.mock import patch, Mock

from .models import Subscription
from .utils import user_has_active_subscription
from .webhook_handlers import (
    handle_checkout_completed,
    handle_invoice_succeeded,
    handle_subscription_deleted,
    handle_subscription_updated,
)

User = get_user_model()


class SubscriptionModelTests(TestCase):
    def test_str_representation(self):
        user = User.objects.create_user(username="alice", password="pass12345")
        sub = Subscription.objects.create(user=user, status="inactive")
        self.assertEqual(str(sub), "alice — inactive")


class SubscriptionUtilsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="bob", password="pass12345")

    def test_user_has_active_subscription_false_when_no_subscription(self):
        self.assertFalse(user_has_active_subscription(self.user))

    def test_user_has_active_subscription_false_when_not_active(self):
        Subscription.objects.create(user=self.user, status="inactive")
        self.assertFalse(user_has_active_subscription(self.user))

    def test_user_has_active_subscription_true_when_active_and_no_period_end(self):
        Subscription.objects.create(user=self.user, status="active", current_period_end=None)
        self.assertTrue(user_has_active_subscription(self.user))

    def test_user_has_active_subscription_false_when_active_but_expired(self):
        expired = timezone.now() - timedelta(days=1)
        Subscription.objects.create(user=self.user, status="active", current_period_end=expired)
        self.assertFalse(user_has_active_subscription(self.user))

    def test_user_has_active_subscription_true_when_active_and_future_end(self):
        future = timezone.now() + timedelta(days=5)
        Subscription.objects.create(user=self.user, status="active", current_period_end=future)
        self.assertTrue(user_has_active_subscription(self.user))


class SubscriptionViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="charlie", email="charlie@example.com", password="pass12345"
        )
        self.client.login(username="charlie", password="pass12345")

    def test_manage_subscription_creates_subscription_if_missing(self):
        self.assertFalse(Subscription.objects.filter(user=self.user).exists())
        resp = self.client.get(reverse("subscriptions:manage"))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(Subscription.objects.filter(user=self.user).exists())
        self.assertIn("subscription", resp.context)
        self.assertIn("days_left", resp.context)
        self.assertIn("cancel_at_period_end", resp.context)

    @patch("subscriptions.views.stripe.Subscription.retrieve")
    def test_manage_subscription_refreshes_from_stripe_when_has_stripe_id_and_no_period_end(
        self, mock_retrieve
    ):
        sub = Subscription.objects.create(
            user=self.user,
            stripe_subscription_id="sub_123",
            stripe_customer_id=None,
            status="inactive",
            current_period_end=None,
        )

        future_epoch = int((timezone.now() + timedelta(days=10)).timestamp())
        mock_retrieve.return_value = {
            "status": "active",
            "customer": "cus_999",
            "current_period_end": future_epoch,
            "cancel_at_period_end": False,
        }

        resp = self.client.get(reverse("subscriptions:manage"))
        self.assertEqual(resp.status_code, 200)

        sub.refresh_from_db()
        self.assertEqual(sub.status, "active")
        self.assertEqual(sub.stripe_customer_id, "cus_999")
        self.assertIsNotNone(sub.current_period_end)

    @patch("subscriptions.views.stripe.checkout.Session.create")
    def test_create_subscription_checkout_redirects_to_stripe_session(self, mock_create):
        Subscription.objects.create(user=self.user, status="inactive", stripe_customer_id=None)

        mock_session = Mock()
        mock_session.url = "https://stripe.test/checkout/session/abc"
        mock_create.return_value = mock_session

        resp = self.client.get(reverse("subscriptions:subscribe"))
        self.assertIn(resp.status_code, (302, 303))
        self.assertEqual(resp["Location"], mock_session.url)
        self.assertTrue(mock_create.called)

    def test_create_subscription_checkout_when_already_active_redirects_manage_with_message(self):
        Subscription.objects.create(user=self.user, status="active")
        resp = self.client.get(reverse("subscriptions:subscribe"), follow=True)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.request["PATH_INFO"], reverse("subscriptions:manage"))

        msgs = [m.message for m in get_messages(resp.wsgi_request)]
        self.assertIn("Your subscription is already active.", msgs)

    def test_cancel_subscription_when_no_subscription_shows_error_and_redirects(self):
        resp = self.client.get(reverse("subscriptions:cancel"), follow=True)
        self.assertEqual(resp.status_code, 200)
        msgs = [m.message for m in get_messages(resp.wsgi_request)]
        self.assertIn("No active subscription found to cancel.", msgs)

    @patch("subscriptions.views.stripe.Subscription.modify")
    def test_cancel_subscription_sets_cancel_at_period_end_and_updates_period_end(self, mock_modify):
        Subscription.objects.create(
            user=self.user,
            status="active",
            stripe_subscription_id="sub_456",
        )

        future_epoch = int((timezone.now() + timedelta(days=7)).timestamp())
        mock_modify.return_value = {"current_period_end": future_epoch}

        resp = self.client.get(reverse("subscriptions:cancel"), follow=True)
        self.assertEqual(resp.status_code, 200)

        sub = Subscription.objects.get(user=self.user)
        self.assertIsNotNone(sub.current_period_end)

        msgs = [m.message for m in get_messages(resp.wsgi_request)]
        self.assertTrue(any("Subscription will be canceled at period end" in m for m in msgs))

        mock_modify.assert_called_once_with("sub_456", cancel_at_period_end=True)

    def test_resume_subscription_requires_post(self):
        resp = self.client.get(reverse("subscriptions:resume"))
        self.assertEqual(resp.status_code, 405)

    def test_resume_subscription_when_no_subscription_shows_error(self):
        resp = self.client.post(reverse("subscriptions:resume"), follow=True)
        self.assertEqual(resp.status_code, 200)
        msgs = [m.message for m in get_messages(resp.wsgi_request)]
        self.assertIn("No subscription found to resume.", msgs)

    @patch("subscriptions.views.stripe.Subscription.retrieve")
    def test_resume_subscription_when_already_set_to_renew_shows_info(self, mock_retrieve):
        Subscription.objects.create(
            user=self.user,
            status="active",
            stripe_subscription_id="sub_789",
        )

        mock_retrieve.return_value = {"cancel_at_period_end": False}

        resp = self.client.post(reverse("subscriptions:resume"), follow=True)
        self.assertEqual(resp.status_code, 200)
        msgs = [m.message for m in get_messages(resp.wsgi_request)]
        self.assertIn("Your subscription is already set to renew.", msgs)

    @patch("subscriptions.views.stripe.Subscription.modify")
    @patch("subscriptions.views.stripe.Subscription.retrieve")
    def test_resume_subscription_flips_cancel_at_period_end_false_and_sets_period_end(
        self, mock_retrieve, mock_modify
    ):
        Subscription.objects.create(
            user=self.user,
            status="active",
            stripe_subscription_id="sub_999",
        )

        mock_retrieve.return_value = {"cancel_at_period_end": True}

        future_epoch = int((timezone.now() + timedelta(days=14)).timestamp())
        mock_modify.return_value = {"current_period_end": future_epoch}

        resp = self.client.post(reverse("subscriptions:resume"), follow=True)
        self.assertEqual(resp.status_code, 200)

        sub = Subscription.objects.get(user=self.user)
        self.assertIsNotNone(sub.current_period_end)

        msgs = [m.message for m in get_messages(resp.wsgi_request)]
        self.assertIn("Your subscription will continue after this period.", msgs)

        mock_modify.assert_called_once_with("sub_999", cancel_at_period_end=False)


class SubscriptionWebhookTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="dana", password="pass12345")

    def test_handle_checkout_completed_ignores_non_subscription_mode(self):
        event = {"data": {"object": {"mode": "payment"}}}
        handle_checkout_completed(event)
        self.assertFalse(Subscription.objects.filter(user=self.user).exists())

    def test_handle_checkout_completed_creates_active_subscription(self):
        event = {
            "data": {
                "object": {
                    "mode": "subscription",
                    "client_reference_id": str(self.user.id),
                    "subscription": "sub_AAA",
                    "customer": "cus_AAA",
                    "metadata": {"user_id": str(self.user.id)},
                }
            }
        }
        handle_checkout_completed(event)

        sub = Subscription.objects.get(user=self.user)
        self.assertEqual(sub.status, "active")
        self.assertEqual(sub.stripe_subscription_id, "sub_AAA")
        self.assertEqual(sub.stripe_customer_id, "cus_AAA")

    @patch("subscriptions.webhook_handlers.timezone")
    def test_handle_invoice_succeeded_sets_active_and_period_end(self, mock_tz):
        mock_tz.utc = py_datetime.timezone.utc  # ✅ provide .utc expected by webhook code

        Subscription.objects.create(
            user=self.user,
            stripe_subscription_id="sub_BBB",
            status="past_due",
        )

        end_ts = int((timezone.now() + timedelta(days=30)).timestamp())
        event = {
            "data": {
                "object": {
                    "subscription": "sub_BBB",
                    "lines": {"data": [{"period": {"end": end_ts}}]},
                }
            }
        }

        handle_invoice_succeeded(event)

        sub = Subscription.objects.get(stripe_subscription_id="sub_BBB")
        self.assertEqual(sub.status, "active")
        self.assertIsNotNone(sub.current_period_end)

    @patch("subscriptions.webhook_handlers.timezone")
    def test_handle_subscription_deleted_sets_canceled_and_period_end(self, mock_tz):
        mock_tz.utc = py_datetime.timezone.utc

        Subscription.objects.create(
            user=self.user,
            stripe_subscription_id="sub_CCC",
            status="active",
        )

        end_ts = int((timezone.now() + timedelta(days=5)).timestamp())
        event = {"data": {"object": {"id": "sub_CCC", "current_period_end": end_ts}}}

        handle_subscription_deleted(event)

        sub = Subscription.objects.get(stripe_subscription_id="sub_CCC")
        self.assertEqual(sub.status, "canceled")
        self.assertIsNotNone(sub.current_period_end)

    @patch("subscriptions.webhook_handlers.timezone")
    def test_handle_subscription_updated_maps_status_and_sets_period_end(self, mock_tz):
        mock_tz.utc = py_datetime.timezone.utc

        Subscription.objects.create(
            user=self.user,
            stripe_subscription_id="sub_DDD",
            status="inactive",
        )

        end_ts = int((timezone.now() + timedelta(days=3)).timestamp())
        event = {"data": {"object": {"id": "sub_DDD", "status": "past_due", "current_period_end": end_ts}}}

        handle_subscription_updated(event)

        sub = Subscription.objects.get(stripe_subscription_id="sub_DDD")
        self.assertEqual(sub.status, "past_due")
        self.assertIsNotNone(sub.current_period_end)

    def test_handle_subscription_updated_ignores_unknown_subscription(self):
        end_ts = int((timezone.now() + timedelta(days=3)).timestamp())
        event = {"data": {"object": {"id": "sub_NOPE", "status": "active", "current_period_end": end_ts}}}
        handle_subscription_updated(event)
        self.assertFalse(Subscription.objects.filter(stripe_subscription_id="sub_NOPE").exists())