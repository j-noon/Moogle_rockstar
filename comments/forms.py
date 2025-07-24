from django import forms
from .models import Comment

class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ['text']
        widgets = {
            'text': forms.Textarea(attrs={
                'placeholder': 'Leave a comment here...',
                'rows': 3,
                'style': 'width: 96%; padding: 10px; border: 2px solid black; border-radius: 8px;'
            })
        }