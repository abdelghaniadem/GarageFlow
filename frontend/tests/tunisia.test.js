import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTunisianPhone, validateTunisianPlate } from '../src/utils/tunisia.js';

test('validateTunisianPhone - numéros tunisiens valides', () => {
  const validCases = [
    '98123456',
    '98 123 456',
    '55 123 456',
    '20-456-789',
    '+216 98 123 456',
    '+21698123456',
    '0021655123456',
    '71 234 567',
    '31 456 789',
  ];

  for (const phone of validCases) {
    const res = validateTunisianPhone(phone);
    assert.strictEqual(res.isValid, true, `Le numéro ${phone} devrait être valide`);
    assert.match(res.cleanDigits, /^\d{8}$/);
    assert.ok(res.formatted);
    assert.ok(res.formattedInternational.startsWith('+216 '));
  }
});

test('validateTunisianPhone - rejets des formats invalides', () => {
  const invalidCases = [
    '',
    '   ',
    null,
    undefined,
    '123',
    'abcdefgh',
    '+216',
    '12345',
    '01234567890123456', // Trop long (>15)
  ];

  for (const phone of invalidCases) {
    const res = validateTunisianPhone(phone);
    assert.strictEqual(res.isValid, false, `Le numéro ${phone} devrait être rejeté`);
    assert.ok(res.error);
  }
});

test('validateTunisianPlate - plaques tunisiennes valides', () => {
  const validPlates = [
    { input: '123 تونس 4567', expected: '123 تونس 4567', type: 'ORDINAIRE_ARABE' },
    { input: '205 TU 4589', expected: '205 TU 4589', type: 'ORDINAIRE_LATIN' },
    { input: '  205 tu 4589  ', expected: '205 TU 4589', type: 'ORDINAIRE_LATIN' },
    { input: '180-TUN-5544', expected: '180 TUN 5544', type: 'ORDINAIRE_LATIN' },
    { input: '200-4713', expected: '200-4713', type: 'NUMERIQUE_TIRET' },
    { input: 'TU-1234', expected: 'TU-1234', type: 'ANCIEN_TU' },
    { input: '123456 RS', expected: '123456 RS', type: 'SPECIAL_TUNISIE' },
    { input: '9876 IT', expected: '9876 IT', type: 'SPECIAL_TUNISIE' },
  ];

  for (const { input, expected, type } of validPlates) {
    const res = validateTunisianPlate(input);
    assert.strictEqual(res.isValid, true, `La plaque ${input} devrait être valide`);
    assert.strictEqual(res.normalized, expected);
    assert.strictEqual(res.type, type);
  }
});

test('validateTunisianPlate - rejets des plaques invalides et étrangères', () => {
  const invalidPlates = [
    '',
    '   ',
    null,
    undefined,
    'AA-123-BB', // Plaque française
    'BB-234-CC',
    '123-XYZ-78',
    'ABC',
    '1234567890',
  ];

  for (const plate of invalidPlates) {
    const res = validateTunisianPlate(plate);
    assert.strictEqual(res.isValid, false, `La plaque ${plate} devrait être rejetée`);
    assert.ok(res.error);
  }
});
