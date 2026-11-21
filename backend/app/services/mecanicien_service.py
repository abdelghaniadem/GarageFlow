"""Service métier pour la gestion des mécaniciens de GarageFlow.

Fournit les opérations CRUD, l'association sécurisée aux comptes utilisateurs (rôle MECANICIEN),
le hachage des mots de passe avec Utilisateur.set_password(), l'unicité du profil
et le contrôle d'intégrité anti-cascade interdisant la suppression si des réparations existent.
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.mecanicien import Mecanicien
from app.models.utilisateur import Utilisateur
from app.utils.exceptions import NotFoundError, ConflictError, ValidationError


def list_mecaniciens(
    specialite: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Mecanicien]:
    """Liste tous les mécaniciens avec filtres optionnels par spécialité ou recherche textuelle.

    Args:
        specialite: Filtrer par intitulé de spécialité (insensible à la casse).
        search: Terme de recherche optionnel filtrant nom, prénom, email ou spécialité.

    Returns:
        Liste d'instances Mecanicien triées par identifiant croissant.
    """
    query = Mecanicien.query

    if specialite and isinstance(specialite, str) and specialite.strip():
        term_spec = f"%{specialite.strip()}%"
        query = query.filter(Mecanicien.specialite.ilike(term_spec))

    if search and isinstance(search, str) and search.strip():
        term = f"%{search.strip()}%"
        query = query.join(Mecanicien.utilisateur).filter(
            db.or_(
                Mecanicien.specialite.ilike(term),
                Utilisateur.nom.ilike(term),
                Utilisateur.prenom.ilike(term),
                Utilisateur.email.ilike(term),
            )
        )

    return query.order_by(Mecanicien.id_mecanicien.asc()).all()


def get_mecanicien_by_id(id_mecanicien: int) -> Mecanicien:
    """Récupère un mécanicien par son identifiant unique.

    Args:
        id_mecanicien: Identifiant primaire du mécanicien.

    Returns:
        L'instance Mecanicien correspondante.

    Raises:
        NotFoundError: Si aucun mécanicien ne correspond à l'identifiant.
    """
    mecanicien = db.session.get(Mecanicien, id_mecanicien)
    if mecanicien is None:
        raise NotFoundError(f"Mécanicien avec l'identifiant {id_mecanicien} introuvable.")
    return mecanicien


def create_mecanicien(data: Dict[str, Any]) -> Mecanicien:
    """Crée un nouveau profil mécanicien.

    Règles métier :
    1. Association obligatoire à un Utilisateur existant ou création simultanée.
    2. L'utilisateur associé doit impérativement avoir le rôle 'MECANICIEN'.
    3. Un utilisateur ne peut posséder qu'un seul profil mécanicien (unicité).
    4. Hachage du mot de passe avec Utilisateur.set_password() lors de la création d'un compte.

    Args:
        data: Dictionnaire contenant la spécialité et l'identifiant utilisateur (ou ses données).

    Returns:
        L'instance Mecanicien persistée.

    Raises:
        NotFoundError: Si l'utilisateur spécifié n'existe pas.
        ValidationError: Si le rôle est incorrect ou si les données requises sont manquantes.
        ConflictError: Si l'utilisateur possède déjà un profil mécanicien ou si l'email existe déjà.
    """
    id_utilisateur = data.get("id_utilisateur")

    # Cas 1 : Association à un compte utilisateur existant
    if id_utilisateur is not None:
        user = db.session.get(Utilisateur, id_utilisateur)
        if user is None:
            raise NotFoundError(f"Utilisateur avec l'identifiant {id_utilisateur} introuvable.")

        # Règle 2 : L'utilisateur associé doit avoir le rôle MECANICIEN
        if user.role != "MECANICIEN":
            raise ValidationError(
                message=f"L'utilisateur {id_utilisateur} a le rôle '{user.role}'. Seul le rôle 'MECANICIEN' est autorisé.",
                details={"role": ["L'utilisateur associé doit avoir le rôle 'MECANICIEN'."]},
            )

        # Règle 3 : Unicité du profil mécanicien par utilisateur
        existing_profile = Mecanicien.query.filter_by(id_utilisateur=id_utilisateur).first()
        if existing_profile is not None:
            raise ConflictError(
                message=f"L'utilisateur {id_utilisateur} possède déjà un profil mécanicien (ID {existing_profile.id_mecanicien}).",
                details={"id_utilisateur": ["Cet utilisateur est déjà associé à un profil mécanicien."]},
            )

    # Cas 2 : Création simultanée du compte utilisateur
    else:
        # Validation des données nécessaires à la création du compte utilisateur
        missing_fields = []
        for field in ("nom", "prenom", "email", "mot_de_passe"):
            if not data.get(field):
                missing_fields.append(field)

        if missing_fields:
            raise ValidationError(
                message="Pour créer un mécanicien sans id_utilisateur, les champs nom, prenom, email et mot_de_passe sont obligatoires.",
                details={f: ["Ce champ est requis."] for f in missing_fields},
            )

        email = data["email"].strip().lower()
        if Utilisateur.query.filter_by(email=email).first():
            raise ConflictError(
                message=f"Un utilisateur avec l'adresse email '{email}' existe déjà.",
                details={"email": ["Cette adresse email est déjà utilisée."]},
            )

        # Création de l'utilisateur avec hachage sécurisé du mot de passe
        user = Utilisateur(
            nom=data["nom"],
            prenom=data["prenom"],
            email=email,
            role="MECANICIEN",
            telephone=data.get("telephone"),
        )
        user.set_password(data["mot_de_passe"])
        db.session.add(user)
        try:
            db.session.flush()
        except IntegrityError as err:
            db.session.rollback()
            raise ConflictError("Erreur d'intégrité lors de la création du compte utilisateur.") from err

    # Création de l'enregistrement Mécanicien
    mecanicien = Mecanicien(
        specialite=data["specialite"],
        id_utilisateur=user.id_utilisateur,
    )
    db.session.add(mecanicien)

    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de créer le mécanicien en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise

    return mecanicien


def update_mecanicien(id_mecanicien: int, data: Dict[str, Any]) -> Mecanicien:
    """Met à jour un mécanicien existant.

    Règle 6 : Interdiction formelle de réassigner l'identifiant utilisateur (id_utilisateur)
    sans justification métier pour préserver la traçabilité.

    Args:
        id_mecanicien: Identifiant du mécanicien à modifier.
        data: Dictionnaire contenant les champs à modifier (ex: specialite, nom, prenom, telephone).

    Returns:
        L'instance Mecanicien mise à jour.

    Raises:
        NotFoundError: Si le mécanicien n'existe pas.
        ValidationError: Si aucune donnée n'est fournie ou si une modification d'id_utilisateur est tentée.
        ConflictError: En cas de violation de contrainte d'intégrité.
    """
    if not data or not isinstance(data, dict):
        raise ValidationError("Aucune donnée fournie pour la mise à jour.")

    mecanicien = get_mecanicien_by_id(id_mecanicien)

    # Règle 6 : Interdiction de modifier l'association utilisateur
    if "id_utilisateur" in data and data["id_utilisateur"] != mecanicien.id_utilisateur:
        raise ValidationError(
            message="La modification du compte utilisateur associé à un mécanicien est interdite.",
            details={"id_utilisateur": ["La réassignation du compte utilisateur n'est pas autorisée."]},
        )

    if "specialite" in data:
        mecanicien.specialite = data["specialite"]

    # Mise à jour optionnelle des métadonnées du profil utilisateur lié
    if mecanicien.utilisateur:
        if "nom" in data:
            mecanicien.utilisateur.nom = data["nom"]
        if "prenom" in data:
            mecanicien.utilisateur.prenom = data["prenom"]
        if "telephone" in data:
            mecanicien.utilisateur.telephone = data["telephone"]

    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de mettre à jour le mécanicien en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise

    return mecanicien


def delete_mecanicien(id_mecanicien: int) -> None:
    """Supprime un mécanicien si aucune réparation ne lui est rattachée.

    Règle 7 : Interdiction de supprimer un mécanicien ayant un historique de réparations.

    Args:
        id_mecanicien: Identifiant du mécanicien à supprimer.

    Raises:
        NotFoundError: Si le mécanicien n'existe pas.
        ConflictError: Si des réparations sont associées au mécanicien.
    """
    mecanicien = get_mecanicien_by_id(id_mecanicien)

    # Règle 7 : Prévention de la suppression si des réparations sont associées
    if mecanicien.reparations:
        raise ConflictError(
            message=f"Impossible de supprimer le mécanicien : {len(mecanicien.reparations)} réparation(s) associée(s).",
            details={"reparations_count": len(mecanicien.reparations)},
        )

    try:
        db.session.delete(mecanicien)
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de supprimer ce mécanicien en raison de contraintes d'intégrité relationnelle.",
            details={"error": "Foreign key constraint violation."},
        ) from err
    except Exception:
        db.session.rollback()
        raise
