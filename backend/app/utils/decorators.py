"""Décorateurs de sécurité et contrôle d'accès par rôle (RBAC).
"""
from functools import wraps
from flask_jwt_extended import get_jwt, verify_jwt_in_request
from app.utils.exceptions import ForbiddenError


def roles_required(*allowed_roles):
    """Vérifie que l'utilisateur authentifié possède l'un des rôles autorisés."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_role = claims.get("role")
            if user_role not in allowed_roles:
                raise ForbiddenError(
                    message=f"Rôle '{user_role}' non autorisé pour cette opération."
                )
            return fn(*args, **kwargs)
        return wrapper
    return decorator
