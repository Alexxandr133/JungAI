/** Страны / коды для телефона в профиле */
export const PHONE_COUNTRIES = [
  { code: 'RU', dial: '+7', flag: '🇷🇺', label: 'Россия', nationalLength: 10 },
  { code: 'KZ', dial: '+7', flag: '🇰🇿', label: 'Казахстан', nationalLength: 10 },
  { code: 'BY', dial: '+375', flag: '🇧🇾', label: 'Беларусь', nationalLength: 9 },
  { code: 'UA', dial: '+380', flag: '🇺🇦', label: 'Украина', nationalLength: 9 },
  { code: 'AM', dial: '+374', flag: '🇦🇲', label: 'Армения', nationalLength: 8 },
  { code: 'GE', dial: '+995', flag: '🇬🇪', label: 'Грузия', nationalLength: 9 },
  { code: 'UZ', dial: '+998', flag: '🇺🇿', label: 'Узбекистан', nationalLength: 9 },
  { code: 'KG', dial: '+996', flag: '🇰🇬', label: 'Кыргызстан', nationalLength: 9 },
  { code: 'TJ', dial: '+992', flag: '🇹🇯', label: 'Таджикистан', nationalLength: 9 },
  { code: 'MD', dial: '+373', flag: '🇲🇩', label: 'Молдова', nationalLength: 8 },
  { code: 'DE', dial: '+49', flag: '🇩🇪', label: 'Германия', nationalLength: 11 },
  { code: 'TR', dial: '+90', flag: '🇹🇷', label: 'Турция', nationalLength: 10 },
  { code: 'IL', dial: '+972', flag: '🇮🇱', label: 'Израиль', nationalLength: 9 },
  { code: 'US', dial: '+1', flag: '🇺🇸', label: 'США / Канада', nationalLength: 10 },
  { code: 'GB', dial: '+44', flag: '🇬🇧', label: 'Великобритания', nationalLength: 10 },
] as const;

export type PhoneCountryCode = (typeof PHONE_COUNTRIES)[number]['code'];

export function digitsOnly(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

/** Формат национального номера: (999) 123-45-67 или укороченные варианты */
export function formatNationalNumber(digits: string, maxLen: number): string {
  const d = digitsOnly(digits).slice(0, maxLen);
  if (!d) return '';
  if (maxLen >= 10) {
    // (XXX) XXX-XX-XX
    const a = d.slice(0, 3);
    const b = d.slice(3, 6);
    const c = d.slice(6, 8);
    const e = d.slice(8, 10);
    let out = a.length === 3 ? `(${a}` : a;
    if (a.length === 3) out += ')';
    if (b) out += (a.length === 3 ? ' ' : '') + b;
    if (c) out += '-' + c;
    if (e) out += '-' + e;
    return out;
  }
  // 9 цифр: (XX) XXX-XX-XX или XXX XXX-XXX
  if (maxLen === 9) {
    const a = d.slice(0, 2);
    const b = d.slice(2, 5);
    const c = d.slice(5, 7);
    const e = d.slice(7, 9);
    let out = a.length === 2 ? `(${a})` : a;
    if (b) out += ' ' + b;
    if (c) out += '-' + c;
    if (e) out += '-' + e;
    return out;
  }
  // 8 цифр: (XX) XXX-XXX
  const a = d.slice(0, 2);
  const b = d.slice(2, 5);
  const c = d.slice(5, 8);
  let out = a.length === 2 ? `(${a})` : a;
  if (b) out += ' ' + b;
  if (c) out += '-' + c;
  return out;
}

export function composePhone(dial: string, nationalDigits: string): string {
  const n = digitsOnly(nationalDigits);
  if (!n) return '';
  return `${dial}${n}`;
}

export function parseStoredPhone(raw: string | null | undefined): {
  countryCode: PhoneCountryCode;
  dial: string;
  nationalDigits: string;
} {
  const digits = digitsOnly(raw || '');
  if (!digits) {
    return { countryCode: 'RU', dial: '+7', nationalDigits: '' };
  }

  // longest dial match (without +)
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    const dialDigits = digitsOnly(c.dial);
    if (digits.startsWith(dialDigits)) {
      const national = digits.slice(dialDigits.length).slice(0, c.nationalLength);
      // Prefer RU over KZ when both +7 and length looks Russian
      if (c.code === 'KZ' && national.length === 10) {
        const ru = PHONE_COUNTRIES.find((x) => x.code === 'RU')!;
        return { countryCode: 'RU', dial: ru.dial, nationalDigits: national };
      }
      return { countryCode: c.code, dial: c.dial, nationalDigits: national };
    }
  }

  // fallback: treat as RU without country code (10 digits) or 11 starting with 8/7
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return { countryCode: 'RU', dial: '+7', nationalDigits: digits.slice(1) };
  }
  if (digits.length === 10) {
    return { countryCode: 'RU', dial: '+7', nationalDigits: digits };
  }
  return { countryCode: 'RU', dial: '+7', nationalDigits: digits.slice(0, 10) };
}

export function isPhoneComplete(_dial: string, nationalDigits: string, nationalLength: number): boolean {
  const n = digitsOnly(nationalDigits);
  if (!n) return true; // empty phone allowed
  return n.length === nationalLength;
}
