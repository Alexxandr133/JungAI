/** Русское склонение: 1 год, 2 года, 5 лет, 11 лет, 21 год… */
export function yearsWord(n: number): 'год' | 'года' | 'лет' {
  const abs = Math.abs(Math.trunc(n));
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'лет';
  if (mod10 === 1) return 'год';
  if (mod10 >= 2 && mod10 <= 4) return 'года';
  return 'лет';
}

/** «опыт 1 год» / «опыт 2 года» / «опыт 5 лет» */
export function formatExperienceYears(years: number): string {
  const n = Math.trunc(years);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `опыт ${n} ${yearsWord(n)}`;
}
