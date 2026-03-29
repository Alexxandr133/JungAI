/** Контент психологических тестов: вопросы, веса, подсчёт результатов */

export type SpiralLevelDef = {
  id: string;
  name: string;
  color: string;
  description: string;
};

export const SPIRAL_LEVEL_DEFS: SpiralLevelDef[] = [
  { id: 'beige', name: 'Выживание', color: '#D4A574', description: 'Базовые потребности, безопасность тела, минимальная рефлексия' },
  { id: 'purple', name: 'Племенной', color: '#9B59B6', description: 'Традиции, ритуалы, «свои» и «чужие», магическое мышление' },
  { id: 'red', name: 'Эгоцентричный', color: '#E74C3C', description: 'Сила, импульс, немедленное удовлетворение, статус «я первый»' },
  { id: 'blue', name: 'Абсолютистский', color: '#3498DB', description: 'Порядок, правила, долг, иерархия, «правильно/неправильно»' },
  { id: 'orange', name: 'Достигаторский', color: '#F39C12', description: 'Цели, эффективность, конкуренция, стратегия и успех' },
  { id: 'green', name: 'Коммунитарный', color: '#2ECC71', description: 'Гармония, мнения всех, забота, ценность отношений' },
  { id: 'yellow', name: 'Системный', color: '#F1C40F', description: 'Контекст, гибкость, интеграция моделей, функциональность' },
  { id: 'turquoise', name: 'Холистический', color: '#1ABC9C', description: 'Целостность, глобальная связность, экология смысла' }
];

export type SpiralQuestion = {
  id: number;
  text: string;
  options: string[];
  levels: string[];
};

/** 12 ситуационных вопросов; каждый ответ усиливает один уровень (индекс совпадает с options) */
export const SPIRAL_QUESTIONS: SpiralQuestion[] = [
  {
    id: 1,
    text: 'Когда вы в неопределённости, на что опираетесь в первую очередь?',
    options: [
      'На тело и базовую безопасность: еда, сон, «не навреди себе»',
      'На опыт старших, традиции, «как у нас принято»',
      'На силу воли: действую и пробиваю сопротивление',
      'На правила, долг и ясные инструкции',
      'На расчёт выгоды и план достижения цели',
      'На мнение близких и атмосферу в группе',
      'На несколько ракурсов сразу и готовность менять тактику',
      'На ощущение «как это вписывается во всё целое»'
    ],
    levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise']
  },
  {
    id: 2,
    text: 'Что для вас сильнее всего означает «я в порядке»?',
    options: [
      'Я жив и защищён',
      'Я принят в своём кругу',
      'Меня уважают и не давят',
      'Я поступаю честно по своим принципам',
      'Я двигаюсь к целям и вижу результат',
      'Со мной считаются и ко мне прислушиваются',
      'Я понимаю систему и адаптируюсь без потери себя',
      'Я чувствую связь с чем-то большим, чем я сам'
    ],
    levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise']
  },
  {
    id: 3,
    text: 'Конфликт на работе или в семье. Ваш типичный первый шаг?',
    options: [
      'Снижаю нагрузку, ухожу в безопасное место',
      'Ищу посредника из авторитетных для группы людей',
      'Наступаю или резко обозначаю границы',
      'Сверяюсь с правилами и справедливостью',
      'Оцениваю, что выгоднее и как переговорить',
      'Стараюсь помирить и снизить эмоциональный накал',
      'Выделяю интересы сторон и ищу рабочий синтез',
      'Смотрю, какой урок несёт ситуация для всех'
    ],
    levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise']
  },
  {
    id: 4,
    text: 'Как вы относитесь к ошибкам?',
    options: [
      'Как к угрозе — лучше не рисковать',
      'Как к нарушению «как положено» — стыдно перед другими',
      'Как к слабости — нельзя показывать',
      'Как к искушению — нужно исправиться и искупить',
      'Как к данным — анализирую и корректирую план',
      'Как к боли других — важно восстановить контакт',
      'Как к обратной связи системы',
      'Как к части процесса роста'
    ],
    levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise']
  },
  {
    id: 5,
    text: 'Что вас больше мотивирует в долгой перспективе?',
    options: [
      'Стабильность и предсказуемость',
      'Принадлежность и общая история',
      'Свобода действовать и влиять',
      'Служение высшему смыслу или долгу',
      'Рост, статус, признание мастерства',
      'Близость, доверие, взаимопомощь',
      'Понимание и совершенствование подходов',
      'Служение целому — людям, среде, идее'
    ],
    levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise']
  },
  {
    id: 6,
    text: 'Новые правила или реорганизация. Ваша реакция?',
    options: [
      'Тревога: выживу ли я в этом',
      'Смотрю, что скажут старшие/традиция',
      'Сопротивляюсь, если давят',
      'Изучаю регламент и легитимность',
      'Ищу возможности в изменениях',
      'Переживаю за людей и справедливость процесса',
      'Быстро перестраиваю модель поведения',
      'Ищу смысл перемен для всех уровней'
    ],
    levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise']
  },
  {
    id: 7,
    text: 'Как вы принимаете важное решение?',
    options: [
      'Инстинктивно, по ощущению тела',
      'Советуюсь с теми, кому доверяю традиционно',
      'Решаю быстро, опираясь на волю',
      'Сопоставляю с ценностями и нормами',
      'Считаю риски и выгоды',
      'Обсуждаю, чтобы никого не задеть',
      'Собираю несколько рамок и выбираю рабочую',
      '«Пробую на целостность» — бьётся ли с моей картиной мира'
    ],
    levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise']
  },
  {
    id: 8,
    text: 'Ваша позиция к «авторитету знания» (врач, учитель, эксперт)?',
    options: [
      'Доверяю, если чувствую заботу и безопасность',
      'Доверяю проверенным носителям традиции',
      'Проверяю силой или игнорирую',
      'Доверяю, если совпадает с моими принципами',
      'Сравниваю компетенции и результат',
      'Важно, как ко мне относятся в диалоге',
      'Оцениваю методологию и контекст применимости',
      'Вижу эксперта как часть большей системы'
    ],
    levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise']
  },
  {
    id: 9,
    text: 'Что сложнее всего переносить в жизни?',
    options: [
      'Хаос и угрозу ресурсам',
      'Одиночество и разрыв с «своими»',
      'Унижение и подчинение',
      'Беспринципность и произвол',
      'Неудачу и отставание',
      'Холодность и отчуждение',
      'Жёсткие однозначные ярлыки',
      'Раздробленность и потеря смысла'
    ],
    levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise']
  },
  {
    id: 10,
    text: 'Как вы обычно учитесь новому сложному навыку?',
    options: [
      'Малыми безопасными шагами',
      'В наставничестве, повторяя образец',
      'Методом проб, через практику',
      'По программе, шаг за шагом',
      'Ставлю цель и довожу до метрики',
      'В группе, с обменом опытом',
      'Собираю разные методы под себя',
      'Связываю с уже известными целостными моделями'
    ],
    levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise']
  },
  {
    id: 11,
    text: 'Идеальный отдых для вас — это…',
    options: [
      'Тело отдыхает, никаких задач',
      'Праздник, ритуал, общение «своих»',
      'Острые впечатления, свобода',
      'Порядок, предсказуемый распорядок',
      'Хобби с прогрессом или достижением',
      'Тёплое общение без конкуренции',
      'Интеллектуальная игра, новые связи идей',
      'Тишина, природа, ощущение единства'
    ],
    levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise']
  },
  {
    id: 12,
    text: 'Если представить «хорошее будущее» через 10 лет, что там главное?',
    options: [
      'Здоровье и покой',
      'Семья/община цела',
      'Я сильный и самостоятельный',
      'Я живу по совести и структуре',
      'Реализованные цели и статус',
      'Близкие отношения и мир вокруг',
      'Я гибок и востребован в разных ролях',
      'Мир и я — часть одного развивающегося целого'
    ],
    levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise']
  }
];

const SPIRAL_INTERPRETATIONS: Record<string, string> = {
  beige:
    'Сейчас в фокусе базовая безопасность и ресурс тела. Это естественно в стрессе или болезни. Задача — стабилизация, ритуалы заботы, минимизация перегруза.',
  purple:
    'Сильна потребность в принадлежности, традициях и «своём» круге. Ценны ритуалы и истории. Риск — изоляция от «чужих». Развитие — уважение к корням без тотального конформизма.',
  red:
    'Акцент на силе, границах и немедленном действии. Энергия и смелость — ресурс. Риск — импульсивность и конфликт. Развитие — направлять силу в цели и договорённости.',
  blue:
    'Опора на порядок, долг и ясные правила. Стабильность и предсказуемость важны. Риск — ригидность. Развитие — гибкость правил там, где контекст важнее формы.',
  orange:
    'Драйвер — цели, эффективность и личный успех. Хорошо для проектов и карьеры. Риск — выгорание и обесценивание «неэффективного». Развитие — смысл и отношения как цели, а не только метрики.',
  green:
    'Центр — гармония, эмпатия и учёт всех. Сильная сторона в команде и медиации. Риск — избегание жёстких решений. Развитие — зрелые границы и честный взрослый диалог.',
  yellow:
    'Системное мышление и гибкость моделей. Вы видите контексты и интегрируете подходы. Риск — интеллектуализация чувств. Развитие — воплощение инсайтов в простые шаги.',
  turquoise:
    'Чувствительность к целостности и глобальным связям. Сильная экология смысла. Риск — «растворение» в абстракции. Развитие — заземление в теле и конкретных отношениях.'
};

export type WeightedQuestion = {
  id: number;
  text: string;
  options: { text: string; weights: Record<string, number> }[];
};

/** Четыре опорных архетипа (упрощённо по Юнгу / практике коучинга) */
export const ARCHETYPE_QUESTIONS: WeightedQuestion[] = [
  {
    id: 1,
    text: 'Вызов требует немедленных действий. Ваш первый внутренний импульс?',
    options: [
      { text: 'Взять ответственность и повести за собой', weights: { hero: 3, sage: 0, creator: 1, caretaker: 0 } },
      { text: 'Остановиться и понять суть глубже', weights: { hero: 0, sage: 3, creator: 0, caretaker: 1 } },
      { text: 'Найти нестандартный ход или образ', weights: { hero: 1, sage: 1, creator: 3, caretaker: 0 } },
      { text: 'Проверить, кто пострадает, и поддержать', weights: { hero: 0, sage: 0, creator: 0, caretaker: 3 } }
    ]
  },
  {
    id: 2,
    text: 'Когда вы «в ресурсе», чем чаще делитесь?',
    options: [
      { text: 'Силой решений и примером', weights: { hero: 3, sage: 0, creator: 1, caretaker: 1 } },
      { text: 'Смыслом, анализом, вопросами', weights: { hero: 0, sage: 3, creator: 1, caretaker: 0 } },
      { text: 'Идеями, метафорами, красотой', weights: { hero: 0, sage: 1, creator: 3, caretaker: 0 } },
      { text: 'Заботой, вниманием, теплом', weights: { hero: 0, sage: 0, creator: 0, caretaker: 3 } }
    ]
  },
  {
    id: 3,
    text: 'Ваш главный страх в отношениях?',
    options: [
      { text: 'Потерять контроль или уважение', weights: { hero: 2, sage: 0, creator: 0, caretaker: 1 } },
      { text: 'Быть непонятым или обманутым в смысле', weights: { hero: 0, sage: 3, creator: 1, caretaker: 0 } },
      { text: 'Скучная рутина без творчества', weights: { hero: 1, sage: 0, creator: 3, caretaker: 0 } },
      { text: 'Быть обузой или остаться ненужным', weights: { hero: 0, sage: 0, creator: 0, caretaker: 3 } }
    ]
  },
  {
    id: 4,
    text: 'Как вы переживаете критику?',
    options: [
      { text: 'Сжимаюсь, но стараюсь доказать силу', weights: { hero: 3, sage: 1, creator: 0, caretaker: 0 } },
      { text: 'Разбираю аргументы и ищу истину', weights: { hero: 0, sage: 3, creator: 0, caretaker: 0 } },
      { text: 'Чувствую, что меня не видят целиком', weights: { hero: 0, sage: 1, creator: 3, caretaker: 1 } },
      { text: 'Больно за отношения и доверие', weights: { hero: 0, sage: 0, creator: 0, caretaker: 3 } }
    ]
  },
  {
    id: 5,
    text: 'Что вас больше восстанавливает после усталости?',
    options: [
      { text: 'Победа, спорт, ясный результат', weights: { hero: 3, sage: 0, creator: 1, caretaker: 0 } },
      { text: 'Книга, тишина, размышление', weights: { hero: 0, sage: 3, creator: 1, caretaker: 0 } },
      { text: 'Музыка, проект, что-то создать руками', weights: { hero: 0, sage: 0, creator: 3, caretaker: 0 } },
      { text: 'Разговор по душам, объятия, помощь другому', weights: { hero: 0, sage: 0, creator: 0, caretaker: 3 } }
    ]
  },
  {
    id: 6,
    text: 'В группе вы чаще…',
    options: [
      { text: 'Беру инициативу и структуру', weights: { hero: 3, sage: 0, creator: 1, caretaker: 1 } },
      { text: 'Замечаю смыслы и связи', weights: { hero: 0, sage: 3, creator: 0, caretaker: 0 } },
      { text: 'Предлагаю необычный угол', weights: { hero: 0, sage: 1, creator: 3, caretaker: 0 } },
      { text: 'Слежу за атмосферой и людьми', weights: { hero: 0, sage: 0, creator: 0, caretaker: 3 } }
    ]
  },
  {
    id: 7,
    text: 'Ваш «внутренний идеал» в двух словах?',
    options: [
      { text: 'Смелость и честь', weights: { hero: 3, sage: 1, creator: 0, caretaker: 0 } },
      { text: 'Ясность и мудрость', weights: { hero: 0, sage: 3, creator: 0, caretaker: 0 } },
      { text: 'Свобода и оригинальность', weights: { hero: 1, sage: 0, creator: 3, caretaker: 0 } },
      { text: 'Тепло и надёжность', weights: { hero: 0, sage: 0, creator: 0, caretaker: 3 } }
    ]
  },
  {
    id: 8,
    text: 'Когда вы злитесь, чаще всего…',
    options: [
      { text: 'Давлю или взрываюсь', weights: { hero: 3, sage: 0, creator: 1, caretaker: 0 } },
      { text: 'Отстраняюсь и анализирую', weights: { hero: 0, sage: 3, creator: 0, caretaker: 0 } },
      { text: 'Ухожу в иронию или творчество', weights: { hero: 1, sage: 0, creator: 3, caretaker: 0 } },
      { text: 'Плачу или замыкаюсь в себе', weights: { hero: 0, sage: 0, creator: 0, caretaker: 3 } }
    ]
  },
  {
    id: 9,
    text: 'Что для вас «успешная жизнь»?',
    options: [
      { text: 'Преодолеть и реализовать потенциал', weights: { hero: 3, sage: 1, creator: 1, caretaker: 0 } },
      { text: 'Понять себя и мир', weights: { hero: 0, sage: 3, creator: 1, caretaker: 0 } },
      { text: 'Создать что-то своё', weights: { hero: 1, sage: 0, creator: 3, caretaker: 0 } },
      { text: 'Любить и быть любимым', weights: { hero: 0, sage: 0, creator: 0, caretaker: 3 } }
    ]
  },
  {
    id: 10,
    text: 'В детстве вас чаще хвалили за…',
    options: [
      { text: 'Смелость, стойкость, лидерство', weights: { hero: 3, sage: 0, creator: 0, caretaker: 1 } },
      { text: 'Ум, вопросы, успехи в учёбе', weights: { hero: 0, sage: 3, creator: 1, caretaker: 0 } },
      { text: 'Фантазию, рисунки, необычные ответы', weights: { hero: 0, sage: 1, creator: 3, caretaker: 0 } },
      { text: 'Помощь, послушание, заботу', weights: { hero: 0, sage: 0, creator: 0, caretaker: 3 } }
    ]
  },
  {
    id: 11,
    text: 'Перед неизвестным будущим вы…',
    options: [
      { text: 'Настраиваюсь бороться', weights: { hero: 3, sage: 0, creator: 1, caretaker: 0 } },
      { text: 'Ищу информацию и смысл', weights: { hero: 0, sage: 3, creator: 0, caretaker: 0 } },
      { text: 'Интересуюсь, что можно придумать', weights: { hero: 1, sage: 1, creator: 3, caretaker: 0 } },
      { text: 'Ищу опору в близких', weights: { hero: 0, sage: 0, creator: 0, caretaker: 3 } }
    ]
  },
  {
    id: 12,
    text: 'Какой подарок вам приятнее?',
    options: [
      { text: 'Символ достижения', weights: { hero: 3, sage: 0, creator: 0, caretaker: 0 } },
      { text: 'Книга или курс', weights: { hero: 0, sage: 3, creator: 1, caretaker: 0 } },
      { text: 'Что-то уникальное, ручная работа', weights: { hero: 0, sage: 0, creator: 3, caretaker: 0 } },
      { text: 'Время вместе, забота', weights: { hero: 0, sage: 0, creator: 0, caretaker: 3 } }
    ]
  },
  {
    id: 13,
    text: 'Ваш типичный внутренний диалог при ошибке?',
    options: [
      { text: '«Надо исправить и показать, что я могу»', weights: { hero: 3, sage: 1, creator: 0, caretaker: 0 } },
      { text: '«Чему это учит?»', weights: { hero: 0, sage: 3, creator: 1, caretaker: 0 } },
      { text: '«Как бы это переиграть иначе»', weights: { hero: 1, sage: 0, creator: 3, caretaker: 0 } },
      { text: '«Я подвёл людей»', weights: { hero: 0, sage: 0, creator: 0, caretaker: 3 } }
    ]
  },
  {
    id: 14,
    text: 'Что вы цените в наставнике?',
    options: [
      { text: 'Силу характера и пример', weights: { hero: 3, sage: 1, creator: 0, caretaker: 0 } },
      { text: 'Глубину и честность мысли', weights: { hero: 0, sage: 3, creator: 0, caretaker: 0 } },
      { text: 'Вдохновение и свободу', weights: { hero: 0, sage: 1, creator: 3, caretaker: 0 } },
      { text: 'Тепло и принятие', weights: { hero: 0, sage: 0, creator: 0, caretaker: 3 } }
    ]
  },
  {
    id: 15,
    text: 'В стрессе вы скорее…',
    options: [
      { text: 'Ускоряетесь и давите', weights: { hero: 3, sage: 0, creator: 1, caretaker: 0 } },
      { text: 'Замираете и анализируете', weights: { hero: 0, sage: 3, creator: 0, caretaker: 0 } },
      { text: 'Уходите в отвлечение или фантазию', weights: { hero: 0, sage: 1, creator: 3, caretaker: 1 } },
      { text: 'Ищете поддержку', weights: { hero: 0, sage: 0, creator: 0, caretaker: 3 } }
    ]
  },
  {
    id: 16,
    text: 'Если бы вы были архетипом из мифа, кто ближе?',
    options: [
      { text: 'Воин, король, защитник', weights: { hero: 3, sage: 0, creator: 0, caretaker: 1 } },
      { text: 'Мудрец, отшельник, философ', weights: { hero: 0, sage: 3, creator: 0, caretaker: 0 } },
      { text: 'Трикстер, художник, изобретатель', weights: { hero: 0, sage: 0, creator: 3, caretaker: 0 } },
      { text: 'Мать/отец, целитель, хранитель очага', weights: { hero: 0, sage: 0, creator: 0, caretaker: 3 } }
    ]
  }
];

export const ARCHETYPE_LABELS: Record<string, { name: string; description: string; hint: string }> = {
  hero: {
    name: 'Герой / Воин',
    description: 'Движущая сила — действие, ответственность, преодоление. Вы чувствуете жизнь через вызов и вклад.',
    hint: 'Следите за выгоранием и «доказательством силы». Позвольте себе уязвимость без потери достоинства.'
  },
  sage: {
    name: 'Мудрец',
    description: 'Движущая сила — понимание, смысл, рефлексия. Вы цените истину глубже признания.',
    hint: 'Не застревайте только в анализе: воплощайте инсайт в маленький шаг в реальном мире.'
  },
  creator: {
    name: 'Созидатель',
    description: 'Движущая сила — образ, оригинальность, эксперимент. Вам важно быть собой, а не копией.',
    hint: 'Завершайте проекты и делитесь результатом — иначе творчество остаётся только в голове.'
  },
  caretaker: {
    name: 'Опекун',
    description: 'Движущая сила — забота, связь, поддержка. Вы чувствуете мир через отношения.',
    hint: 'Помните про свои границы: забота без «я» ведёт к истощению.'
  }
};

/** Тень: темы самонаблюдения (не диагноз) */
export const SHADOW_QUESTIONS: WeightedQuestion[] = [
  {
    id: 1,
    text: 'Как часто вы замечаете, что раздражаетесь на людей «как на себя»?',
    options: [
      { text: 'Почти никогда', weights: { projection: 0, shame: 0, control: 0, avoidance: 0 } },
      { text: 'Иногда', weights: { projection: 1, shame: 0, control: 0, avoidance: 0 } },
      { text: 'Часто', weights: { projection: 2, shame: 0, control: 0, avoidance: 0 } },
      { text: 'Очень часто, это заметный паттерн', weights: { projection: 3, shame: 0, control: 0, avoidance: 0 } }
    ]
  },
  {
    id: 2,
    text: 'Стыд «я недостаточно хорош» без объективной катастрофы',
    options: [
      { text: 'Редко', weights: { projection: 0, shame: 0, control: 0, avoidance: 0 } },
      { text: 'Бывает', weights: { projection: 0, shame: 1, control: 0, avoidance: 0 } },
      { text: 'Часто фоном', weights: { projection: 0, shame: 2, control: 0, avoidance: 0 } },
      { text: 'Парализует решения', weights: { projection: 0, shame: 3, control: 0, avoidance: 0 } }
    ]
  },
  {
    id: 3,
    text: 'Потребность всё контролировать, иначе тревога',
    options: [
      { text: 'Слабо выражена', weights: { projection: 0, shame: 0, control: 0, avoidance: 0 } },
      { text: 'Умеренно', weights: { projection: 0, shame: 0, control: 1, avoidance: 0 } },
      { text: 'Сильно', weights: { projection: 0, shame: 0, control: 2, avoidance: 0 } },
      { text: 'Доминирует', weights: { projection: 0, shame: 0, control: 3, avoidance: 0 } }
    ]
  },
  {
    id: 4,
    text: 'Избегание близости или важных разговоров',
    options: [
      { text: 'Редко', weights: { projection: 0, shame: 0, control: 0, avoidance: 0 } },
      { text: 'Иногда', weights: { projection: 0, shame: 0, control: 0, avoidance: 1 } },
      { text: 'Часто', weights: { projection: 0, shame: 0, control: 0, avoidance: 2 } },
      { text: 'Систематически', weights: { projection: 0, shame: 0, control: 0, avoidance: 3 } }
    ]
  },
  {
    id: 5,
    text: 'Зависть или сравнение «у других правильнее жизнь»',
    options: [
      { text: 'Почти нет', weights: { projection: 1, shame: 1, control: 0, avoidance: 0 } },
      { text: 'Иногда', weights: { projection: 1, shame: 1, control: 0, avoidance: 0 } },
      { text: 'Часто', weights: { projection: 2, shame: 2, control: 0, avoidance: 0 } },
      { text: 'Захватывает мысли', weights: { projection: 2, shame: 3, control: 0, avoidance: 0 } }
    ]
  },
  {
    id: 6,
    text: 'Гнев, который вы не выражаете, а копите',
    options: [
      { text: 'Редко', weights: { projection: 0, shame: 0, control: 1, avoidance: 0 } },
      { text: 'Иногда', weights: { projection: 0, shame: 1, control: 1, avoidance: 1 } },
      { text: 'Часто', weights: { projection: 1, shame: 1, control: 2, avoidance: 1 } },
      { text: 'Взрывается с задержкой', weights: { projection: 2, shame: 2, control: 2, avoidance: 2 } }
    ]
  },
  {
    id: 7,
    text: 'Перфекционизм: «если не идеально — не считается»',
    options: [
      { text: 'Не про меня', weights: { projection: 0, shame: 0, control: 0, avoidance: 0 } },
      { text: 'Иногда', weights: { projection: 0, shame: 1, control: 2, avoidance: 0 } },
      { text: 'Часто', weights: { projection: 0, shame: 2, control: 2, avoidance: 1 } },
      { text: 'Постоянно', weights: { projection: 0, shame: 3, control: 3, avoidance: 1 } }
    ]
  },
  {
    id: 8,
    text: 'Чувство, что вас «не видят настоящего»',
    options: [
      { text: 'Редко', weights: { projection: 0, shame: 1, control: 0, avoidance: 0 } },
      { text: 'Бывает', weights: { projection: 1, shame: 1, control: 0, avoidance: 1 } },
      { text: 'Часто', weights: { projection: 2, shame: 2, control: 0, avoidance: 1 } },
      { text: 'Центральная боль', weights: { projection: 2, shame: 3, control: 0, avoidance: 2 } }
    ]
  },
  {
    id: 9,
    text: 'Обесценивание своих потребностей ради других',
    options: [
      { text: 'Редко', weights: { projection: 0, shame: 0, control: 0, avoidance: 0 } },
      { text: 'Иногда', weights: { projection: 0, shame: 1, control: 0, avoidance: 1 } },
      { text: 'Часто', weights: { projection: 0, shame: 2, control: 1, avoidance: 1 } },
      { text: 'Автоматически', weights: { projection: 0, shame: 2, control: 1, avoidance: 2 } }
    ]
  },
  {
    id: 10,
    text: 'Тревога, когда нет плана на ближайшие часы',
    options: [
      { text: 'Нет', weights: { projection: 0, shame: 0, control: 0, avoidance: 0 } },
      { text: 'Лёгкая', weights: { projection: 0, shame: 0, control: 1, avoidance: 0 } },
      { text: 'Заметная', weights: { projection: 0, shame: 0, control: 2, avoidance: 1 } },
      { text: 'Сильная', weights: { projection: 0, shame: 1, control: 3, avoidance: 1 } }
    ]
  },
  {
    id: 11,
    text: 'Самокритика грубее, чем то, что вы сказали бы другу',
    options: [
      { text: 'Нет', weights: { projection: 0, shame: 0, control: 0, avoidance: 0 } },
      { text: 'Иногда', weights: { projection: 0, shame: 1, control: 1, avoidance: 0 } },
      { text: 'Часто', weights: { projection: 0, shame: 3, control: 1, avoidance: 0 } },
      { text: 'Постоянно', weights: { projection: 0, shame: 3, control: 2, avoidance: 0 } }
    ]
  },
  {
    id: 12,
    text: '«Если я ослаблюсь — всё рухнет»',
    options: [
      { text: 'Не думаю так', weights: { projection: 0, shame: 0, control: 0, avoidance: 0 } },
      { text: 'Иногда', weights: { projection: 0, shame: 1, control: 2, avoidance: 0 } },
      { text: 'Часто', weights: { projection: 0, shame: 2, control: 3, avoidance: 1 } },
      { text: 'Основная установка', weights: { projection: 0, shame: 2, control: 3, avoidance: 2 } }
    ]
  },
  {
    id: 13,
    text: 'Обвинение других в своём настроении без проверки фактов',
    options: [
      { text: 'Редко', weights: { projection: 1, shame: 0, control: 0, avoidance: 0 } },
      { text: 'Иногда', weights: { projection: 2, shame: 0, control: 0, avoidance: 0 } },
      { text: 'Часто', weights: { projection: 3, shame: 0, control: 0, avoidance: 0 } },
      { text: 'Паттерн', weights: { projection: 3, shame: 1, control: 0, avoidance: 0 } }
    ]
  },
  {
    id: 14,
    text: 'Страх быть отвергнутым, если покажу слабость',
    options: [
      { text: 'Слабый', weights: { projection: 0, shame: 1, control: 0, avoidance: 1 } },
      { text: 'Умеренный', weights: { projection: 1, shame: 2, control: 0, avoidance: 1 } },
      { text: 'Сильный', weights: { projection: 1, shame: 3, control: 1, avoidance: 2 } },
      { text: 'Определяет поведение', weights: { projection: 2, shame: 3, control: 1, avoidance: 2 } }
    ]
  },
  {
    id: 15,
    text: 'Работа/учёба как способ не чувствовать',
    options: [
      { text: 'Не про меня', weights: { projection: 0, shame: 0, control: 0, avoidance: 1 } },
      { text: 'Иногда', weights: { projection: 0, shame: 1, control: 1, avoidance: 2 } },
      { text: 'Часто', weights: { projection: 0, shame: 1, control: 2, avoidance: 2 } },
      { text: 'Основной ход', weights: { projection: 0, shame: 2, control: 2, avoidance: 3 } }
    ]
  },
  {
    id: 16,
    text: 'Ощущение «я притворясь взрослым/нормальным»',
    options: [
      { text: 'Нет', weights: { projection: 0, shame: 0, control: 0, avoidance: 0 } },
      { text: 'Иногда', weights: { projection: 1, shame: 2, control: 0, avoidance: 1 } },
      { text: 'Часто', weights: { projection: 1, shame: 3, control: 0, avoidance: 2 } },
      { text: 'Почти всегда', weights: { projection: 2, shame: 3, control: 0, avoidance: 2 } }
    ]
  }
];

export const SHADOW_THEME_COPY: Record<string, { title: string; text: string }> = {
  projection: {
    title: 'Проекция и «чужие» качества',
    text: 'То, что сильно раздражает в других, часто указывает на непринятые части себя. Практика: мягко спросить себя: «Что здесь про меня?» без самообвинения.'
  },
  shame: {
    title: 'Стыд и самооценка',
    text: 'Стыд сжимает и мешает действовать. Разделяйте поведение и ценность личности. Маленькие шаги самосострадания часто эффективнее жёсткой дисциплины.'
  },
  control: {
    title: 'Контроль и тревога',
    text: 'Контроль даёт иллюзию безопасности. Ищите, где можно доверять процессу и людям — пусть даже частично.'
  },
  avoidance: {
    title: 'Избегание и дистанция',
    text: 'Избегание снижает боль сейчас, но дорожает со временем. Микрошаги к открытости безопаснее, чем резкое «вываливание» всего.'
  }
};

/** Упрощённый опросник по драйверам К. Кейпа и эго-состояниям (ТА) */
export const PERSONALITY_QUESTIONS: WeightedQuestion[] = [
  {
    id: 1,
    text: 'Под дедлайном я чаще всего…',
    options: [
      { text: 'Ускоряюсь и нервничаю', weights: { hurry: 3, perfect: 1, please: 0, strong: 0, tryhard: 1 } },
      { text: 'Переделываю, пока не «идеально»', weights: { hurry: 0, perfect: 3, please: 0, strong: 0, tryhard: 2 } },
      { text: 'Соглашаюсь на лишнее, лишь бы не конфликтовать', weights: { hurry: 1, perfect: 0, please: 3, strong: 0, tryhard: 0 } },
      { text: 'Делаю вид, что всё под контролем', weights: { hurry: 0, perfect: 1, please: 0, strong: 3, tryhard: 0 } },
      { text: 'Берусь за слишком много сразу', weights: { hurry: 1, perfect: 0, please: 0, strong: 0, tryhard: 3 } }
    ]
  },
  {
    id: 2,
    text: 'Как звучит внутренний критик?',
    options: [
      { text: '«Быстрее! Опоздаешь!»', weights: { hurry: 3, perfect: 0, please: 0, strong: 0, tryhard: 0 } },
      { text: '«Это недостаточно хорошо»', weights: { hurry: 0, perfect: 3, please: 1, strong: 0, tryhard: 1 } },
      { text: '«Не подведи людей»', weights: { hurry: 0, perfect: 0, please: 3, strong: 0, tryhard: 0 } },
      { text: '«Не слабей, держись»', weights: { hurry: 0, perfect: 0, please: 0, strong: 3, tryhard: 0 } },
      { text: '«Ты мог бы больше стараться»', weights: { hurry: 0, perfect: 1, please: 0, strong: 0, tryhard: 3 } }
    ]
  },
  {
    id: 3,
    text: 'В детстве взрослые чаще требовали…',
    options: [
      { text: 'Быть собранным и пунктуальным', weights: { hurry: 3, perfect: 1, please: 0, strong: 0, tryhard: 0 } },
      { text: 'Быть примером и без ошибок', weights: { hurry: 0, perfect: 3, please: 1, strong: 0, tryhard: 1 } },
      { text: 'Быть послушным и удобным', weights: { hurry: 0, perfect: 0, please: 3, strong: 0, tryhard: 0 } },
      { text: 'Не ныть и не показывать слабость', weights: { hurry: 0, perfect: 0, please: 0, strong: 3, tryhard: 1 } },
      { text: 'Стараться изо всех сил', weights: { hurry: 0, perfect: 1, please: 1, strong: 0, tryhard: 3 } }
    ]
  },
  {
    id: 4,
    text: 'Когда отдыхаете, чувство вины…',
    options: [
      { text: '«Теряю время»', weights: { hurry: 3, perfect: 1, please: 0, strong: 0, tryhard: 1 } },
      { text: '«Мог бы продуктивнее»', weights: { hurry: 1, perfect: 2, please: 0, strong: 0, tryhard: 2 } },
      { text: '«Другим я нужен»', weights: { hurry: 0, perfect: 0, please: 3, strong: 0, tryhard: 0 } },
      { text: '«Нельзя расслабляться»', weights: { hurry: 0, perfect: 0, please: 0, strong: 3, tryhard: 0 } },
      { text: '«Я недостаточно заслужил отдых»', weights: { hurry: 0, perfect: 2, please: 1, strong: 0, tryhard: 2 } }
    ]
  },
  {
    id: 5,
    text: 'В конфликте я скорее…',
    options: [
      { text: 'Давлю темпом', weights: { hurry: 2, perfect: 0, please: 0, strong: 2, tryhard: 0 } },
      { text: 'Доказываю правоту', weights: { hurry: 0, perfect: 2, please: 0, strong: 1, tryhard: 1 } },
      { text: 'Уступаю ради мира', weights: { hurry: 0, perfect: 0, please: 3, strong: 0, tryhard: 0 } },
      { text: 'Отстраняюсь холодно', weights: { hurry: 0, perfect: 0, please: 0, strong: 3, tryhard: 0 } },
      { text: 'Объясняюсь слишком много', weights: { hurry: 0, perfect: 1, please: 2, strong: 0, tryhard: 2 } }
    ]
  },
  {
    id: 6,
    text: 'Моя позиция к правилам…',
    options: [
      { text: 'Важна скорость выполнения', weights: { hurry: 3, perfect: 1, please: 0, strong: 0, tryhard: 0 } },
      { text: 'Важно сделать «как надо»', weights: { hurry: 0, perfect: 3, please: 0, strong: 0, tryhard: 1 } },
      { text: 'Важно, чтобы всем было комфортно', weights: { hurry: 0, perfect: 0, please: 3, strong: 0, tryhard: 0 } },
      { text: 'Важно не показать слабину', weights: { hurry: 0, perfect: 0, please: 0, strong: 3, tryhard: 0 } },
      { text: 'Важно стараться сверх нормы', weights: { hurry: 0, perfect: 1, please: 0, strong: 0, tryhard: 3 } }
    ]
  },
  {
    id: 7,
    text: 'Когда хвалят, внутри…',
    options: [
      { text: '«Надо оправдать ожидания дальше»', weights: { hurry: 1, perfect: 2, please: 1, strong: 0, tryhard: 2 } },
      { text: '«Наверное, просто повезло»', weights: { hurry: 0, perfect: 2, please: 2, strong: 0, tryhard: 1 } },
      { text: 'Радость и стыд одновременно', weights: { hurry: 0, perfect: 1, please: 2, strong: 1, tryhard: 1 } },
      { text: '«Не привык к похвале»', weights: { hurry: 0, perfect: 0, please: 0, strong: 3, tryhard: 0 } },
      { text: '«Мог бы лучше»', weights: { hurry: 0, perfect: 2, please: 0, strong: 0, tryhard: 3 } }
    ]
  },
  {
    id: 8,
    text: 'Мотивация в работе ближе к…',
    options: [
      { text: 'Дедлайнам и динамике', weights: { hurry: 3, perfect: 0, please: 0, strong: 0, tryhard: 0 } },
      { text: 'Качеству и стандартам', weights: { hurry: 0, perfect: 3, please: 0, strong: 0, tryhard: 1 } },
      { text: 'Команде и признанию', weights: { hurry: 0, perfect: 0, please: 3, strong: 0, tryhard: 0 } },
      { text: 'Выдержке и выносливости', weights: { hurry: 0, perfect: 0, please: 0, strong: 3, tryhard: 0 } },
      { text: '«Выложиться на максимум»', weights: { hurry: 1, perfect: 1, please: 0, strong: 0, tryhard: 3 } }
    ]
  },
  {
    id: 9,
    text: 'Если планы срываются…',
    options: [
      { text: 'Паника по времени', weights: { hurry: 3, perfect: 1, please: 0, strong: 0, tryhard: 0 } },
      { text: 'Ищу виноватых или себя казню', weights: { hurry: 1, perfect: 3, please: 1, strong: 0, tryhard: 1 } },
      { text: 'Извиняюсь даже если не виноват', weights: { hurry: 0, perfect: 0, please: 3, strong: 0, tryhard: 0 } },
      { text: 'Замыкаюсь и терплю', weights: { hurry: 0, perfect: 0, please: 1, strong: 3, tryhard: 0 } },
      { text: 'Берусь исправить всё сам', weights: { hurry: 1, perfect: 1, please: 0, strong: 1, tryhard: 3 } }
    ]
  },
  {
    id: 10,
    text: 'Фраза, которую вы часто говорите другим или себе…',
    options: [
      { text: '«Быстрее»', weights: { hurry: 3, perfect: 0, please: 0, strong: 0, tryhard: 0 } },
      { text: '«Надо идеально»', weights: { hurry: 0, perfect: 3, please: 0, strong: 0, tryhard: 1 } },
      { text: '«Как вам удобнее»', weights: { hurry: 0, perfect: 0, please: 3, strong: 0, tryhard: 0 } },
      { text: '«Я справлюсь сам»', weights: { hurry: 0, perfect: 0, please: 0, strong: 3, tryhard: 0 } },
      { text: '«Постараюсь ещё сильнее»', weights: { hurry: 0, perfect: 1, please: 0, strong: 0, tryhard: 3 } }
    ]
  },
  {
    id: 11,
    text: 'Близость для меня…',
    options: [
      { text: 'Требует времени, которого нет', weights: { hurry: 3, perfect: 0, please: 1, strong: 0, tryhard: 0 } },
      { text: 'Риск ошибиться словом', weights: { hurry: 0, perfect: 2, please: 2, strong: 0, tryhard: 0 } },
      { text: 'Важнее гармонии, чем правды', weights: { hurry: 0, perfect: 0, please: 3, strong: 0, tryhard: 0 } },
      { text: 'Показывать слабость нельзя', weights: { hurry: 0, perfect: 0, please: 0, strong: 3, tryhard: 0 } },
      { text: 'Нужно «заслужить»', weights: { hurry: 0, perfect: 1, please: 1, strong: 0, tryhard: 3 } }
    ]
  },
  {
    id: 12,
    text: 'Что вы чувствуете, когда ничего не делаете полдня?',
    options: [
      { text: 'Тревогу и беспокойство', weights: { hurry: 3, perfect: 1, please: 0, strong: 0, tryhard: 1 } },
      { text: 'Вину за «пустую трату жизни»', weights: { hurry: 1, perfect: 2, please: 0, strong: 0, tryhard: 2 } },
      { text: '«Надо кому-то помочь»', weights: { hurry: 0, perfect: 0, please: 3, strong: 0, tryhard: 0 } },
      { text: 'Раздражение на себя', weights: { hurry: 0, perfect: 1, please: 0, strong: 3, tryhard: 1 } },
      { text: '«Я ленюсь»', weights: { hurry: 1, perfect: 1, please: 0, strong: 0, tryhard: 3 } }
    ]
  }
];

export const DRIVER_LABELS: Record<string, { name: string; description: string }> = {
  hurry: {
    name: 'Торопись',
    description: 'Внутренний импульс скорости и страх опоздать в жизни. Энергия есть, но отдых и глубина страдают.'
  },
  perfect: {
    name: 'Будь идеальным',
    description: 'Высокая планка и самокритика. Качество — сила, но «достаточно хорошо» воспринимается как провал.'
  },
  please: {
    name: 'Радуй других',
    description: 'Чувствительность к настроению других и страх разочаровать. Гармония ценой своих границ.'
  },
  strong: {
    name: 'Будь сильным',
    description: 'Запрет на уязвимость. Самоценность через выдержку; чувства часто прячутся за контролем.'
  },
  tryhard: {
    name: 'Старайся изо всех сил',
    description: 'Усилие как главная валюта. Сложно признать, что уже достаточно; выгорание рядом.'
  }
};

/** Подписи к сырым ключам в таблице баллов (тень) */
export const SHADOW_SCORE_LABELS_RU: Record<string, string> = {
  projection: 'Проекция',
  shame: 'Стыд',
  control: 'Контроль',
  avoidance: 'Избегание'
};

const ARCHETYPE_SCORE_ORDER = ['hero', 'sage', 'creator', 'caretaker'] as const;
const SHADOW_SCORE_ORDER = ['projection', 'shame', 'control', 'avoidance'] as const;
const DRIVER_SCORE_ORDER = ['hurry', 'perfect', 'please', 'strong', 'tryhard'] as const;

/** Русская подпись для строки «баллы по ключам» в итогах */
export function scoreRowLabelRu(
  testType: 'archetype' | 'shadow' | 'personality' | 'spiral-dynamics',
  key: string
): string {
  switch (testType) {
    case 'archetype':
      return ARCHETYPE_LABELS[key]?.name ?? key;
    case 'shadow':
      return SHADOW_SCORE_LABELS_RU[key] ?? key;
    case 'personality':
      return DRIVER_LABELS[key]?.name ?? key;
    case 'spiral-dynamics':
      return SPIRAL_LEVEL_DEFS.find((d) => d.id === key)?.name ?? key;
    default:
      return key;
  }
}

export function orderedScoreEntries(
  testType: 'archetype' | 'shadow' | 'personality',
  scores: Record<string, number>
): { key: string; value: number; label: string }[] {
  const order =
    testType === 'archetype'
      ? ARCHETYPE_SCORE_ORDER
      : testType === 'shadow'
        ? SHADOW_SCORE_ORDER
        : DRIVER_SCORE_ORDER;
  return order.map((key) => ({
    key,
    value: scores[key] ?? 0,
    label: scoreRowLabelRu(testType, key)
  }));
}

export type SpiralLevelResult = SpiralLevelDef & { score: number };

export function scoreSpiral(
  answers: Record<number, number>,
  questions: SpiralQuestion[],
  defs: SpiralLevelDef[]
): { levels: SpiralLevelResult[]; dominantLevel: SpiralLevelResult; interpretation: string } {
  const levelScores: Record<string, number> = {};
  defs.forEach((d) => {
    levelScores[d.id] = 0;
  });
  questions.forEach((q) => {
    const idx = answers[q.id];
    if (idx === undefined || idx < 0) return;
    const level = q.levels[idx];
    if (level) levelScores[level] = (levelScores[level] || 0) + 1;
  });
  const levels: SpiralLevelResult[] = defs.map((d) => ({
    ...d,
    score: levelScores[d.id] || 0
  }));
  const dominantLevel = levels.reduce((a, b) => (a.score >= b.score ? a : b), levels[0]);
  const interpretation =
    SPIRAL_INTERPRETATIONS[dominantLevel.id] || 'Ваш профиль разнообразен; опирайтесь на два-три наиболее набранных уровня.';
  return { levels, dominantLevel, interpretation };
}

function scoreWeightedQuestions(
  answers: Record<number, number>,
  questions: WeightedQuestion[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  questions.forEach((q) => {
    const oi = answers[q.id];
    if (oi === undefined || oi < 0 || !q.options[oi]) return;
    const w = q.options[oi].weights;
    Object.entries(w).forEach(([k, v]) => {
      totals[k] = (totals[k] || 0) + v;
    });
  });
  return totals;
}

export function scoreArchetype(answers: Record<number, number>) {
  const scores = scoreWeightedQuestions(answers, ARCHETYPE_QUESTIONS);
  const keys = ['hero', 'sage', 'creator', 'caretaker'] as const;
  let dominant: (typeof keys)[number] = 'hero';
  let best = -1;
  keys.forEach((k) => {
    const s = scores[k] || 0;
    if (s > best) {
      best = s;
      dominant = k;
    }
  });
  let second: (typeof keys)[number] | null = null;
  let secondScore = -1;
  keys.forEach((k) => {
    if (k === dominant) return;
    const s = scores[k] || 0;
    if (s > secondScore) {
      secondScore = s;
      second = k;
    }
  });
  const domLabel = ARCHETYPE_LABELS[dominant];
  const secLabel = second ? ARCHETYPE_LABELS[second] : null;
  let interpretation = `${domLabel.description} `;
  if (secLabel && secondScore > 0 && secondScore >= best - 2) {
    interpretation += `Второй заметный полюс — «${secLabel.name}»: ${secLabel.description}`;
  }
  interpretation += ` ${domLabel.hint}`;
  return {
    archetypeScores: scores as Record<string, number>,
    dominantKey: dominant,
    dominantLabel: domLabel,
    secondaryKey: second,
    secondaryLabel: secLabel,
    interpretation
  };
}

export function scoreShadow(answers: Record<number, number>) {
  const scores = scoreWeightedQuestions(answers, SHADOW_QUESTIONS);
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 2).filter(([, v]) => v > 0);
  const themes = top.map(([id]) => ({
    id,
    ...SHADOW_THEME_COPY[id]
  }));
  let summary =
    'Это не диагноз, а карта самонаблюдения. Выберите 1–2 темы и обсудите их с психологом или в дневнике: что усиливает паттерн, что смягчает.';
  if (themes.length === 0) summary = 'Ответы относительно ровные — это тоже информация. Присмотритесь к редким пикам при повторном прохождении.';
  return { shadowScores: scores, themes, summary };
}

export function scorePersonality(answers: Record<number, number>) {
  const scores = scoreWeightedQuestions(answers, PERSONALITY_QUESTIONS);
  const order = ['hurry', 'perfect', 'please', 'strong', 'tryhard'] as const;
  let dom: (typeof order)[number] = 'hurry';
  let best = -1;
  order.forEach((k) => {
    const s = scores[k] || 0;
    if (s > best) {
      best = s;
      dom = k;
    }
  });
  const d = DRIVER_LABELS[dom];
  const interpretation = `${d.description} Драйверы часто сочетаются; полезно замечать «смешанные» сценарии в течение недели.`;
  return {
    driverScores: scores,
    driverKey: dom,
    driverLabel: d,
    interpretation
  };
}

export const TEST_CATALOG = [
  {
    id: 't1',
    title: 'Опорные архетипы личности',
    description:
      'Ситуационный опросник по четырём частым «полюсам» (герой, мудрец, созидатель, опекун). Не эквивалент полной юнгианской диагностики.',
    type: 'archetype' as const,
    questions: ARCHETYPE_QUESTIONS.length,
    duration: 22
  },
  {
    id: 't2',
    title: 'Работа с Тенью (самонаблюдение)',
    description:
      'Шестнадцать вопросов о проекции, стыде, контроле и избегании. Для рефлексии и разговора с терапевтом.',
    type: 'shadow' as const,
    questions: SHADOW_QUESTIONS.length,
    duration: 18
  },
  {
    id: 't3',
    title: 'Жизненный сценарий и драйверы (по мотивам ТА)',
    description:
      'Упрощённый взгляд на драйверы К. Кейпа и установки усилия. Не заменяет полноценный анализ транзактного анализа.',
    type: 'personality' as const,
    questions: PERSONALITY_QUESTIONS.length,
    duration: 16
  },
  {
    id: 't4',
    title: 'Интерактивная техника И-Цзин',
    description: 'Шесть бросков монет, гексаграмма по последовательности Кинг Вэна и классические тексты (где доступны).',
    type: 'i-ching' as const,
    questions: 6,
    duration: 12
  },
  {
    id: 't5',
    title: 'Спиральная динамика (упрощённый скрининг)',
    description:
      'Двенадцать вопросов о ценностях и мотивации в духе модели Грейвса — только ориентир, не научная типизация.',
    type: 'spiral-dynamics' as const,
    questions: SPIRAL_QUESTIONS.length,
    duration: 22
  }
] as const;

export type CatalogTest = (typeof TEST_CATALOG)[number];

export function questionsForType(
  type: CatalogTest['type']
): SpiralQuestion[] | WeightedQuestion[] | null {
  switch (type) {
    case 'spiral-dynamics':
      return SPIRAL_QUESTIONS;
    case 'archetype':
      return ARCHETYPE_QUESTIONS;
    case 'shadow':
      return SHADOW_QUESTIONS;
    case 'personality':
      return PERSONALITY_QUESTIONS;
    default:
      return null;
  }
}
