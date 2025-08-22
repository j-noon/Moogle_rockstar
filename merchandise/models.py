from django.db import models
from django.utils.text import slugify
from decimal import Decimal


# Create your models here.


class Product(models.Model):
    class Category(models.TextChoices):
        EMOTES = "emotes", "Emotes"
        POSTERS = "posters", "Posters"
        CUPS = "cups", "Coffee Cups"
        SHIRTS = "shirts", "T-Shirts"


    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=Category.choices)
    price = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    image_url = models.URLField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


    def __str__(self):
        return f"{self.name} (£{self.price})"