# checkouts/templatetags/cloudimg.py
from django import template

register = template.Library()


@register.filter
def cld(url: str, transform: str) -> str:
    """
    Insert a Cloudinary transform right after /upload/.
    Example: {{ url|cld:"f_auto,q_auto,w_800,c_limit" }}
    """
    if not isinstance(url, str) or "/upload/" not in url:
        return url
    return url.replace("/upload/", f"/upload/{transform}/", 1)
