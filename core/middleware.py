# core/middleware.py
from django.utils.deprecation import MiddlewareMixin
import os, base64

class HttpsRewriteMiddleware(MiddlewareMixin):
    """Rewrite http://res.cloudinary.com → https:// in HTML responses."""
    def process_response(self, request, response):
        ctype = response.get('Content-Type', '')
        if response.status_code == 200 and 'text/html' in ctype and hasattr(response, 'content'):
            try:
                body = response.content.decode(response.charset or 'utf-8')
                if 'http://res.cloudinary.com' in body:
                    body = body.replace('http://res.cloudinary.com', 'https://res.cloudinary.com')
                    response.content = body.encode(response.charset or 'utf-8')
                    if 'Content-Length' in response:
                        response['Content-Length'] = str(len(response.content))
            except Exception:
                pass
        return response

def _nonce(nbytes=16):
    return base64.b64encode(os.urandom(nbytes)).decode('ascii')

class CspNonceMiddleware(MiddlewareMixin):
    """Add request.csp_nonce and set a baseline CSP header using that nonce."""
    def process_request(self, request):
        request.csp_nonce = _nonce()

    def process_response(self, request, response):
        nonce = getattr(request, "csp_nonce", _nonce())
        csp = [
            "default-src 'self'",
            f"script-src 'self' 'nonce-{nonce}'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' https://res.cloudinary.com data:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "media-src 'self' https://res.cloudinary.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ]
        response["Content-Security-Policy"] = "; ".join(csp)
        # Optional: telemetry for Trusted Types (report-only)
        response["Content-Security-Policy-Report-Only"] = "require-trusted-types-for 'script';"
        return response
