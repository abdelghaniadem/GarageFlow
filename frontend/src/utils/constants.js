/**
 * Constantes de l'application GarageFlow.
 * Rôles conformes au modèle backend Utilisateur ('RESPONSABLE', 'MECANICIEN').
 */
export const ROLES = {
  RESPONSABLE: 'RESPONSABLE',
  MECANICIEN: 'MECANICIEN',
};

/**
 * Devise officielle de l'application (Tunisie : Dinar Tunisien - TND).
 */
export const CURRENCY = 'TND';

export const formatCurrency = (val) => {
  const num = Number(val || 0);
  return `${num.toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${CURRENCY}`;
};

export const ROLE_LABELS = {
  [ROLES.RESPONSABLE]: 'Responsable d\'Atelier',
  [ROLES.MECANICIEN]: 'Mécanicien',
};

export const ROLE_BADGE_CLASSES = {
  [ROLES.RESPONSABLE]: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  [ROLES.MECANICIEN]: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
};

/**
 * Statuts de paiement des factures.
 * Aligné sur Facture.statut_paiement et ALLOWED_PAYMENT_STATUSES du backend.
 */
export const FACTURE_STATUSES = {
  EN_ATTENTE: 'EN_ATTENTE',
  PAYEE: 'PAYEE',
  ANNULEE: 'ANNULEE',
  IMPAYEE: 'IMPAYEE',
  PARTIELLE: 'PARTIELLE',
  PARTIELLEMENT_PAYEE: 'PARTIELLEMENT_PAYEE',
  NON_PAYEE: 'NON_PAYEE',
};

export const FACTURE_STATUS_LABELS = {
  [FACTURE_STATUSES.EN_ATTENTE]: 'En attente',
  [FACTURE_STATUSES.PAYEE]: 'Payée',
  [FACTURE_STATUSES.ANNULEE]: 'Annulée',
  [FACTURE_STATUSES.IMPAYEE]: 'Impayée',
  [FACTURE_STATUSES.PARTIELLE]: 'Partielle',
  [FACTURE_STATUSES.PARTIELLEMENT_PAYEE]: 'Partiellement payée',
  [FACTURE_STATUSES.NON_PAYEE]: 'Non payée',
};

export const FACTURE_STATUS_BADGE_CLASSES = {
  [FACTURE_STATUSES.EN_ATTENTE]: 'bg-amber-50 text-amber-900 border-amber-300 font-semibold',
  [FACTURE_STATUSES.PAYEE]: 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold',
  [FACTURE_STATUSES.ANNULEE]: 'bg-slate-100 text-slate-800 border-slate-300 font-semibold',
  [FACTURE_STATUSES.IMPAYEE]: 'bg-rose-50 text-rose-900 border-rose-300 font-semibold',
  [FACTURE_STATUSES.PARTIELLE]: 'bg-blue-50 text-blue-900 border-blue-300 font-semibold',
  [FACTURE_STATUSES.PARTIELLEMENT_PAYEE]: 'bg-indigo-50 text-indigo-900 border-indigo-300 font-semibold',
  [FACTURE_STATUSES.NON_PAYEE]: 'bg-rose-50 text-rose-900 border-rose-300 font-semibold',
};

/**
 * Statuts des rendez-vous.
 * Aligné sur RendezVous.statut et ALLOWED_APPOINTMENT_STATUSES du backend.
 */
export const RENDEZ_VOUS_STATUSES = {
  PLANIFIE: 'PLANIFIE',
  CONFIRME: 'CONFIRME',
  EN_ATTENTE: 'EN_ATTENTE',
  EN_COURS: 'EN_COURS',
  TERMINE: 'TERMINE',
  ANNULE: 'ANNULE',
  HONORE: 'HONORE',
  NON_HONORE: 'NON_HONORE',
  ABSENT: 'ABSENT',
};

export const RENDEZ_VOUS_STATUS_LABELS = {
  [RENDEZ_VOUS_STATUSES.PLANIFIE]: 'Planifié',
  [RENDEZ_VOUS_STATUSES.CONFIRME]: 'Confirmé',
  [RENDEZ_VOUS_STATUSES.EN_ATTENTE]: 'En attente',
  [RENDEZ_VOUS_STATUSES.EN_COURS]: 'En atelier',
  [RENDEZ_VOUS_STATUSES.TERMINE]: 'Terminé',
  [RENDEZ_VOUS_STATUSES.ANNULE]: 'Annulé',
  [RENDEZ_VOUS_STATUSES.HONORE]: 'Honoré',
  [RENDEZ_VOUS_STATUSES.NON_HONORE]: 'Non honoré',
  [RENDEZ_VOUS_STATUSES.ABSENT]: 'Absent',
};

export const RENDEZ_VOUS_STATUS_BADGE_CLASSES = {
  [RENDEZ_VOUS_STATUSES.PLANIFIE]: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
  [RENDEZ_VOUS_STATUSES.CONFIRME]: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  [RENDEZ_VOUS_STATUSES.EN_ATTENTE]: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  [RENDEZ_VOUS_STATUSES.EN_COURS]: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
  [RENDEZ_VOUS_STATUSES.TERMINE]: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  [RENDEZ_VOUS_STATUSES.ANNULE]: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  [RENDEZ_VOUS_STATUSES.HONORE]: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
  [RENDEZ_VOUS_STATUSES.NON_HONORE]: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  [RENDEZ_VOUS_STATUSES.ABSENT]: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
};
