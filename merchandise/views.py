from django.shortcuts import render, get_object_or_404, redirect
from django.views.decorators.http import require_POST
from django.core.paginator import Paginator
from django.db.models import Q
from .models import Product
from . import cart as cart_utils




def merchandise_view(request):
    q = (request.GET.get("q") or "").strip()
    category = (request.GET.get("category") or "").strip()

    products = Product.objects.filter(is_active=True)

    if q:
        products = products.filter(Q(name__icontains=q) | Q(description__icontains=q))


    # Validate category strictly against choices to avoid unexpected values
    if category in {c.value for c in Product.Category}:
        products = products.filter(category=category)
    elif category:
        # Unknown category supplied -> ignore rather than error
        category = "" # reset for template state


    products = products.order_by("name")


    paginator = Paginator(products, 12) # 12 items per page
    page_number = request.GET.get("page")
    page_obj = paginator.get_page(page_number)


    context = {
        "page_obj": page_obj,
        "query": q,
        "current_category": category,
        "categories": Product.Category.choices,
    }
    return render(request, "merchandise/merchandise.html", context)




@require_POST
def add_to_cart(request, product_id: int):
    product = get_object_or_404(Product, id=product_id, is_active=True)
    # Qty comes from POST but we never trust price/anything else from client
    try:
        qty = int(request.POST.get("quantity", 1))
    except (TypeError, ValueError):
        qty = 1
    cart_utils.add_item(request, product.id, qty)
    return redirect("merchandise:cart")




@require_POST
def update_cart(request, product_id: int):
    # Update quantity for a specific product
    get_object_or_404(Product, id=product_id) # ensure product exists
    try:
        qty = int(request.POST.get("quantity", 1))
    except (TypeError, ValueError):
        qty = 1
    cart_utils.set_quantity(request, product_id, qty)
    return redirect("merchandise:cart")




@require_POST
def remove_from_cart(request, product_id: int):
    cart_utils.remove_item(request, product_id)
    return redirect("merchandise:cart")




def cart_detail(request):
    # Build list of products currently in cart
    ids = [int(pid) for pid in request.session.get(cart_utils.CART_SESSION_KEY, {}).keys()]
    products = Product.objects.filter(id__in=ids, is_active=True)
    items, total = cart_utils.as_items(request.session, products)
    return render(request, "merchandise/cart.html", {"items": items, "total": total})
    return render(request, "merchandise/checkout.html", {"items": items, "total": total})

def checkout(request):
    # Placeholder. Stripe (test mode) integration comes next.
    ids = [int(pid) for pid in request.session.get(cart_utils.CART_SESSION_KEY, {}).keys()]
    products = Product.objects.filter(id__in=ids, is_active=True)
    items, total = cart_utils.as_items(request.session, products)
    return render(request, "checkouts/checkout.html", {"items": items, "total": total})
