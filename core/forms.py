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