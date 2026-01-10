from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils.http import urlencode

from .models import Product
from . import cart as cart_utils


class ProductModelTests(TestCase):
    def test_slug_is_auto_created_on_save(self):
        p = Product.objects.create(
            name="My Cool Emote Pack",
            description="Test",
            category=Product.Category.EMOTES,
            price=Decimal("3.50"),
            image_url="https://example.com/img.png",
            is_active=True,
        )
        self.assertEqual(p.slug, "my-cool-emote-pack")

    def test_str_representation(self):
        p = Product.objects.create(
            name="Poster A",
            description="Test",
            category=Product.Category.POSTERS,
            price=Decimal("9.99"),
            image_url="https://example.com/img.png",
            is_active=True,
        )
        self.assertIn("Poster A", str(p))
        self.assertIn("9.99", str(p))


class MerchandiseListViewTests(TestCase):
    def setUp(self):
        # 15 active products so we can test pagination (12 per page)
        for i in range(15):
            Product.objects.create(
                name=f"Product {i:02d}",
                description="Generic",
                category=Product.Category.EMOTES,
                price=Decimal("1.00"),
                image_url="https://example.com/img.png",
                is_active=True,
            )

        # Add an inactive product that should never show
        Product.objects.create(
            name="Hidden Product",
            description="Should not show",
            category=Product.Category.EMOTES,
            price=Decimal("1.00"),
            image_url="https://example.com/img.png",
            is_active=False,
        )

    def test_merchandise_page_loads_and_paginates(self):
        url = reverse("merchandise:merchandise")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)

        page_obj = resp.context["page_obj"]
        self.assertEqual(page_obj.paginator.per_page, 12)
        self.assertEqual(page_obj.paginator.num_pages, 2)
        self.assertEqual(len(page_obj.object_list), 12)

        # Page 2 should have remaining 3 items (15 total, 12 on page 1)
        resp2 = self.client.get(url + "?" + urlencode({"page": 2}))
        self.assertEqual(resp2.status_code, 200)
        page_obj2 = resp2.context["page_obj"]
        self.assertEqual(len(page_obj2.object_list), 3)

    def test_search_filters_products_by_name_or_description(self):
        Product.objects.create(
            name="Super Special Banner",
            description="Unique banner",
            category=Product.Category.BANNERS,
            price=Decimal("2.00"),
            image_url="https://example.com/img.png",
            is_active=True,
        )
        url = reverse("merchandise:merchandise")
        resp = self.client.get(url + "?" + urlencode({"q": "Special"}))
        self.assertEqual(resp.status_code, 200)

        names = [p.name for p in resp.context["page_obj"].object_list]
        self.assertIn("Super Special Banner", names)
        self.assertNotIn("Hidden Product", names)

    def test_category_filter_accepts_only_known_categories(self):
        # Add a posters product to confirm filtering works
        Product.objects.create(
            name="Poster Z",
            description="Poster",
            category=Product.Category.POSTERS,
            price=Decimal("5.00"),
            image_url="https://example.com/img.png",
            is_active=True,
        )

        url = reverse("merchandise:merchandise")
        resp = self.client.get(url + "?" + urlencode({"category": Product.Category.POSTERS}))
        self.assertEqual(resp.status_code, 200)

        page_obj = resp.context["page_obj"]
        # All returned products should be posters
        for p in page_obj.object_list:
            self.assertEqual(p.category, Product.Category.POSTERS)

        # Context should reflect chosen category
        self.assertEqual(resp.context["current_category"], Product.Category.POSTERS)

    def test_unknown_category_is_ignored(self):
        url = reverse("merchandise:merchandise")
        resp = self.client.get(url + "?" + urlencode({"category": "not-a-real-category"}))
        self.assertEqual(resp.status_code, 200)
        # Unknown category is reset to ""
        self.assertEqual(resp.context["current_category"], "")


class CartFlowTests(TestCase):
    def setUp(self):
        self.p1 = Product.objects.create(
            name="Emote Pack 1",
            description="Emotes",
            category=Product.Category.EMOTES,
            price=Decimal("2.50"),
            image_url="https://example.com/img.png",
            is_active=True,
        )
        self.p2 = Product.objects.create(
            name="Poster 1",
            description="Poster",
            category=Product.Category.POSTERS,
            price=Decimal("10.00"),
            image_url="https://example.com/img.png",
            is_active=True,
        )
        self.inactive = Product.objects.create(
            name="Inactive Item",
            description="Nope",
            category=Product.Category.POSTERS,
            price=Decimal("1.00"),
            image_url="https://example.com/img.png",
            is_active=False,
        )

    def test_add_to_cart_adds_item_and_redirects_to_cart(self):
        url = reverse("merchandise:add_to_cart", args=[self.p1.id])
        resp = self.client.post(url, data={"quantity": 2})
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp["Location"], reverse("merchandise:cart"))

        # Session should now contain the cart
        session = self.client.session
        self.assertIn(cart_utils.CART_SESSION_KEY, session)
        self.assertEqual(session[cart_utils.CART_SESSION_KEY][str(self.p1.id)], 2)

    def test_add_to_cart_invalid_quantity_defaults_to_1(self):
        url = reverse("merchandise:add_to_cart", args=[self.p1.id])
        resp = self.client.post(url, data={"quantity": "not-an-int"})
        self.assertEqual(resp.status_code, 302)

        session = self.client.session
        self.assertEqual(session[cart_utils.CART_SESSION_KEY][str(self.p1.id)], 1)

    def test_add_to_cart_caps_max_quantity(self):
        url = reverse("merchandise:add_to_cart", args=[self.p1.id])
        resp = self.client.post(url, data={"quantity": 999})
        self.assertEqual(resp.status_code, 302)

        session = self.client.session
        self.assertEqual(
            session[cart_utils.CART_SESSION_KEY][str(self.p1.id)],
            cart_utils.MAX_QTY_PER_ITEM,
        )

    def test_add_to_cart_rejects_inactive_products(self):
        url = reverse("merchandise:add_to_cart", args=[self.inactive.id])
        resp = self.client.post(url, data={"quantity": 1})
        # get_object_or_404 should return 404 for inactive
        self.assertEqual(resp.status_code, 404)

    def test_update_cart_sets_quantity_and_redirects(self):
        # First add something
        self.client.post(reverse("merchandise:add_to_cart", args=[self.p1.id]), data={"quantity": 1})

        # Now update quantity
        resp = self.client.post(reverse("merchandise:update_cart", args=[self.p1.id]), data={"quantity": 5})
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp["Location"], reverse("merchandise:cart"))

        session = self.client.session
        self.assertEqual(session[cart_utils.CART_SESSION_KEY][str(self.p1.id)], 5)

    def test_update_cart_qty_zero_removes_item(self):
        self.client.post(reverse("merchandise:add_to_cart", args=[self.p1.id]), data={"quantity": 1})

        resp = self.client.post(reverse("merchandise:update_cart", args=[self.p1.id]), data={"quantity": 0})
        self.assertEqual(resp.status_code, 302)

        session = self.client.session
        self.assertNotIn(str(self.p1.id), session.get(cart_utils.CART_SESSION_KEY, {}))

    def test_remove_from_cart_removes_item(self):
        self.client.post(reverse("merchandise:add_to_cart", args=[self.p1.id]), data={"quantity": 1})

        resp = self.client.post(reverse("merchandise:remove_from_cart", args=[self.p1.id]))
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp["Location"], reverse("merchandise:cart"))

        session = self.client.session
        self.assertNotIn(str(self.p1.id), session.get(cart_utils.CART_SESSION_KEY, {}))

    def test_cart_detail_renders_items_and_total(self):
        # Add p1 x2 and p2 x1
        self.client.post(reverse("merchandise:add_to_cart", args=[self.p1.id]), data={"quantity": 2})
        self.client.post(reverse("merchandise:add_to_cart", args=[self.p2.id]), data={"quantity": 1})

        resp = self.client.get(reverse("merchandise:cart"))
        self.assertEqual(resp.status_code, 200)

        items = resp.context["items"]
        total = resp.context["total"]

        # Total should be 2*2.50 + 1*10.00 = 15.00
        self.assertEqual(total, Decimal("15.00"))

        # Items include both products
        product_names = [row["product"].name for row in items]
        self.assertIn(self.p1.name, product_names)
        self.assertIn(self.p2.name, product_names)


class CheckoutRedirectTests(TestCase):
    def test_merch_checkout_url_redirects_to_checkouts_app(self):
        # Your merch URLs redirect /checkout/ to the checkouts app.
        resp = self.client.get("/merchandise/checkout/", follow=False)
        # RedirectView should send a 302 by default
        self.assertIn(resp.status_code, (301, 302))
