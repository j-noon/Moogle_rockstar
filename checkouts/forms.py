# checkouts/forms.py
from django import forms
from .models import Order


class CheckoutForm(forms.ModelForm):
    house_number = forms.CharField(max_length=50, required=False, label="House Number / Name")
    street_name = forms.CharField(max_length=100, required=False, label="Street Name")
    city = forms.CharField(max_length=100, required=False)
    postcode = forms.CharField(max_length=20, required=False)
    country = forms.CharField(max_length=100, required=False, initial="United Kingdom")

    moogles_to_spend = forms.IntegerField(
        required=False,
        min_value=0,
        label="Spend moogles",
        help_text="1000 moogles = £1 discount"
    )

    class Meta:
        model = Order
        fields = ['first_name', 'last_name', 'email', 'phone']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['phone'].required = False

    def save(self, commit=True, user=None, subtotal=None, total=None):
        """
        Override save to combine address fields and set extra fields.
        """
        order = super().save(commit=False)

        # Combine address
        order.address = f"{self.cleaned_data['house_number']}, {self.cleaned_data['street_name']}, " \
                        f"{self.cleaned_data['city']}, {self.cleaned_data['postcode']}, {self.cleaned_data['country']}"


        if user:
            order.user = user
        if subtotal is not None:
            order.subtotal = subtotal
        if total is not None:
            order.total = total

        order.status = 'pending'

        if commit:
            order.save()
        return order
