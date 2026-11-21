"""Service d'authentification pour GarageFlow.

Fournit la logique métier d'authentification, la vérification des identifiants
et la génération de jetons d'accès sécurisés (JWT).
"""
from typing import Any, Dict
from flask_jwt_extended import create_access_token
from app.extensions import db
from app.models.utilisateur import Utilisateur
from app.utils.exceptions import AuthenticationError, NotFoundError


def login(email: str, password: str) -> Dict[str, Any]:
    """Authentifie un utilisateur et retourne un jeton JWT avec ses informations publiques.

    Args:
        email: Adresse email saisie par l'utilisateur.
        password: Mot de passe en clair à vérifier.

    Returns:
        Dictionnaire contenant le jeton d'accès (access_token) et les données utilisateur sécurisées.

    Raises:
        AuthenticationError: Si l'email n'existe pas ou si le mot de passe est incorrect.
    """
    # 1 & 2. Normalisation de l'email (minuscules et suppression des espaces superflus)
    normalized_email = email.strip().lower() if isinstance(email, str) else ""

    # 3. Recherche de l'utilisateur par email
    user = Utilisateur.query.filter_by(email=normalized_email).first()

    # 4 & 5. Vérification du mot de passe avec rejet générique sans fuite d'information
    if not user or not user.check_password(password):
        raise AuthenticationError("Identifiants invalides.")

    # 6, 7 & 8. Génération du JWT (identité = id_utilisateur en string, claim additionnel = rôle)
    access_token = create_access_token(
        identity=str(user.id_utilisateur),
        additional_claims={"role": user.role},
    )

    # 9. Retourne le token d'accès et les données utilisateur sécurisées via to_dict()
    return {
        "access_token": access_token,
        "user": user.to_dict(),
    }


# Alias de commodité
login_user = login


def get_current_user_profile(user_identity: Any) -> Dict[str, Any]:
    """Récupère le profil de l'utilisateur actuellement authentifié à partir de son identité JWT.

    Args:
        user_identity: Identifiant de l'utilisateur extrait du jeton JWT.

    Returns:
        Dictionnaire contenant les informations publiques du profil utilisateur
        et les informations de spécialité si l'utilisateur est mécanicien.
        Le mot de passe haché n'est jamais exposé.

    Raises:
        NotFoundError: Si l'utilisateur n'existe pas en base de données ou si l'identifiant est invalide.
    """
    if user_identity is None:
        raise NotFoundError("Utilisateur introuvable.")

    try:
        user_id = int(user_identity)
        if user_id <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        raise NotFoundError("Utilisateur introuvable.")

    user = db.session.get(Utilisateur, user_id)
    if user is None:
        raise NotFoundError(f"Utilisateur avec l'identifiant {user_id} introuvable.")

    data = user.to_dict()

    # Si l'utilisateur possède un profil mécanicien associé, enrichir les données
    if user.mecanicien is not None:
        data["id_mecanicien"] = user.mecanicien.id_mecanicien
        data["specialite"] = user.mecanicien.specialite
        data["mecanicien"] = {
            "id_mecanicien": user.mecanicien.id_mecanicien,
            "specialite": user.mecanicien.specialite,
        }

    return data
