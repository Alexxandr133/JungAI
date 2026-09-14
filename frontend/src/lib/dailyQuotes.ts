export type DailyQuote = {
  text: string;
  author: string;
  source?: string;
};

export const DAILY_QUOTES: DailyQuote[] = [
  {
    text: 'Кто смотрит наружу — мечтает; кто смотрит внутрь — пробуждается.',
    author: 'Карл Густав Юнг',
    source: 'Воспоминания, сновидения, размышления',
  },
  {
    text: 'Сон — это маленький потайной ход в самых глубоких и сокровенных уголках души.',
    author: 'Карл Густав Юнг',
  },
  {
    text: 'Пока вы не сделаете бессознательное сознательным, оно будет руководить вашей жизнью, и вы назовёте это судьбой.',
    author: 'Карл Густав Юнг',
  },
  {
    text: 'Человек — это существо, которое стремится к смыслу.',
    author: 'Виктор Франкл',
    source: 'Человек в поисках смысла',
  },
  {
    text: 'Между стимулом и реакцией есть пространство. В этом пространстве — наша свобода.',
    author: 'Виктор Франкл',
  },
  {
    text: 'То, чему вы сопротивляетесь, сохраняется.',
    author: 'Карл Густав Юнг',
  },
  {
    text: 'Знание слов приводит к знаниям, знание дел приводит к мудрости.',
    author: 'Сократ',
  },
  {
    text: 'Несчастье человека происходит оттого, что он не умеет спокойно оставаться в своей комнате.',
    author: 'Блез Паскаль',
  },
  {
    text: 'Мы не то, что с нами случилось. Мы то, чем решили стать.',
    author: 'Карл Густав Юнг',
  },
  {
    text: 'Тревога — цена, которую мы платим за возможность выбора.',
    author: 'Сёрен Кьеркегор',
  },
  {
    text: 'Самое трудное — это стать тем, кем ты уже являешься.',
    author: 'Эрих Фромм',
  },
  {
    text: 'Только раненый целитель исцеляет.',
    author: 'Карл Густав Юнг',
  },
  {
    text: 'Принимайте себя: вы — единственный человек, с которым проживёте всю жизнь.',
    author: 'Карл Роджерс',
  },
  {
    text: 'Свобода — это то, что вы делаете с тем, что с вами сделали.',
    author: 'Жан-Поль Сартр',
  },
  {
    text: 'Тень — это то, чем человек не хочет быть.',
    author: 'Карл Густав Юнг',
  },
  {
    text: 'Познать себя — начало всякой мудрости.',
    author: 'Аристотель',
  },
];

export function quoteForToday(d = new Date()): DailyQuote {
  const start = new Date(d.getFullYear(), 0, 0).getTime();
  const day = Math.floor((d.getTime() - start) / 86400000);
  return DAILY_QUOTES[day % DAILY_QUOTES.length];
}

export function quoteSeenStorageKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `jungai_quote_seen_${y}-${m}-${day}`;
}

export function hasSeenTodaysQuote(): boolean {
  try {
    return localStorage.getItem(quoteSeenStorageKey()) === '1';
  } catch {
    return true;
  }
}

export function markTodaysQuoteSeen(): void {
  try {
    localStorage.setItem(quoteSeenStorageKey(), '1');
  } catch {
    /* ignore */
  }
}
