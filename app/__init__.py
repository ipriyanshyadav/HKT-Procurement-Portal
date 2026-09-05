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
except ImportError:
    pass

