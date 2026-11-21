"""Service métier pour le tableau de bord de GarageFlow.

Fournit le calcul des indicateurs clés de performance (KPI), l'activité d'atelier,
la répartition des interventions, les alertes de stock et le chiffre d'affaires.
Prend en compte le contrôle d'accès strict par rôle :
- RESPONSABLE : vue globale d'atelier, indicateurs financiers, rendez-vous et stocks.
- MECANICIEN : indicateurs restreints aux réparations qui lui sont affectées,
  masquage absolu des informations financières et comptables.
"""
from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, Any, List, Optional
from flask import current_app
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.client import Client
from app.models.vehicule import Vehicule
from app.models.mecanicien import Mecanicien
from app.models.reparation import Reparation
from app.models.facture import Facture
from app.models.piece_detachee import PieceDetachee
from app.models.rendez_vous import RendezVous


# Statuts de réparation
STATUSES_IN_PROGRESS = ["EN_COURS", "EN_REPARATION", "EN_DIAGNOSTIC"]
STATUSES_COMPLETED = ["TERMINEE", "LIVREE"]
STATUSES_WAITING = ["EN_ATTENTE"]
STATUSES_CANCELLED = ["ANNULEE"]

# Statuts de facture impayée
UNPAID_PAYMENT_STATUSES = [
    "EN_ATTENTE",
    "IMPAYEE",
    "NON_PAYEE",
    "PARTIELLE",
    "PARTIELLEMENT_PAYEE",
]


def _get_mecanicien_profile(user_id: Any) -> Optional[Mecanicien]:
    """Récupère l'instance Mecanicien associée à l'identifiant utilisateur."""
    if user_id is None:
        return None
    try:
        user_id_int = int(user_id)
    except (ValueError, TypeError):
        return None
    return Mecanicien.query.filter_by(id_utilisateur=user_id_int).first()


def _format_date_short(d: date) -> str:
    """Formatte une date au format court JJ/MM."""
    return d.strftime("%d/%m")


def _format_month_label(year: int, month: int) -> str:
    """Génère un libellé de mois en français lisible."""
    months_fr = [
        "", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
        "Juil", "Août", "Sep", "Oct", "Nov", "Déc"
    ]
    name = months_fr[month] if 1 <= month <= 12 else str(month)
    return f"{name} {year}"


def get_dashboard_stats(user_id: Any, user_role: str) -> Dict[str, Any]:
    """Calcule et rassemble l'ensemble des données du tableau de bord.

    Args:
        user_id: Identifiant de l'utilisateur connecté.
        user_role: Rôle de l'utilisateur ('RESPONSABLE' ou 'MECANICIEN').

    Returns:
        Dictionnaire standardisé des statistiques d'atelier.
    """
    today = date.today()
    is_responsable = user_role == "RESPONSABLE"
    mecanicien_entity = None
    mecanicien_id = None

    if not is_responsable:
        mecanicien_entity = _get_mecanicien_profile(user_id)
        if mecanicien_entity:
            mecanicien_id = mecanicien_entity.id_mecanicien

    # Seuil d'alerte configuré pour le stock faible
    try:
        low_stock_threshold = current_app.config.get("LOW_STOCK_THRESHOLD", 5) if current_app else 5
    except Exception:
        low_stock_threshold = 5

    # -------------------------------------------------------------------------
    # 1. KPI généraux
    # -------------------------------------------------------------------------
    if is_responsable:
        clients_total = db.session.query(func.count(Client.id_client)).scalar() or 0
        vehicules_total = db.session.query(func.count(Vehicule.id_vehicule)).scalar() or 0
    else:
        # Pour un mécanicien : nombre de véhicules sur lesquels il est ou a été affecté
        clients_total = None
        if mecanicien_id:
            vehicules_total = (
                db.session.query(func.count(func.distinct(Reparation.id_vehicule)))
                .filter(Reparation.id_mecanicien == mecanicien_id)
                .scalar() or 0
            )
        else:
            vehicules_total = 0

    # Réparations par statut (selon le rôle)
    rep_query = Reparation.query
    if not is_responsable and mecanicien_id:
        rep_query = rep_query.filter(Reparation.id_mecanicien == mecanicien_id)
    elif not is_responsable and not mecanicien_id:
        # Mécanicien sans profil configuré
        rep_query = rep_query.filter(Reparation.id_reparation == -1)

    reparations_en_cours = rep_query.filter(Reparation.statut.in_(STATUSES_IN_PROGRESS)).count()
    reparations_terminees = rep_query.filter(Reparation.statut.in_(STATUSES_COMPLETED)).count()
    reparations_en_attente = rep_query.filter(Reparation.statut.in_(STATUSES_WAITING)).count()
    reparations_annulees = rep_query.filter(Reparation.statut.in_(STATUSES_CANCELLED)).count()
    reparations_total = (
        reparations_en_cours + reparations_terminees + reparations_en_attente + reparations_annulees
    )

    # Rendez-vous aujourd'hui (autorisé pour RESPONSABLE)
    if is_responsable:
        rendez_vous_aujourd_hui = (
            db.session.query(func.count(RendezVous.id_rendezvous))
            .filter(RendezVous.date_rendezvous == today)
            .scalar() or 0
        )
    else:
        rendez_vous_aujourd_hui = 0

    # Facturation & Finances (Strictement réservé au RESPONSABLE)
    if is_responsable:
        factures_impayees = (
            db.session.query(func.count(Facture.id_facture))
            .filter(Facture.statut_paiement.in_(UNPAID_PAYMENT_STATUSES))
            .scalar() or 0
        )
        ca_query = (
            db.session.query(func.coalesce(func.sum(Facture.montant_total), 0))
            .filter(Facture.statut_paiement == "PAYEE")
            .scalar()
        )
        chiffre_affaires = float(ca_query) if ca_query is not None else 0.0
    else:
        factures_impayees = None
        chiffre_affaires = None

    # Pièces détachées & Alertes stock (Consultables par tous les profils d'atelier)
    stock_faible = (
        db.session.query(func.count(PieceDetachee.id_piece))
        .filter(PieceDetachee.quantite_stock <= low_stock_threshold)
        .scalar() or 0
    )

    # -------------------------------------------------------------------------
    # 2. Réparations récentes (avec eager loading complet pour éviter les requêtes N+1)
    # -------------------------------------------------------------------------
    recent_rep_query = (
        Reparation.query
        .options(
            joinedload(Reparation.vehicule).joinedload(Vehicule.client),
            joinedload(Reparation.mecanicien).joinedload(Mecanicien.utilisateur),
        )
    )
    if not is_responsable:
        if mecanicien_id:
            recent_rep_query = recent_rep_query.filter(Reparation.id_mecanicien == mecanicien_id)
        else:
            recent_rep_query = recent_rep_query.filter(Reparation.id_reparation == -1)

    recent_reparations_raw = (
        recent_rep_query
        .order_by(Reparation.date_reparation.desc(), Reparation.id_reparation.desc())
        .limit(6)
        .all()
    )

    reparations_recentes = []
    for r in recent_reparations_raw:
        vehicule_info = None
        client_info = None
        if r.vehicule:
            vehicule_info = {
                "id_vehicule": r.vehicule.id_vehicule,
                "immatriculation": r.vehicule.immatriculation,
                "marque": r.vehicule.marque,
                "modele": r.vehicule.modele,
            }
            if r.vehicule.client:
                client_info = {
                    "id_client": r.vehicule.client.id_client,
                    "nom": r.vehicule.client.nom,
                    "prenom": r.vehicule.client.prenom,
                }

        mecanicien_info = None
        if r.mecanicien and r.mecanicien.utilisateur:
            mecanicien_info = {
                "id_mecanicien": r.mecanicien.id_mecanicien,
                "nom": r.mecanicien.utilisateur.nom,
                "prenom": r.mecanicien.utilisateur.prenom,
                "specialite": r.mecanicien.specialite,
            }

        reparations_recentes.append({
            "id_reparation": r.id_reparation,
            "description": r.description,
            "statut": r.statut,
            "date_reparation": r.date_reparation.isoformat() if r.date_reparation else None,
            "cout": float(r.cout) if r.cout is not None else None,
            "vehicule": vehicule_info,
            "client": client_info,
            "mecanicien": mecanicien_info,
        })

    # -------------------------------------------------------------------------
    # 3. Prochains rendez-vous (RESPONSABLE uniquement)
    # -------------------------------------------------------------------------
    rendez_vous_prochains = []
    if is_responsable:
        rdv_raw = (
            RendezVous.query
            .options(
                joinedload(RendezVous.client),
                joinedload(RendezVous.vehicule),
            )
            .filter(RendezVous.date_rendezvous >= today)
            .order_by(RendezVous.date_rendezvous.asc(), RendezVous.heure.asc())
            .limit(6)
            .all()
        )
        for rdv in rdv_raw:
            rendez_vous_prochains.append({
                "id_rendezvous": rdv.id_rendezvous,
                "date_rendezvous": rdv.date_rendezvous.isoformat() if rdv.date_rendezvous else None,
                "heure": rdv.heure.isoformat() if rdv.heure else None,
                "motif": rdv.motif,
                "statut": rdv.statut,
                "client": {
                    "id_client": rdv.client.id_client,
                    "nom": rdv.client.nom,
                    "prenom": rdv.client.prenom,
                    "telephone": rdv.client.telephone,
                } if rdv.client else None,
                "vehicule": {
                    "id_vehicule": rdv.vehicule.id_vehicule,
                    "immatriculation": rdv.vehicule.immatriculation,
                    "marque": rdv.vehicule.marque,
                    "modele": rdv.vehicule.modele,
                } if rdv.vehicule else None,
            })

    # -------------------------------------------------------------------------
    # 4. Alertes de stock faible
    # -------------------------------------------------------------------------
    stock_alertes_raw = (
        PieceDetachee.query
        .filter(PieceDetachee.quantite_stock <= low_stock_threshold)
        .order_by(PieceDetachee.quantite_stock.asc(), PieceDetachee.nom.asc())
        .limit(10)
        .all()
    )
    stock_alertes = []
    for piece in stock_alertes_raw:
        if piece.quantite_stock <= 0:
            severity = "RUPTURE"
        elif piece.quantite_stock <= 2:
            severity = "CRITIQUE"
        else:
            severity = "ATTENTION"

        stock_alertes.append({
            "id_piece": piece.id_piece,
            "nom": piece.nom,
            "quantite_stock": piece.quantite_stock,
            "prix_unitaire": float(piece.prix_unitaire) if piece.prix_unitaire is not None else 0.0,
            "seuil_alerte": low_stock_threshold,
            "severite": severity,
        })

    # -------------------------------------------------------------------------
    # 5. Graphiques & Données chronologiques réelles
    # -------------------------------------------------------------------------
    # A. Répartition par statut
    reparations_par_statut = [
        {"name": "En attente", "statut": "EN_ATTENTE", "valeur": reparations_en_attente, "color": "#64748b"},
        {"name": "En cours", "statut": "EN_COURS", "valeur": reparations_en_cours, "color": "#0284c7"},
        {"name": "Terminée", "statut": "TERMINEE", "valeur": reparations_terminees, "color": "#10b981"},
        {"name": "Annulée", "statut": "ANNULEE", "valeur": reparations_annulees, "color": "#f43f5e"},
    ]

    # B. Activité des réparations sur différentes périodes
    # Période 7 jours
    last_7_days = [today - timedelta(days=i) for i in range(6, -1, -1)]
    # Période 30 jours
    last_30_days = [today - timedelta(days=i) for i in range(29, -1, -1)]
    # Période 12 mois
    current_year = today.year
    current_month = today.month
    last_12_months = []
    for i in range(11, -1, -1):
        m = current_month - i
        y = current_year
        while m <= 0:
            m += 12
            y -= 1
        last_12_months.append((y, m))

    # Récupération des dates des réparations sur les 365 derniers jours
    earliest_date = today - timedelta(days=366)
    rep_dates_query = (
        db.session.query(Reparation.date_reparation, func.count(Reparation.id_reparation))
        .filter(Reparation.date_reparation >= earliest_date)
    )
    if not is_responsable:
        if mecanicien_id:
            rep_dates_query = rep_dates_query.filter(Reparation.id_mecanicien == mecanicien_id)
        else:
            rep_dates_query = rep_dates_query.filter(Reparation.id_reparation == -1)

    rep_dates_counts = dict(rep_dates_query.group_by(Reparation.date_reparation).all())

    # Construction de l'activité 7 jours
    activite_7j = [
        {
            "date": d.isoformat(),
            "label": _format_date_short(d),
            "reparations": rep_dates_counts.get(d, 0),
        }
        for d in last_7_days
    ]

    # Construction de l'activité 30 jours
    activite_30j = [
        {
            "date": d.isoformat(),
            "label": _format_date_short(d),
            "reparations": rep_dates_counts.get(d, 0),
        }
        for d in last_30_days
    ]

    # Construction de l'activité 12 mois
    activite_12m = []
    for (y, m) in last_12_months:
        count = sum(
            c for d, c in rep_dates_counts.items()
            if d.year == y and d.month == m
        )
        activite_12m.append({
            "annee": y,
            "mois": m,
            "label": _format_month_label(y, m),
            "reparations": count,
        })

    activite_reparations = {
        "7_jours": activite_7j,
        "30_jours": activite_30j,
        "12_mois": activite_12m,
    }

    # C. Évolution du chiffre d'affaires (RESPONSABLE uniquement)
    evolution_revenus = None
    if is_responsable:
        # Factures payées sur les 12 derniers mois
        factures_query = (
            db.session.query(Facture.date_facture, Facture.montant_total)
            .filter(
                Facture.statut_paiement == "PAYEE",
                Facture.date_facture >= earliest_date,
            )
            .all()
        )
        
        # Agrégation par mois
        monthly_revenue = { (y, m): {"total": Decimal("0.00"), "count": 0} for (y, m) in last_12_months }
        for f_date, f_montant in factures_query:
            if f_date and f_montant:
                key = (f_date.year, f_date.month)
                if key in monthly_revenue:
                    monthly_revenue[key]["total"] += Decimal(str(f_montant))
                    monthly_revenue[key]["count"] += 1

        evolution_revenus = [
            {
                "annee": y,
                "mois": m,
                "label": _format_month_label(y, m),
                "revenu": float(monthly_revenue[(y, m)]["total"]),
                "factures": monthly_revenue[(y, m)]["count"],
            }
            for (y, m) in last_12_months
        ]

    # -------------------------------------------------------------------------
    # Assemblage final de la réponse
    # -------------------------------------------------------------------------
    return {
        "user_role": user_role,
        "low_stock_threshold": low_stock_threshold,
        "clients_total": clients_total,
        "vehicules_total": vehicules_total,
        "reparations_total": reparations_total,
        "reparations_en_cours": reparations_en_cours,
        "reparations_terminees": reparations_terminees,
        "reparations_en_attente": reparations_en_attente,
        "reparations_annulees": reparations_annulees,
        "rendez_vous_aujourd_hui": rendez_vous_aujourd_hui,
        "factures_impayees": factures_impayees,
        "chiffre_affaires": chiffre_affaires,
        "stock_faible": stock_faible,
        "reparations_recentes": reparations_recentes,
        "rendez_vous_prochains": rendez_vous_prochains,
        "stock_alertes": stock_alertes,
        "reparations_par_statut": reparations_par_statut,
        "activite_reparations": activite_reparations,
        "evolution_revenus": evolution_revenus,
    }
