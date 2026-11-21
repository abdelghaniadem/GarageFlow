/**
 * Utilitaires et validateurs pour le contexte tunisien dans GarageFlow.
 * Gère :
 * - Les plaques d'immatriculation tunisiennes (format ordinaire 123 تونس 4567 / 123 TU 4567 et séries spéciales).
 * - Les numéros de téléphone tunisiens (8 chiffres avec ou sans préfixe +216 / 00216).
 * - Le formatage des devises en Dinar Tunisien (TND).
 */

/**
 * Valide un numéro de téléphone tunisien.
 * Accepte :
 * - 8 chiffres nationaux (ex: 98123456, 98 123 456, 98-123-456, 20.123.456, 55 123 456, 71 234 567)
 * - Avec préfixe international +216 ou 00216 (ex: +216 98 123 456, 0021698123456)
 *
 * @param {string} phone
 * @returns {{ isValid: boolean, error?: string, normalized?: string }}
 */
export const validateTunisianPhone = (phone) => {
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return {
      isValid: false,
      error: 'Le numéro de téléphone est obligatoire.',
    };
  }

  // Nettoyage : retirer espaces, tirets, points, parenthèses, slashes
  let clean = phone.trim().replace(/[\s\-_./()]/g, '');

  // Retirer préfixe international optionnel : +216, 00216 ou 216
  if (clean.startsWith('+216')) {
    clean = clean.substring(4);
  } else if (clean.startsWith('00216')) {
    clean = clean.substring(5);
  } else if (clean.length === 11 && clean.startsWith('216')) {
    clean = clean.substring(3);
  }

  // Vérification : doit comporter exactement 8 chiffres
  if (!/^\d{8}$/.test(clean)) {
    return {
      isValid: false,
      error: 'Le numéro de téléphone tunisien doit comporter 8 chiffres (ex: 98 123 456 ou +216 98 123 456).',
    };
  }

  // Formatage standardisé national : XX XXX XXX
  const formattedNational = `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)}`;
  const formattedInternational = `+216 ${formattedNational}`;

  return {
    isValid: true,
    cleanDigits: clean,
    formatted: formattedNational,
    formattedInternational,
    normalized: phone.trim().startsWith('+') ? formattedInternational : formattedNational,
  };
};

/**
 * Valide et normalise une plaque d'immatriculation tunisienne.
 *
 * Formats courants ordinaires :
 * - Série normale arabe : "123 تونس 4567" (1 à 3 chiffres, "تونس", 1 à 4 chiffres)
 * - Série normale latine : "123 TU 4567" ou "123-TU-4567"
 *
 * Formats historiques / spéciaux tolérés :
 * - Notation avec tiret : "200-4713"
 * - Ancienne série : "TU-1234" ou "TU 1234"
 * - Régimes spéciaux : "123456 RS", "1234 IT"
 *
 * Rejette les formats étrangers arbitraires (ex: AA-123-BB français, etc.).
 *
 * @param {string} plate
 * @returns {{ isValid: boolean, error?: string, normalized?: string }}
 */
export const validateTunisianPlate = (plate) => {
  if (!plate || typeof plate !== 'string' || !plate.trim()) {
    return {
      isValid: false,
      error: "L'immatriculation du véhicule est obligatoire.",
    };
  }

  // Normalisation des espaces et majuscules
  const trimmed = plate.trim().replace(/\s+/g, ' ');
  const upper = trimmed.toUpperCase();

  // 1. Format tunisien ordinaire arabe : "123 تونس 4567"
  const regexTunisArabe = /^(\d{1,3})\s*(?:تونس|\-تونس\-)\s*(\d{1,4})$/;
  const matchArabe = trimmed.match(regexTunisArabe);
  if (matchArabe) {
    const [, serie, num] = matchArabe;
    return {
      isValid: true,
      normalized: `${serie} تونس ${num}`,
      type: 'ORDINAIRE_ARABE',
    };
  }

  // 2. Format tunisien ordinaire latin : "123 TU 4567" ou "123-TU-4567" ou "180-TUN-5544"
  const regexTunisLatin = /^(\d{1,3})\s*[-]?\s*(TU|TUN)\s*[-]?\s*(\d{1,4})$/i;
  const matchLatin = upper.match(regexTunisLatin);
  if (matchLatin) {
    const [, serie, code, num] = matchLatin;
    return {
      isValid: true,
      normalized: `${serie} ${code.toUpperCase()} ${num}`,
      type: 'ORDINAIRE_LATIN',
    };
  }

  // 3. Format tunisien avec tiret numérique simple : "200-4713" ou "200 4713"
  const regexNumericDash = /^(\d{1,3})\s*[-]\s*(\d{1,4})$/;
  const matchNumeric = upper.match(regexNumericDash);
  if (matchNumeric) {
    const [, serie, num] = matchNumeric;
    return {
      isValid: true,
      normalized: `${serie}-${num}`,
      type: 'NUMERIQUE_TIRET',
    };
  }

  // 4. Ancienne série "TU-1234" ou "TU 1234"
  const regexAncientTU = /^TU\s*[-]?\s*(\d{1,5})$/i;
  const matchAncient = upper.match(regexAncientTU);
  if (matchAncient) {
    const [, num] = matchAncient;
    return {
      isValid: true,
      normalized: `TU-${num}`,
      type: 'ANCIEN_TU',
    };
  }

  // 5. Régime suspensif ou séries spéciales tunisiennes (RS, IT, CD, MD)
  const regexSpecial = /^(\d{1,6})\s*[-]?\s*(RS|IT|CD|CMD|MD)$/i;
  const matchSpecial = upper.match(regexSpecial);
  if (matchSpecial) {
    const [, num, code] = matchSpecial;
    return {
      isValid: true,
      normalized: `${num} ${code.toUpperCase()}`,
      type: 'SPECIAL_TUNISIE',
    };
  }

  return {
    isValid: false,
    error:
      "Format d'immatriculation tunisien requis (ex: 215 تونس 4589 ou 215 TU 4589). Les plaques étrangères ne sont pas admises.",
  };
};
