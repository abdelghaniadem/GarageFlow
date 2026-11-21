"""Module de standardisation des réponses HTTP de l'API GarageFlow.

Garantit un format JSON cohérent sur l'ensemble des endpoints :
- Succès : {"success": true, "data": ..., "message": ...}
- Erreur : {"success": false, "error": {"code": ..., "message": ..., "details": ...}}
"""
from flask import jsonify


def success_response(data=None, message=None, status_code=200):
    """Génère une réponse JSON de succès standardisée."""
    payload = {"success": True}
    if data is not None:
        payload["data"] = data
    if message is not None:
        payload["message"] = message
    return jsonify(payload), status_code


def error_response(code, message, status_code=400, details=None):
    """Génère une réponse JSON d'erreur standardisée."""
    error_payload = {
        "code": code,
        "message": message,
    }
    if details is not None:
        error_payload["details"] = details

    return jsonify({
        "success": False,
        "error": error_payload,
    }), status_code
