import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES,
  ROLE_LABELS,
  CURRENCY,
  formatCurrency,
  FACTURE_STATUSES,
  RENDEZ_VOUS_STATUSES,
} from '../src/utils/constants.js';

test('constants - Définition stricte des rôles RBAC', () => {
  assert.strictEqual(ROLES.RESPONSABLE, 'RESPONSABLE');
  assert.strictEqual(ROLES.MECANICIEN, 'MECANICIEN');
  assert.ok(ROLE_LABELS[ROLES.RESPONSABLE]);
  assert.ok(ROLE_LABELS[ROLES.MECANICIEN]);
});

test('constants - Devise et formatage financier TND', () => {
  assert.strictEqual(CURRENCY, 'TND');
  const formatted = formatCurrency(125.5);
  assert.ok(formatted.includes('TND'));
  assert.ok(formatted.includes('125'));
});

test('constants - Statuts Factures et Rendez-vous', () => {
  assert.strictEqual(FACTURE_STATUSES.PAYEE, 'PAYEE');
  assert.strictEqual(FACTURE_STATUSES.EN_ATTENTE, 'EN_ATTENTE');
  assert.strictEqual(FACTURE_STATUSES.ANNULEE, 'ANNULEE');

  assert.strictEqual(RENDEZ_VOUS_STATUSES.PLANIFIE, 'PLANIFIE');
  assert.strictEqual(RENDEZ_VOUS_STATUSES.CONFIRME, 'CONFIRME');
  assert.strictEqual(RENDEZ_VOUS_STATUSES.TERMINE, 'TERMINE');
  assert.strictEqual(RENDEZ_VOUS_STATUSES.ANNULE, 'ANNULE');
});
