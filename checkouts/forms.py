# checkouts/forms.py
from django import forms
from .models import Order

class CheckoutForm(forms.ModelForm):
    # Separate address fields for user input
    house_number = forms.CharField(max_length=50, required=True, label="House Number / Name")
    street_name = forms.CharField(max_length=100, required=True, label="Street Name")
    city = forms.CharField(max_length=100, required=True)
    postcode = forms.CharField(max_length=20, required=True)
    country = forms.CharField(max_length=100, required=True, initial="United Kingdom")

    class Meta:
        model = Order
        fields = ['first_name', 'last_name', 'email', 'phone']

    def save(self, commit=True, user=None, subtotal=None, total=None):
        """
        Override save to combine address fields and set extra fields.
        """
        order = super().save(commit=False)

        # Combine address
        order.address = f"{self.cleaned_data['house_number']}, {self.cleaned_data['street_name']}, " \
                        f"{self.cleaned_data['city']}, {self.cleaned_data['postcode']}, {self.cleaned_data['country']}"

        # Assign user and totals if provided
        if user:
            order.user = user
        if subtotal is not None:
            order.subtotal = subtotal
        if total is not None:
            order.total = total

        order.status = 'pending'  # default

        if commit:
            order.save()
        return order