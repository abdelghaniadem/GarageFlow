"""Service métier pour la gestion des rendez-vous de GarageFlow.

Fournit les fonctionnalités de planification d'atelier selon les exigences métier et le diagramme UML :
- Opérations CRUD complètes.
- Validation rigoureuse de l'existence du client et du véhicule (404 si introuvable).
- Règle de cohérence stricte : vérification formelle que le véhicule appartient bien au client sélectionné (422).
- Validation de la date et de l'heure du rendez-vous.
- Définition, validation et normalisation des statuts autorisés (PLANIFIE, CONFIRME, EN_ATTENTE, etc.).
- Filtrage multicritères (client, véhicule, date exacte, plage de dates, statut).
- Protection contre les mises à jour invalides ou incohérentes.
- Protection de l'historique d'atelier : interdiction de supprimer un rendez-vous déjà honoré ou terminé (409 Conflict).
- Transactions SQLAlchemy avec rollback sécurisé en cas d'erreur.
"""
from datetime import date, time
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.rendez_vous import RendezVous
from app.models.client import Client
from app.models.vehicule import Vehicule
from app.schemas.rendez_vous_schema import (
    ALLOWED_APPOINTMENT_STATUSES,
    _normalize_appointment_status,
)
from app.utils.exceptions import NotFoundError, ConflictError, ValidationError


def _validate_client_and_vehicle_ownership(id_client: int, id_vehicule: int) -> Tuple[Client, Vehicule]:
    """Valide l'existence du client et du véhicule, et vérifie la relation de propriété.

    Règles de gestion :
    - Le client doit exister (404 si absent).
    - Le véhicule doit exister (404 si absent).
    - Le véhicule doit impérativement être la propriété du client sélectionné (422 si incohérent).

    Args:
        id_client: Identifiant unique du client.
        id_vehicule: Identifiant unique du véhicule.

    Returns:
        Tuple (Client, Vehicule) validé.

    Raises:
        NotFoundError: Si le client ou le véhicule n'existe pas en base.
        ValidationError: Si le véhicule appartient à un autre client.
    """
    client = db.session.get(Client, id_client)
    if client is None:
        raise NotFoundError(f"Client avec l'identifiant {id_client} introuvable.")

    vehicule = db.session.get(Vehicule, id_vehicule)
    if vehicule is None:
        raise NotFoundError(f"Véhicule avec l'identifiant {id_vehicule} introuvable.")

    if vehicule.id_client != client.id_client:
        raise ValidationError(
            message="Le véhicule sélectionné n'appartient pas au client spécifié.",
            details={
                "id_vehicule": [
                    f"Le véhicule '{vehicule.immatriculation}' (ID {vehicule.id_vehicule}) "
                    f"n'appartient pas au client '{client.prenom} {client.nom}' (ID {client.id_client})."
                ]
            },
        )

    return client, vehicule


def list_rendez_vous(
    id_client: Optional[int] = None,
    id_vehicule: Optional[int] = None,
    statut: Optional[str] = None,
    date_rendezvous: Optional[date] = None,
    date_debut: Optional[date] = None,
    date_fin: Optional[date] = None,
) -> List[RendezVous]:
    """Liste les rendez-vous enregistrés avec filtres multicritères optionnels.

    Args:
        id_client: Filtrer par client.
        id_vehicule: Filtrer par véhicule.
        statut: Filtrer par statut normalisé.
        date_rendezvous: Filtrer par date exacte.
        date_debut: Filtrer les rendez-vous à partir de cette date (inclusive).
        date_fin: Filtrer les rendez-vous jusqu'à cette date (inclusive).

    Returns:
        Liste d'instances RendezVous ordonnées chronologiquement (date et heure croissantes).
    """
    query = RendezVous.query

    if id_client is not None:
        query = query.filter(RendezVous.id_client == id_client)

    if id_vehicule is not None:
        query = query.filter(RendezVous.id_vehicule == id_vehicule)

    if statut and isinstance(statut, str) and statut.strip():
        norm_statut = _normalize_appointment_status(statut)
        query = query.filter(RendezVous.statut == norm_statut)

    if date_rendezvous is not None:
        query = query.filter(RendezVous.date_rendezvous == date_rendezvous)

    if date_debut is not None:
        query = query.filter(RendezVous.date_rendezvous >= date_debut)

    if date_fin is not None:
        query = query.filter(RendezVous.date_rendezvous <= date_fin)

    return query.order_by(
        RendezVous.date_rendezvous.asc(),
        RendezVous.heure.asc(),
        RendezVous.id_rendezvous.asc(),
    ).all()


def get_rendez_vous_by_id(id_rendezvous: int) -> RendezVous:
    """Récupère un rendez-vous par son identifiant unique.

    Args:
        id_rendezvous: Identifiant du rendez-vous.

    Returns:
        L'instance RendezVous correspondante.

    Raises:
        NotFoundError: Si le rendez-vous n'existe pas.
        ValidationError: Si l'identifiant est invalide.
    """
    try:
        id_int = int(id_rendezvous)
        if id_int <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        raise ValidationError(
            message="Identifiant de rendez-vous invalide.",
            details={"id_rendezvous": ["L'identifiant doit être un entier positif."]},
        )

    rdv = db.session.get(RendezVous, id_int)
    if rdv is None:
        raise NotFoundError(f"Rendez-vous avec l'identifiant {id_rendezvous} introuvable.")
    return rdv


def create_rendez_vous(data: Dict[str, Any]) -> RendezVous:
    """Crée un nouveau rendez-vous après validation des dépendances et de la cohérence.

    Opération transactionnelle atomique :
    1. Validation des clés étrangères (client et véhicule existants).
    2. Vérification que le véhicule appartient bien au client.
    3. Validation de la date et de l'heure.
    4. Validation et normalisation du statut.
    5. Persistance en base avec capture des IntegrityError et rollback.

    Args:
        data: Dictionnaire validé contenant date_rendezvous, heure, id_client, id_vehicule, motif, statut.

    Returns:
        L'instance RendezVous créée et persistée.

    Raises:
        NotFoundError: Si le client ou le véhicule n'existe pas.
        ValidationError: Si les données sont invalides ou incohérentes (véhicule non détenu par le client).
        ConflictError: En cas de conflit d'intégrité en base.
    """
    if not data or not isinstance(data, dict):
        raise ValidationError("Données de rendez-vous requises.")

    id_client = data.get("id_client")
    id_vehicule = data.get("id_vehicule")

    # 1 & 2. Validation de l'existence et de la cohérence propriétaire-véhicule
    _validate_client_and_vehicle_ownership(id_client, id_vehicule)

    # 3. Extraction et validation de la date et heure
    date_rendezvous = data["date_rendezvous"]
    heure = data["heure"]
    motif = data.get("motif")

    # 4. Statut
    raw_statut = data.get("statut", "PLANIFIE")
    norm_statut = _normalize_appointment_status(str(raw_statut)) if raw_statut else "PLANIFIE"
    if norm_statut not in ALLOWED_APPOINTMENT_STATUSES:
        raise ValidationError(
            message=f"Statut de rendez-vous '{raw_statut}' invalide.",
            details={"statut": [f"Statuts autorisés : {', '.join(ALLOWED_APPOINTMENT_STATUSES)}."]},
        )

    rdv = RendezVous(
        date_rendezvous=date_rendezvous,
        heure=heure,
        motif=motif,
        statut=norm_statut,
        id_client=id_client,
        id_vehicule=id_vehicule,
    )

    db.session.add(rdv)
    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de créer le rendez-vous en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise

    return rdv


def update_rendez_vous(id_rendezvous: int, data: Dict[str, Any]) -> RendezVous:
    """Met à jour un rendez-vous existant avec vérification stricte de cohérence.

    Si le client ou le véhicule est modifié, la cohérence de propriété
    (véhicule appartenant au client) est systématiquement revérifiée.

    Args:
        id_rendezvous: Identifiant du rendez-vous à modifier.
        data: Champs à mettre à jour.

    Returns:
        L'instance RendezVous mise à jour.

    Raises:
        NotFoundError: Si le rendez-vous, le client ou le véhicule n'existe pas.
        ValidationError: Si les modifications violent les contraintes métier ou de cohérence.
        ConflictError: En cas de conflit d'intégrité.
    """
    if not data or not isinstance(data, dict) or len(data) == 0:
        raise ValidationError(
            message="Le corps de la requête ne peut pas être vide pour une mise à jour.",
            details={"_schema": ["At least one field must be provided for update."]},
        )

    rdv = get_rendez_vous_by_id(id_rendezvous)

    # Détermination du client et du véhicule cibles
    target_client_id = data.get("id_client", rdv.id_client)
    target_vehicule_id = data.get("id_vehicule", rdv.id_vehicule)

    # Si le client ou le véhicule change, on revalide impérativement la cohérence de propriété
    if "id_client" in data or "id_vehicule" in data:
        _validate_client_and_vehicle_ownership(target_client_id, target_vehicule_id)
        rdv.id_client = target_client_id
        rdv.id_vehicule = target_vehicule_id

    if "date_rendezvous" in data:
        rdv.date_rendezvous = data["date_rendezvous"]

    if "heure" in data:
        rdv.heure = data["heure"]

    if "motif" in data:
        rdv.motif = data["motif"]

    if "statut" in data:
        raw_statut = data["statut"]
        norm_statut = _normalize_appointment_status(str(raw_statut)) if raw_statut else rdv.statut
        if norm_statut not in ALLOWED_APPOINTMENT_STATUSES:
            raise ValidationError(
                message=f"Statut de rendez-vous '{raw_statut}' invalide.",
                details={"statut": [f"Statuts autorisés : {', '.join(ALLOWED_APPOINTMENT_STATUSES)}."]},
            )
        rdv.statut = norm_statut

    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de mettre à jour le rendez-vous en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise

    return rdv


def delete_rendez_vous(id_rendezvous: int) -> None:
    """Supprime un rendez-vous si son état autorise la suppression.

    Préservation de l'historique d'atelier (exigence 11) :
    - Un rendez-vous dont le statut est 'TERMINE' ou 'HONORE' ne peut PAS être supprimé (409 Conflict).
    - Les rendez-vous planifiés, confirmés, en attente ou annulés peuvent être supprimés.

    Args:
        id_rendezvous: Identifiant du rendez-vous à supprimer.

    Raises:
        NotFoundError: Si le rendez-vous n'existe pas.
        ConflictError: Si le rendez-vous est déjà terminé ou honoré (protection d'historique).
    """
    rdv = get_rendez_vous_by_id(id_rendezvous)

    # Protection contre la suppression accidentelle de l'historique d'atelier
    if rdv.statut in ["TERMINE", "HONORE"]:
        raise ConflictError(
            message="Impossible de supprimer un rendez-vous terminé ou honoré afin de préserver l'historique d'atelier.",
            details={"id_rendezvous": id_rendezvous, "statut": rdv.statut},
        )

    try:
        db.session.delete(rdv)
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de supprimer ce rendez-vous en raison de contraintes relationnelles.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise
