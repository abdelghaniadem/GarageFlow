"""Exceptions personnalisées pour l'API GarageFlow.

Fournit des exceptions typées mappées directement sur les codes HTTP correspondants.
"""


class APIError(Exception):
    """Exception de base pour les erreurs applicatives GarageFlow."""

    def __init__(self, code, message, status_code=400, details=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


class AuthenticationError(APIError):
    """Erreur d'authentification (401 Unauthorized)."""

    def __init__(self, message="Identifiants invalides.", details=None):
        super().__init__(
            code="AUTHENTICATION_FAILED",
            message=message,
            status_code=401,
            details=details,
        )


class ForbiddenError(APIError):
    """Erreur d'autorisation (403 Forbidden)."""

    def __init__(self, message="Accès non autorisé pour ce profil.", details=None):
        super().__init__(
            code="FORBIDDEN",
            message=message,
            status_code=403,
            details=details,
        )


class NotFoundError(APIError):
    """Ressource introuvable (404 Not Found)."""

    def __init__(self, message="Ressource demandée introuvable.", details=None):
        super().__init__(
            code="NOT_FOUND",
            message=message,
            status_code=404,
            details=details,
        )


class ConflictError(APIError):
    """Conflit ou violation de contrainte d'intégrité (409 Conflict)."""

    def __init__(self, message="Conflit avec l'état actuel de la ressource.", details=None):
        super().__init__(
            code="CONFLICT",
            message=message,
            status_code=409,
            details=details,
        )


class ValidationError(APIError):
    """Erreur de validation de schéma ou de données en entrée (422 Unprocessable Entity)."""

    def __init__(self, message="Données de requête invalides.", details=None):
        super().__init__(
            code="VALIDATION_ERROR",
            message=message,
            status_code=422,
            details=details,
        )
