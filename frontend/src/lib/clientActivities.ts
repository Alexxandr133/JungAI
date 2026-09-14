/** Короткие карточки лектория (stub) */
export type LectureStub = {
  id: string;
  name: string;
  role: string;
  blurb: string;
};

export const LECTURE_STUBS: LectureStub[] = [
  {
    id: 'jung',
    name: 'Карл Густав Юнг',
    role: 'Аналитическая психология',
    blurb:
      'Ввёл понятия коллективного бессознательного, архетипов и индивидуации. Сны для Юнга — диалог с более глубокими слоями психики, а не «ошибка мозга».',
  },
  {
    id: 'frankl',
    name: 'Виктор Франкл',
    role: 'Логотерапия',
    blurb:
      'Смысл можно найти даже в страдании. Между стимулом и реакцией есть пространство выбора — это ядро логотерапии.',
  },
  {
    id: 'rogers',
    name: 'Карл Роджерс',
    role: 'Клиент-центрированная терапия',
    blurb:
      'Рост возможен в атмосфере принятия, эмпатии и подлинности. Человек стремится к актуализации, если условия безопасны.',
  },
];

export type ActivityLink = {
  id: string;
  title: string;
  hint: string;
  href: string;
  external?: boolean;
};

export const MEDITATION_LINKS: ActivityLink[] = [
  {
    id: 'calm-rain',
    title: 'Тихий дождь · фон',
    hint: 'Мягкий ambient для сосредоточения (YouTube)',
    href: 'https://www.youtube.com/watch?v=mPZkdNFkN9I',
    external: true,
  },
  {
    id: 'body-scan',
    title: 'Body scan · 10 мин',
    hint: 'Направленное внимание к телу (YouTube)',
    href: 'https://www.youtube.com/watch?v=ihvaVeKqGyY',
    external: true,
  },
];
