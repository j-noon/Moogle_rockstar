from django import forms

class CheckoutForm(forms.Form):
    # Personal details
    first_name = forms.CharField(max_length=100, required=True)
    last_name = forms.CharField(max_length=100, required=True)
    email = forms.EmailField(required=True)
    phone = forms.CharField(max_length=20, required=False)
    
    # Address fields - now separated
    house_number = forms.CharField(max_length=50, required=True, label="House Number/Name")
    street_name = forms.CharField(max_length=100, required=True, label="Street Name")
    city = forms.CharField(max_length=100, required=True)
    postcode = forms.CharField(max_length=20, required=True)
    country = forms.CharField(max_length=100, required=True, initial="United Kingdom")