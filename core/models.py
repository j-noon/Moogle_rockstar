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