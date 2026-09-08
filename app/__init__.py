"""
Procurement Portal Application Package.
"""

# Compatibility fix for passlib with bcrypt >= 4.1.0
try:
    import bcrypt
    if not hasattr(bcrypt, "__about__"):
        class _About:
            __version__ = getattr(bcrypt, "__version__", "4.0.0")
        bcrypt.__about__ = _About()
    
    if hasattr(bcrypt, "hashpw"):
        _orig_hashpw = bcrypt.hashpw
        def _safe_hashpw(password, salt):
            try:
                return _orig_hashpw(password, salt)
            except ValueError as e:
                if "72 bytes" in str(e):
                    return _orig_hashpw(password[:72], salt)
                raise
        bcrypt.hashpw = _safe_hashpw
except ImportError:
    pass

