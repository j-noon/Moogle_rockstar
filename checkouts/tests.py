import io
import json
import os
import tempfile
from decimal import Decimal
from unittest.mock import Mock, patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from merchandise.models import Product
from .forms import CheckoutForm
from .models import Order, OrderItem

User = get_user_model()


def _ensure_profile(user, moogles=0):
    """
    Your project uses request.user.profile.moogles.
    We try to create the profile object if the Profile model exists.
    If it already exists, just update moogles.
    """
    # If profile already exists, just update
    try:
        prof = user.profile
        prof.moogles = moogles
        prof.save()
        return prof
    except Exception:
        pass

    # Try common profile model locations
    candidate_paths = [
        ("core.models", "Profile"),
        ("profiles.models", "Profile"),
        ("accounts.models", "Profile"),
        ("users.models", "Profile"),
    ]

    for module_path, model_name in candidate_paths:
        try:
            mod = __import__(module_path, fromlist=[model_name])
            Profile = getattr(mod, model_name)
            prof = Profile.objects.create(user=user, moogles=moogles)
            return prof
        except Exception:
            continue

    # If we can't find a Profile model, we raise a helpful error.
    raise RuntimeError(
        "Could not locate a Profile model to create user.profile. "
        "Tell me where your Profile model lives (e.g., core/models.py) and I’ll wire it up."
    )


class OrderModelsTests(TestCase):
    def test_order_str(self):
        u = User.objects.create_user(username="u1", password="pass12345", email="u1@example.com")
        o = Order.objects.create(
            user=u,
            first_name="A",
            last_name="B",
            email="u1@example.com",
            phone="",
            address="",
            subtotal=Decimal("1.00"),
            total=Decimal("1.10"),
            status="paid",
        )
        self.assertIn("Order #", str(o))
        self.assertIn("u1@example.com", str(o))
        self.assertIn("paid", str(o))

    def test_orderitem_line_total(self):
        u = User.objects.create_user(username="u2", password="pass12345", email="u2@example.com")
        o = Order.objects.create(
            user=u,
            first_name="A",
            last_name="B",
            email="u2@example.com",
            phone="",
            address="",
            subtotal=Decimal("0.00"),
            total=Decimal("0.00"),
        )
        item = OrderItem.objects.create(
            order=o,
            product_id=1,
            product_name="Test Product",
            quantity=3,
            unit_price=Decimal("2.50"),
            image_url="",
        )
        self.assertEqual(item.line_total, Decimal("7.50"))


class CheckoutFormTests(TestCase):
    def test_checkout_form_save_combines_address_and_sets_pending(self):
        u = User.objects.create_user(username="formuser", password="pass12345", email="f@example.com")

        form = CheckoutForm(
            data={
                "first_name": "Jane",
                "last_name": "Noon",
                "email": "f@example.com",
                "phone": "",
                "house_number": "10",
                "street_name": "High Street",
                "city": "London",
                "postcode": "E1 1AA",
                "country": "United Kingdom",
                "moogles_to_spend": 0,
            }
        )
        self.assertTrue(form.is_valid())
        order = form.save(user=u, subtotal=Decimal("10.00"), total=Decimal("11.00"))

        self.assertEqual(order.user, u)
        self.assertEqual(order.subtotal, Decimal("10.00"))
        self.assertEqual(order.total, Decimal("11.00"))
        self.assertEqual(order.status, "pending")
        self.assertIn("10, High Street, London, E1 1AA, United Kingdom", order.address)


class CheckoutPageTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="buyer",
            password="pass12345",
            email="buyer@example.com",
            first_name="Buy",
            last_name="Er",
        )
        _ensure_profile(self.user, moogles=5000)
        self.client.login(username="buyer", password="pass12345")

        self.p1 = Product.objects.create(
            name="Emote Pack",
            description="Emotes",
            category=Product.Category.EMOTES,
            price=Decimal("2.50"),
            image_url="https://example.com/img.png",
            is_active=True,
        )
        self.p2 = Product.objects.create(
            name="Poster",
            description="Poster",
            category=Product.Category.POSTERS,
            price=Decimal("10.00"),
            image_url="https://example.com/img.png",
            is_active=True,
        )

        # Put items in session cart
        session = self.client.session
        session["cart"] = {str(self.p1.id): 2, str(self.p2.id): 1}  # 2*2.50 + 1*10.00 = 15.00
        session.save()

    @patch("checkouts.views.stripe.PaymentIntent.create")
    def test_checkout_page_loads_and_creates_payment_intent(self, mock_pi_create):
        mock_pi_create.return_value = Mock(client_secret="cs_test_123")

        resp = self.client.get(reverse("checkouts:checkout"))
        self.assertEqual(resp.status_code, 200)

        # Subtotal 15.00, tax 10% => 1.50, total => 16.50
        self.assertEqual(resp.context["subtotal"], Decimal("15.00"))
        self.assertEqual(resp.context["tax"], Decimal("1.50"))
        self.assertEqual(resp.context["total"], Decimal("16.50"))
        self.assertEqual(resp.context["final_total"], Decimal("16.50"))
        self.assertEqual(resp.context["client_secret"], "cs_test_123")

        # Stripe amount should be final_total * 100 (pence)
        _, kwargs = mock_pi_create.call_args
        self.assertEqual(kwargs["amount"], 1650)
        self.assertEqual(kwargs["currency"], "gbp")

        metadata = kwargs["metadata"]
        self.assertEqual(metadata["user_id"], str(self.user.id))
        self.assertEqual(json.loads(metadata["cart"]), {str(self.p1.id): 2, str(self.p2.id): 1})

    @patch("checkouts.views.stripe.PaymentIntent.create")
    def test_apply_moogles_updates_session_and_reduces_amount(self, mock_pi_create):
        mock_pi_create.return_value = Mock(client_secret="cs_test_456")

        # Total is 16.50 => max moogles by total is 16.50 * 1000 = 16500
        # User has 5000 moogles, request to spend 4000 => discount 4.00, final_total 12.50
        resp = self.client.post(
            reverse("checkouts:checkout"),
            data={"apply_moogles": "1", "moogles_to_spend": "4000"},
            follow=True,
        )
        self.assertEqual(resp.status_code, 200)

        session = self.client.session
        self.assertEqual(session.get("checkout_moogles_spent"), 4000)

        self.assertEqual(resp.context["discount"], Decimal("4.00"))
        self.assertEqual(resp.context["final_total"], Decimal("12.50"))

        _, kwargs = mock_pi_create.call_args
        self.assertEqual(kwargs["amount"], 1250)  # £12.50 -> 1250p
        self.assertEqual(kwargs["metadata"]["moogles_spent"], "4000")

    @patch("checkouts.views.stripe.PaymentIntent.create")
    def test_apply_moogles_capped_by_balance_and_total(self, mock_pi_create):
        mock_pi_create.return_value = Mock(client_secret="cs_test_789")

        # Request huge moogles; should cap to user's 5000 (and also <= total*1000)
        resp = self.client.post(
            reverse("checkouts:checkout"),
            data={"apply_moogles": "1", "moogles_to_spend": "999999"},
            follow=True,
        )
        self.assertEqual(resp.status_code, 200)

        session = self.client.session
        self.assertEqual(session.get("checkout_moogles_spent"), 5000)
        self.assertEqual(resp.context["discount"], Decimal("5.00"))  # 5000 moogles => £5.00

        _, kwargs = mock_pi_create.call_args
        # Total 16.50 - 5.00 = 11.50 => 1150p
        self.assertEqual(kwargs["amount"], 1150)


class SuccessAndHistoryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="hist", password="pass12345", email="hist@example.com")
        _ensure_profile(self.user, moogles=100)
        self.client.login(username="hist", password="pass12345")

    def test_success_page_clears_cart_and_moogles_session(self):
        session = self.client.session
        session["cart"] = {"1": 1}
        session["checkout_moogles_spent"] = 1234
        session.save()

        resp = self.client.get(reverse("checkouts:success"))
        self.assertEqual(resp.status_code, 200)

        session = self.client.session
        self.assertNotIn("cart", session)
        self.assertNotIn("checkout_moogles_spent", session)

    def test_order_history_requires_login(self):
        self.client.logout()
        resp = self.client.get(reverse("checkouts:history"))
        self.assertIn(resp.status_code, (302, 301))

    def test_order_history_lists_users_orders(self):
        Order.objects.create(
            user=self.user,
            first_name="A",
            last_name="B",
            email="hist@example.com",
            phone="",
            address="",
            subtotal=Decimal("1.00"),
            total=Decimal("1.10"),
            status="paid",
        )
        resp = self.client.get(reverse("checkouts:history"))
        self.assertEqual(resp.status_code, 200)
        orders = resp.context["orders"]
        self.assertEqual(orders.count(), 1)
        self.assertEqual(orders.first().user, self.user)


class StripeWebhookShopOrderTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="webhookbuyer",
            password="pass12345",
            email="webhook@example.com",
            first_name="Web",
            last_name="Hook",
        )
        _ensure_profile(self.user, moogles=8000)

        self.p = Product.objects.create(
            name="Emote Pack",
            description="Emotes",
            category=Product.Category.EMOTES,
            price=Decimal("2.50"),
            image_url="https://example.com/img.png",
            is_active=True,
        )

    @patch("checkouts.views.send_mail")
    @patch("checkouts.views.render_to_string", return_value="thanks")
    @patch("checkouts.views.stripe.Webhook.construct_event")
    def test_payment_intent_succeeded_creates_paid_order_items_and_deducts_moogles(
        self, mock_construct, mock_render, mock_send
    ):
        from checkouts.views import stripe_webhook  # import here to avoid circulars

        cart = {str(self.p.id): 2}  # 2*2.50 = 5.00
        event = {
            "type": "payment_intent.succeeded",
            "data": {
                "object": {
                    "id": "pi_123",
                    "metadata": {
                        "user_id": str(self.user.id),
                        "cart": json.dumps(cart),
                        "subtotal": "5.00",
                        "total": "5.50",
                        "first_name": "Web",
                        "last_name": "Hook",
                        "email": "webhook@example.com",
                        "moogles_spent": "3000",
                        "gross_total_before_moogles": "5.50",
                        "moogles_discount": "3.00",
                    },
                }
            },
        }
        mock_construct.return_value = event

        resp = self.client.post(
            reverse("checkouts:stripe_webhook"),
            data=b"{}",
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="testsig",
        )
        self.assertEqual(resp.status_code, 200)

        order = Order.objects.get(stripe_payment_intent="pi_123")
        self.assertEqual(order.status, "paid")
        self.assertEqual(order.user, self.user)
        self.assertEqual(order.subtotal, Decimal("5.00"))
        self.assertEqual(order.total, Decimal("5.50"))
        self.assertEqual(order.moogles_spent, 3000)

        items = order.items.all()
        self.assertEqual(items.count(), 1)
        self.assertEqual(items.first().product_id, self.p.id)
        self.assertEqual(items.first().quantity, 2)

        # Moogles deducted
        self.user.profile.refresh_from_db()
        self.assertEqual(int(self.user.profile.moogles), 5000)

        # Email attempted (mocked)
        self.assertTrue(mock_send.called)

    @patch("checkouts.views.stripe.Webhook.construct_event")
    def test_webhook_duplicate_payment_intent_is_ignored(self, mock_construct):
        from checkouts.views import stripe_webhook

        Order.objects.create(
            user=self.user,
            first_name="Web",
            last_name="Hook",
            email="webhook@example.com",
            phone="",
            address="",
            subtotal=Decimal("0.00"),
            total=Decimal("0.00"),
            stripe_payment_intent="pi_DUP",
            status="paid",
        )

        event = {
            "type": "payment_intent.succeeded",
            "data": {"object": {"id": "pi_DUP", "metadata": {"user_id": str(self.user.id)}}},
        }
        mock_construct.return_value = event

        resp = self.client.post(
            reverse("checkouts:stripe_webhook"),
            data=b"{}",
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="testsig",
        )
        self.assertEqual(resp.status_code, 200)

        # Still only one order with that payment intent
        self.assertEqual(Order.objects.filter(stripe_payment_intent="pi_DUP").count(), 1)


@override_settings(MEDIA_ROOT=tempfile.gettempdir())
class DownloadAssetTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pass12345", email="o@example.com")
        _ensure_profile(self.owner, moogles=0)

        self.other = User.objects.create_user(username="other", password="pass12345", email="x@example.com")
        _ensure_profile(self.other, moogles=0)

        self.order_paid = Order.objects.create(
            user=self.owner,
            first_name="A",
            last_name="B",
            email="o@example.com",
            phone="",
            address="",
            subtotal=Decimal("1.00"),
            total=Decimal("1.10"),
            status="paid",
        )

        self.order_unpaid = Order.objects.create(
            user=self.owner,
            first_name="A",
            last_name="B",
            email="o@example.com",
            phone="",
            address="",
            subtotal=Decimal("1.00"),
            total=Decimal("1.10"),
            status="pending",
        )

    def test_download_forbidden_if_not_owner(self):
        item = OrderItem.objects.create(
            order=self.order_paid,
            product_id=1,
            product_name="P",
            quantity=1,
            unit_price=Decimal("1.00"),
            image_url="https://example.com/a.png",
        )

        self.client.login(username="other", password="pass12345")
        resp = self.client.get(reverse("checkouts:download_asset", args=[item.id]))
        self.assertEqual(resp.status_code, 403)

    def test_download_forbidden_if_not_paid(self):
        item = OrderItem.objects.create(
            order=self.order_unpaid,
            product_id=1,
            product_name="P",
            quantity=1,
            unit_price=Decimal("1.00"),
            image_url="https://example.com/a.png",
        )

        self.client.login(username="owner", password="pass12345")
        resp = self.client.get(reverse("checkouts:download_asset", args=[item.id]))
        self.assertEqual(resp.status_code, 403)

    def test_download_serves_asset_file_when_present(self):
        # Create a temp file and attach via FileField
        upload = SimpleUploadedFile("test.txt", b"hello world", content_type="text/plain")
        item = OrderItem.objects.create(
            order=self.order_paid,
            product_id=1,
            product_name="P",
            quantity=1,
            unit_price=Decimal("1.00"),
            image_url="",
            asset_file=upload,
        )

        self.client.login(username="owner", password="pass12345")
        resp = self.client.get(reverse("checkouts:download_asset", args=[item.id]))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.has_header("Content-Disposition"))

    @patch("checkouts.views.requests.get")
    def test_download_fetches_image_url_and_forces_https(self, mock_get):
        # Mock requests.get returning a stream-like raw body
        raw = io.BytesIO(b"fake-image-bytes")
        mock_resp = Mock()
        mock_resp.raw = raw
        mock_resp.headers = {"Content-Type": "image/png"}
        mock_resp.raise_for_status = Mock()
        mock_get.return_value = mock_resp

        item = OrderItem.objects.create(
            order=self.order_paid,
            product_id=1,
            product_name="P",
            quantity=1,
            unit_price=Decimal("1.00"),
            image_url="http://example.com/myasset.png",
        )

        self.client.login(username="owner", password="pass12345")
        resp = self.client.get(reverse("checkouts:download_asset", args=[item.id]))
        self.assertEqual(resp.status_code, 200)
        self.assertIn("attachment;", resp.get("Content-Disposition", ""))

        # Ensure https was used
        args, kwargs = mock_get.call_args
        self.assertTrue(args[0].startswith("https://"))

    def test_download_returns_404_if_no_asset(self):
        item = OrderItem.objects.create(
            order=self.order_paid,
            product_id=1,
            product_name="P",
            quantity=1,
            unit_price=Decimal("1.00"),
            image_url="",
        )
        self.client.login(username="owner", password="pass12345")
        resp = self.client.get(reverse("checkouts:download_asset", args=[item.id]))
        self.assertEqual(resp.status_code, 404)
