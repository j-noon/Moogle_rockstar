from django.db import models
from django.contrib.auth.models import User

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    moogles = models.IntegerField(default=0)
    profile_image = models.ImageField(
        upload_to='profile_images/',
        default='profile_images/default_profile.jpg'
    )

    def __str__(self):
        return f"{self.user.username}'s Profile"
    

class Comment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username}: {self.text[:50]}"