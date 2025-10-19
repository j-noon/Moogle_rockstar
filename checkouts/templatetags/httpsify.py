from django import template

register = template.Library()


@register.filter
def to_https(url: str) -> str:
    if not isinstance(url, str) or not url:
        return url
    if url.startswith("http://"):
        return "https://" + url[len("http://"):]
    return url
