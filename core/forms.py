from django import forms
from .models import Profile
from .models import Comment

class ProfileImageForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ['profile_image']


class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ['text']
        widgets = {
            'text': forms.Textarea(attrs={
                'placeholder': 'Leave a comment...',
                'rows': 3,
                'class': 'form-control'
            }),
        }

class ResetPasswordForm(forms.Form):
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={'class': 'form-input'}),
        label="New Password"
    )
    confirm_password = forms.CharField(
        widget=forms.PasswordInput(attrs={'class': 'form-input'}),
        label="Confirm Password"
    )

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        confirm_password = cleaned_data.get("confirm_password")

        if password and confirm_password and password != confirm_password:
            raise forms.ValidationError("Passwords do not match.")

        # simple password rules (can expand if you want stricter)
        if password and len(password) < 8:
            raise forms.ValidationError("Password must be at least 8 characters.")

        return cleaned_data