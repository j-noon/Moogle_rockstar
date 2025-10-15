from django import forms
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from PIL import Image

from .models import Profile, Comment


ALLOWED_EXTS = ["jpg", "jpeg", "png"]
ALLOWED_MIME = {"image/jpeg", "image/png"}


class ProfileImageForm(forms.ModelForm):
    # enforce extension at the field level
    profile_image = forms.ImageField(
        required=True,
        validators=[FileExtensionValidator(allowed_extensions=ALLOWED_EXTS)],
        error_messages={
            "invalid_extension": "Error: wrong file type. Please upload a JPEG or PNG."
        },
    )

    class Meta:
        model = Profile
        fields = ["profile_image"]

    def clean_profile_image(self):
        f = self.cleaned_data.get("profile_image")
        if not f:
            return f

        content_type = getattr(f, "content_type", "")
        if content_type not in ALLOWED_MIME:
            raise ValidationError("Error: wrong file type. Please upload a JPEG or PNG.")
        try:
            img = Image.open(f)
            img.verify()  # light integrity check
        except Exception:
            raise ValidationError("Error: file is not a valid image. Please upload a JPEG or PNG.")
        max_bytes = 5 * 1024 * 1024
        if f.size and f.size > max_bytes:
            raise ValidationError("Please upload an image under 5 MB.")
        try:
            f.seek(0)
        except Exception:
            pass

        return f


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
