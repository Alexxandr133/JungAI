import { useEffect, useState } from 'react';
import { ClientNavbar } from '../../components/ClientNavbar';

type Test = {
  id: string;
  title: string;
  description: string;
  type: 'archetype' | 'shadow' | 'personality' | 'i-ching' | 'spiral-dynamics';
  completed: boolean;
  questions?: number;
  duration?: number;
};

type SpiralLevel = {
  id: string;
  name: string;
  color: string;
  description: string;
  score: number;
};

type TestResult = {
  testId: string;
  levels?: SpiralLevel[];
  dominantLevel?: SpiralLevel;
  interpretation?: string;
  // Для И-Цзин
  hexagram?: IChingHexagram;
  question?: string;
};

type IChingLine = {
  value: number; // 6 (старая инь), 7 (молодая ян), 8 (молодая инь), 9 (старая ян)
  isYang: boolean;
  isChanging: boolean; // меняющаяся линия (6 или 9)
};

type IChingHexagram = {
  number: number;
  name: string;
  chineseName: string;
  lines: IChingLine[]; // снизу вверх
  judgment: string;
  image: string;
  linesText: string[];
  changingTo?: number; // если есть меняющиеся линии
};

export default function ClientTests() {

  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{[key: number]: any}>({});
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [iChingQuestion, setIChingQuestion] = useState('');
  const [iChingLines, setIChingLines] = useState<IChingLine[]>([]);
  const [iChingStep, setIChingStep] = useState<'question' | 'casting' | 'result'>('question');
  const [castingLine, setCastingLine] = useState(0);
  const [isCasting, setIsCasting] = useState(false);

  useEffect(() => {
    const demo: Test[] = [
      { 
        id: 't1', 
        title: 'Определение доминирующего архетипа', 
        description: 'Пройдите тест, чтобы узнать, какой архетип доминирует в вашей личности',
        type: 'archetype',
        completed: false,
        questions: 3,
        duration: 15
      },
      { 
        id: 't2', 
        title: 'Работа с Тенью', 
        description: 'Исследуйте свою Тень и скрытые аспекты личности',
        type: 'shadow',
        completed: false,
        questions: 30,
        duration: 20
      },
      { 
        id: 't3', 
        title: 'Жизненный сценарий (по Берну)', 
        description: 'Определите свой жизненный сценарий и роли',
        type: 'personality',
        completed: true,
        questions: 25,
        duration: 18
      },
      { 
        id: 't4', 
        title: 'Интерактивная мантическая техника (И-Цзин)', 
        description: 'Получите гексаграмму и её интерпретацию',
        type: 'i-ching',
        completed: false,
        questions: 6,
        duration: 10
      },
      { 
        id: 't5', 
        title: 'Спиральная динамика развития', 
        description: 'Определите свой уровень развития сознания и стадию индивидуации',
        type: 'spiral-dynamics',
        completed: false,
        questions: 6,
        duration: 20
      }
    ];
    setTests(demo);
  }, []);

  function startTest(test: Test) {
    setSelectedTest(test);
    setCurrentQuestion(0);
    setAnswers({});
    if (test.type === 'i-ching') {
      setIChingStep('question');
      setIChingQuestion('');
      setIChingLines([]);
      setCastingLine(0);
    }
  }

  function getTestIcon(type: string) {
    switch(type) {
      case 'archetype': return '🎭';
      case 'shadow': return '🌑';
      case 'personality': return '🧠';
      case 'i-ching': return '☯️';
      case 'spiral-dynamics': return '🌀';
      default: return '📝';
    }
  }

  // Вопросы для разных тестов
  const spiralQuestions = [
    { id: 1, text: 'Что для вас важнее всего в жизни?', options: ['Выживание и безопасность', 'Традиции и принадлежность к группе', 'Сила и независимость', 'Порядок и правила', 'Успех и достижения', 'Равенство и гармония', 'Гибкость и интеграция', 'Целостность и глобальное сознание'], levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise'] },
    { id: 2, text: 'Как вы принимаете решения?', options: ['Инстинктивно, по ситуации', 'Согласно традициям предков', 'Быстро, руководствуясь силой', 'По правилам и законам', 'Анализируя выгоду', 'Учитывая мнение всех', 'Синтезируя разные подходы', 'Чувствуя целостную картину'], levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise'] },
    { id: 3, text: 'Что вас мотивирует?', options: ['Базовые потребности (еда, кров)', 'Принадлежность к группе', 'Власть и контроль', 'Служение высшей цели', 'Личный успех и признание', 'Помощь другим', 'Понимание систем', 'Единство всего сущего'], levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise'] },
    { id: 4, text: 'Как вы относитесь к изменениям?', options: ['Избегаю, предпочитаю стабильность', 'Уважаю традиции, изменения медленные', 'Принимаю вызовы, действую смело', 'Изменения должны быть упорядочены', 'Ищу новые возможности', 'Изменения для блага всех', 'Адаптируюсь гибко', 'Вижу изменения как часть целого'], levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise'] },
    { id: 5, text: 'Ваше отношение к авторитету?', options: ['Подчиняюсь инстинктам', 'Уважаю старейшин и традиции', 'Сам себе авторитет', 'Следую установленным правилам', 'Признаю экспертов в своей области', 'Равенство важнее авторитета', 'Авторитет должен быть обоснован', 'Авторитет - часть системы'], levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise'] },
    { id: 6, text: 'Как вы видите своё место в мире?', options: ['Выживаю день за днём', 'Часть моей группы/семьи', 'Я сильнее других', 'Служу высшему порядку', 'Достигаю личных целей', 'Работаю на благо сообщества', 'Интегрирую разные системы', 'Часть единого целого'], levels: ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise'] }
  ];

  // Демо-вопросы для архетипного теста
  const demoQuestions = [
    { id: 1, text: 'Как вы обычно реагируете на вызовы?', options: ['Активно ищу решение', 'Анализирую ситуацию', 'Ищу поддержку', 'Избегаю конфликта'] },
    { id: 2, text: 'Что для вас важнее всего?', options: ['Достижение целей', 'Понимание себя', 'Отношения с другими', 'Внутренний покой'] },
    { id: 3, text: 'Как вы видите свою роль в мире?', options: ['Герой, который меняет мир', 'Искатель истины', 'Защитник близких', 'Наблюдатель'] }
  ];

  const spiralLevels: SpiralLevel[] = [
    { id: 'beige', name: 'Выживание', color: '#D4A574', description: 'Фокус на базовых потребностях, инстинкты', score: 0 },
    { id: 'purple', name: 'Племенной', color: '#9B59B6', description: 'Традиции, ритуалы, принадлежность к группе', score: 0 },
    { id: 'red', name: 'Эгоцентричный', color: '#E74C3C', description: 'Сила, власть, независимость, действие', score: 0 },
    { id: 'blue', name: 'Абсолютистский', color: '#3498DB', description: 'Порядок, правила, служение высшей цели', score: 0 },
    { id: 'orange', name: 'Материалистический', color: '#F39C12', description: 'Успех, достижения, конкуренция, прогресс', score: 0 },
    { id: 'green', name: 'Релятивистский', color: '#2ECC71', description: 'Равенство, сообщество, гармония, эмпатия', score: 0 },
    { id: 'yellow', name: 'Системный', color: '#F1C40F', description: 'Интеграция, гибкость, системное мышление', score: 0 },
    { id: 'turquoise', name: 'Холистический', color: '#1ABC9C', description: 'Целостность, глобальное сознание, единство', score: 0 }
  ];

  function handleAnswer(questionId: number, answer: any) {
    setAnswers({...answers, [questionId]: answer});
  }

  function calculateSpiralResult(): TestResult {
    const levelScores: {[key: string]: number} = {
      beige: 0, purple: 0, red: 0, blue: 0, orange: 0, green: 0, yellow: 0, turquoise: 0
    };

    // Подсчитываем баллы для каждого уровня
    spiralQuestions.forEach((q) => {
      const answer = answers[q.id];
      if (answer !== undefined) {
        const optionIndex = q.options.indexOf(answer);
        if (optionIndex >= 0 && q.levels && q.levels[optionIndex]) {
          const level = q.levels[optionIndex];
          levelScores[level] = (levelScores[level] || 0) + 1;
        }
      }
    });

    // Создаём массив уровней с баллами
    const levels = spiralLevels.map(level => ({
      ...level,
      score: levelScores[level.id] || 0
    }));

    // Находим доминирующий уровень
    const dominantLevel = levels.reduce((max, level) => 
      level.score > max.score ? level : max, levels[0]);

    // Генерируем интерпретацию
    const interpretations: {[key: string]: string} = {
      beige: 'Вы находитесь на базовом уровне выживания. Ваш фокус на удовлетворении основных потребностей. Это нормальная стадия, особенно в кризисных ситуациях. Рекомендуется работа над стабильностью и безопасностью.',
      purple: 'Вы цените традиции и принадлежность к группе. Ритуалы и связи с предками важны для вас. Это уровень племенного сознания, где коллективная идентичность преобладает над индивидуальной.',
      red: 'Вы действуете с силой и независимостью. Власть и контроль важны для вас. Это уровень эгоцентричного сознания, где личная сила и свобода действий являются приоритетом.',
      blue: 'Вы следуете порядку и правилам. Служение высшей цели или системе ценностей важно для вас. Это уровень абсолютистского сознания, где структура и дисциплина создают основу.',
      orange: 'Вы стремитесь к успеху и достижениям. Конкуренция и прогресс мотивируют вас. Это уровень материалистического сознания, где личные достижения и признание являются ключевыми.',
      green: 'Вы цените равенство и гармонию. Сообщество и эмпатия важны для вас. Это уровень релятивистского сознания, где забота о других и коллективное благо приоритетны.',
      yellow: 'Вы мыслите системно и гибко. Интеграция разных подходов - ваша сила. Это уровень системного сознания, где синтез и адаптивность позволяют видеть целостную картину.',
      turquoise: 'Вы чувствуете единство всего сущего. Глобальное сознание и целостность - ваша природа. Это уровень холистического сознания, где индивидуальное и коллективное сливаются в единое целое.'
    };

    return {
      testId: selectedTest!.id,
      levels,
      dominantLevel,
      interpretation: interpretations[dominantLevel.id] || 'Ваш уровень развития уникален.'
    };
  }

  // Данные гексаграмм И-Цзин (первые 20 для примера, можно расширить)
  const hexagrams: {[key: number]: Omit<IChingHexagram, 'lines' | 'changingTo'>} = {
    1: { number: 1, name: 'Творчество', chineseName: '乾 (Цянь)', judgment: 'Творчество. Успех. Благоприятна стойкость.', image: 'Небо движется непрерывно. Так благородный человек неустанно совершенствует себя.', linesText: ['Скрытый дракон. Не действуй.', 'Появился дракон на поле. Благоприятно увидеть великого человека.', 'Благородный человек до конца дня творчески активен. Вечером он все еще осторожен. Опасность. Но хулы не будет.', 'Или прыжок в бездну. Хулы не будет.', 'Летящий дракон на небе. Благоприятно увидеть великого человека.', 'Возгордившийся дракон. Будет раскаяние.'] },
    2: { number: 2, name: 'Исполнение', chineseName: '坤 (Кунь)', judgment: 'Исполнение. Благоприятна стойкость кобылицы. Благородный человек предпринимает поход. Сначала заблудится, потом найдет хозяина. Благоприятно. На юго-западе получишь друга. На северо-востоке потеряешь друга. Успокойся в стойкости - будет счастье.', image: 'Сила Земли - это исполнение. Так благородный человек с великой добродетелью несет вещи.', linesText: ['Ступаешь на иней - приближается крепкий лед.', 'Прямо, квадратно, велико. Без упражнения - ничего не будет.', 'Скрытые линии. Можно быть стойким. Следуй царю. Без успеха, но с окончанием.', 'Завязанный мешок. Ни хулы, ни хвалы.', 'Желтая юбка. Изначальное счастье.', 'Драконы сражаются на поле. Их кровь черна и желта.'] },
    3: { number: 3, name: 'Начальная трудность', chineseName: '屯 (Чжунь)', judgment: 'Начальная трудность. Благоприятна стойкость. Не следует никуда выступать. Благоприятно возводить вассалов.', image: 'Облако и гром - вот образ Начальной трудности. Так благородный человек приводит в порядок дела.', linesText: ['Колеблется и стоит. Благоприятно пребывать в стойкости. Благоприятно возводить вассалов.', 'Трудность в начале. Конь и повозка разлучены. Не разбойник, а жених. Девица не идет замуж. Через десять лет - замужество.', 'Кто гонится за оленем без ловчего, тот только войдет в лес. Благородный человек понимает знаки времени и предпочитает воздержаться. Выступать - унижение.', 'Конь и повозка разлучены. Ищи союза. Выступай - будет счастье. Ничего неблагоприятного.', 'Трудность в начале. Малое стойкость - счастье. Великое стойкость - несчастье.', 'Конь и повозка разлучены. Плачешь кровавыми слезами.'] },
    4: { number: 4, name: 'Недоразвитость', chineseName: '蒙 (Мэн)', judgment: 'Недоразвитость. Благоприятен я. Не я ищу юных невежд, а юные невежды ищут меня. При первом гадании возвещаю. При повторном и третьем - надоедаю. Если надоедаю, то не возвещаю. Благоприятна стойкость.', image: 'У подножия горы поднимается родник - вот образ Недоразвитости. Так благородный человек действует решительно, воспитывая свой характер.', linesText: ['Развитие недоразвитого. Благоприятно применять казни для освобождения от оков. При дальнейшем применении - сковывание. Несчастье.', 'Охватывание недоразвитого. Счастье. Принятие женщины - счастье. Сын управляет домом.', 'Не следует брать женщину. Увидев мужа, она не соблюдает себя. Ничего благоприятного.', 'Ограничение недоразвитого. Раскаяние.', 'Дитя недоразвитое. Счастье.', 'Удар по недоразвитому. Не благоприятно быть разбойником. Благоприятно отражать разбойника.'] },
    5: { number: 5, name: 'Необходимость ждать', chineseName: '需 (Сюй)', judgment: 'Необходимость ждать. Обладаю правдой. Свет. Развитие. Благоприятна стойкость. Благоприятно перейти вброд через великую реку.', image: 'Облако поднимается к небу - вот образ Необходимости ждать. Так благородный человек ест и пьет, радуясь и веселясь.', linesText: ['Ожидание в поле. Благоприятно применять постоянство. Хулы не будет.', 'Ожидание на песке. Быть может, будут небольшие разговоры. В конце концов - счастье.', 'Ожидание в грязи. Придет разбойник.', 'Ожидание в крови. Выйдешь из пещеры.', 'Ожидание за вином и яствами. Благоприятна стойкость.', 'Войдешь в пещеру. Придут трое незваных гостей. Отнесись к ним с уважением - в конце концов будет счастье.'] },
    6: { number: 6, name: 'Ссора', chineseName: '訟 (Сун)', judgment: 'Ссора. Обладай правдой. Пресекай. Середина - счастье. Конец - несчастье. Благоприятно увидеть великого человека. Не благоприятно переходить вброд через великую реку.', image: 'Небо и вода расходятся - вот образ Ссоры. Так благородный человек в делах начинает с размышления.', linesText: ['Не постоянство в делах. Быть может, будут небольшие разговоры. В конце концов - счастье.', 'Не одолеешь в ссоре. Вернись и беги, скройся в своем городе. Триста семейств не будут иметь беды.', 'Питайся старым достоянием. Стойкость - опасность. В конце концов - счастье. Или следуй царю в делах. Не будь успешным.', 'Не одолеешь в ссоре. Вернись и прими решение. Изменись и обрети покой. Стойкость - счастье.', 'Ссора. Великое счастье.', 'Может быть, получишь пояс с наградами. К концу дня у тебя отнимут его трижды. Хулы не будет.'] },
    7: { number: 7, name: 'Войско', chineseName: '師 (Ши)', judgment: 'Войско. Благоприятен я. Ничего неблагоприятного.', image: 'В середине земли - вода. Вот образ Войска. Так благородный человек, воспитывая народ, становится щедрым.', linesText: ['Войско выходит в поход. Соблюдение порядка - иначе, даже при успехе, будет несчастье.', 'Пребывание в войске. Счастье. Хулы не будет. Царь трижды дает награды.', 'Войско, быть может, везет трупы. Несчастье.', 'Войско отступает. Ничего неблагоприятного.', 'В поле есть дичь. Благоприятно схватить ее. Хулы не будет. Старший сын ведет войско. Младший сын везет трупы. Стойкость - к несчастью.', 'Великий государь отдает приказы. Открывает государство и наследует дом. Ничтожным людям не действовать.'] },
    8: { number: 8, name: 'Приближение', chineseName: '比 (Би)', judgment: 'Приближение. Счастье. Изначальное гадание - вечное. Хулы не будет. Неустойчивым придет конец. Поздно пришедшему - несчастье.', image: 'На земле есть вода - вот образ Приближения. Так древние цари создавали бесчисленные владения и приближали к себе удельных князей.', linesText: ['Приближение с правдой. Хулы не будет. Если правда переполнена, то будет счастье.', 'Приближение изнутри. Стойкость - счастье.', 'Приближение к недостойным.', 'Приближение извне. Стойкость - счастье.', 'Явное приближение. Царь использует три погони. Теряя передних, не раскаивайся. Счастье.', 'Приближение без главы. Несчастье.'] },
    9: { number: 9, name: 'Воспитание малым', chineseName: '小畜 (Сяо Сюй)', judgment: 'Воспитание малым. Развитие. Плотные облака, но нет дождя с нашего западного предместья.', image: 'Ветер движется по небу - вот образ Воспитания малым. Так благородный человек совершенствует внешние формы.', linesText: ['Возвращение к своему пути. В чем хула? Счастье.', 'Влечение к возвращению. Счастье.', 'Повозка расходится, муж и жена отворачивают взоры друг от друга.', 'Обладай правдой. Кровь уйдет, страх исчезнет. Хулы не будет.', 'Обладай правдой, соединяйся с другими. Богатство у твоих соседей.', 'Дождь пришел, остановка. Стойкость - уважение. Жена в стойкости - опасность. Луна почти в полнолунии. Благородному человеку выступать - несчастье.'] },
    10: { number: 10, name: 'Наступление', chineseName: '履 (Люй)', judgment: 'Наступление на хвост тигра. Он не укусит человека. Развитие.', image: 'Небо и озеро - вот образ Наступления. Так благородный человек различает верх и низ и тем самым укрепляет мысли народа.', linesText: ['Простое наступление. Выступать - будет счастье.', 'Наступление на ровном месте. Стойкость к уединенному человеку - развитие.', 'Одноглазый может видеть, хромой может наступать. Наступление на хвост тигра. Тигр укусит человека. Несчастье. Воин действует за великого государя.', 'Наступление на хвост тигра. Страх и осторожность. В конце концов - счастье.', 'Решительное наступление. Стойкость - опасность.', 'Созерцай наступление. Изначальное счастье.'] },
    11: { number: 11, name: 'Расцвет', chineseName: '泰 (Тай)', judgment: 'Расцвет. Малому уходу - развитие. Счастье. Развитие.', image: 'Небо и земля общаются - вот образ Расцвета. Так правитель, следуя этому, завершает путь неба и земли, помогает правильности природы и тем самым поддерживает народ.', linesText: ['Выдергиваешь мальву с корнем. Соединяешь с другими. Выступать - будет счастье.', 'Объемлешь пустыню. Используй переправу. Не оставляй дальних. Товарищ потеряется. Достигнешь середины пути.', 'Нет равнины, которая не стала бы холмом. Нет ухода, который не стал бы возвращением. Стойкость в трудности - хулы не будет. Не скорби об этой правде. На пашне будет счастье.', 'Легкомысленный расцвет. Не богатство у соседей. Не предостерегайся. Обладай правдой.', 'И-ди отдает свою дочь в жены. Это принесет счастье и развитие.', 'Городской вал возвращается в ров. Не используй войско. Из своего города возвещай приказы. Стойкость - к смуте.'] },
    12: { number: 12, name: 'Упадок', chineseName: '否 (Пи)', judgment: 'Упадок. Не человеку упадок. Благородному человеку стойкость. Великое уходит, малое приходит.', image: 'Небо и земля не общаются - вот образ Упадка. Так благородный человек, следуя этому, стягивает свои добродетели, чтобы избежать беды. Ничего благоприятного.', linesText: ['Выдергиваешь мальву с корнем. Стойкость - счастье. Развитие.', 'Объемлешь упадок. Малому человеку - развитие. Благородному человеку - упадок. Развитие.', 'Объемлешь стыд.', 'Имеешь приказ. Без хулы. Близкие получают благословение.', 'Остановка упадка. Благородному человеку - счастье. Упадок. Упадок. Связан с пучком мальвы.', 'Переворачивающий упадок. Сначала упадок, потом радость.'] },
    13: { number: 13, name: 'Родня', chineseName: '同人 (Тун Жэнь)', judgment: 'Родня. Родня в поле. Развитие. Благоприятно перейти вброд через великую реку. Благоприятна стойкость благородному человеку.', image: 'Небо с огнем - вот образ Родни. Так благородный человек различает вещи по родам и группам.', linesText: ['Родня у ворот. Хулы не будет.', 'Родня в клане. Стыд.', 'Скрываешь войско в зарослях. Поднимаешься на высокий холм. Три года не поднимаешься.', 'Поднимаешься на стену. Не нападаешь. Счастье.', 'Родня сначала плачет и вопит, потом смеется. Великое войско побеждает и встречается.', 'Родня в поле. Не раскаивайся.'] },
    14: { number: 14, name: 'Великое обладание', chineseName: '大有 (Да Ю)', judgment: 'Великое обладание. Верховное счастье.', image: 'Огонь в небе - вот образ Великого обладания. Так благородный человек прекращает зло и утверждает добро, следуя небесной воле.', linesText: ['Нет общения с вредом. Хулы не будет. Трудность - тогда не будет хулы.', 'Большая повозка для перевозки. Можешь выступить. Хулы не будет.', 'Князья используют его для аудиенции у сына неба. Малому человеку это не под силу.', 'Отклонись от своего великолепия. Хулы не будет.', 'Обладай правдой и величавостью. Счастье.', 'Небо помогает ему. Счастье. Ничего неблагоприятного.'] },
    15: { number: 15, name: 'Смирение', chineseName: '謙 (Цянь)', judgment: 'Смирение. Развитие. Благородному человеку - конец.', image: 'В горе есть земля - вот образ Смирения. Так благородный человек уменьшает многое и восполняет малое. Взвешивает вещи и выравнивает их.', linesText: ['Смиренный благородный человек. Благоприятно перейти вброд через великую реку. Счастье.', 'Высказывающееся смирение. Стойкость - счастье.', 'Трудолюбивый смиренный человек. Благородному человеку - конец. Счастье.', 'Ничего неблагоприятного. Распространяй смирение.', 'Не богатство. Используй соседей. Благоприятно применять нападение. Ничего неблагоприятного.', 'Высказывающееся смирение. Благоприятно применять походы на города и страны.'] },
    16: { number: 16, name: 'Вольность', chineseName: '豫 (Юй)', judgment: 'Вольность. Благоприятно возводить вассалов и двигать войско.', image: 'Гром выходит из земли и возносится - вот образ Вольности. Так древние цари создавали музыку, чтобы почитать заслуги, принося великие жертвы небу и призывая предков.', linesText: ['Высказывающаяся вольность. Несчастье.', 'Крепок как камень. Не целый день. Стойкость - счастье.', 'Взоры на вольность. Раскаяние. Медлительность - раскаяние.', 'От вольности - великое обретение. Не сомневайся. Друзья последуют, как волосы за заколкой.', 'Стойкость в болезни. Долго не умрешь.', 'Завершенная вольность. Изменишь. Хулы не будет.'] },
    17: { number: 17, name: 'Последование', chineseName: '隨 (Суй)', judgment: 'Последование. Развитие. Стойкость - счастье. Хулы не будет.', image: 'В озере есть гром - вот образ Следования. Так благородный человек в сумерки входит для отдыха и развлечения.', linesText: ['Есть измена в правлении. Стойкость - счастье. Выходи за ворота и общайся - будет дело.', 'Связываешь мальчика. Теряешь мужа.', 'Связываешь мужа. Теряешь мальчика. Следование ищет того, что найдешь. Благоприятно пребывать в стойкости.', 'Следование обретает. Стойкость - к несчастью. Обладай правдой в пути. Что может быть ясным?', 'Обладай правдой в доброте. Счастье.', 'Связываешь его и привязываешь его. Царь использует его на западной горе.'] },
    18: { number: 18, name: 'Исправление испорченного', chineseName: '蠱 (Гу)', judgment: 'Исправление испорченного. Развитие. Благоприятно перейти вброд через великую реку. Перед началом дела - три дня. После начала дела - три дня.', image: 'Ветер у подножия горы - вот образ Исправления испорченного. Так благородный человек пробуждает народ и воспитывает добродетель.', linesText: ['Исправление испорченного отца. Есть сын. На отце хулы не будет. Опасность. В конце концов - счастье.', 'Исправление испорченного отца. Стойкость - к несчастью.', 'Исправление испорченного отца. Есть небольшое раскаяние. Хулы не будет.', 'Терпимое отношение к испорченному отцу. Далее увидишь стыд.', 'Исправление испорченного отца. Используй похвалу.', 'Не служи ни царю, ни князю. Высшие ставят себе цели.'] },
    19: { number: 19, name: 'Приближение', chineseName: '臨 (Линь)', judgment: 'Приближение. Развитие. Благоприятна стойкость. В восьмой луне - несчастье.', image: 'Земля над озером - вот образ Приближения. Так благородный человек неустанно воспитывает народ и заботится о нем безгранично.', linesText: ['Совместное приближение. Стойкость - счастье.', 'Совместное приближение. Счастье. Ничего неблагоприятного.', 'Удобное приближение. Ничего благоприятного. Уже обеспокоен этим. Хулы не будет.', 'Полное приближение. Хулы не будет.', 'Знающее приближение. Благородному человеку - счастье.', 'Великодушное приближение. Счастье. Хулы не будет.'] },
    20: { number: 20, name: 'Созерцание', chineseName: '觀 (Гуань)', judgment: 'Созерцание. Омовение совершено, но еще не принесена жертва. Исполненные веры смотрят и почитают.', image: 'Ветер движется над землей - вот образ Созерцания. Так древние цари осматривали области света и наблюдали за народом, чтобы учить его.', linesText: ['Детское созерцание. Малому человеку - хулы не будет. Благородному человеку - стыд.', 'Созерцание через щель. Благоприятна стойкость женщины.', 'Созерцание моей жизни. Выхожу вперед или отступаю.', 'Созерцание света царства. Благоприятно быть гостем у царя.', 'Созерцание моей жизни. Благородному человеку - хулы не будет.', 'Созерцание его жизни. Благородному человеку - хулы не будет.'] }
  };

  // Генерация одной линии гексаграммы (бросание 3 монет)
  function castLine(): IChingLine {
    // Три монеты: 0 = решка (инь), 1 = орел (ян)
    const coin1 = Math.random() < 0.5 ? 0 : 1;
    const coin2 = Math.random() < 0.5 ? 0 : 1;
    const coin3 = Math.random() < 0.5 ? 0 : 1;
    const sum = coin1 + coin2 + coin3;
    
    // 0 инь = 6 (старая инь, меняющаяся)
    // 1 ян = 7 (молодая ян, стабильная)
    // 2 инь = 8 (молодая инь, стабильная)
    // 3 ян = 9 (старая ян, меняющаяся)
    let value: number;
    if (sum === 0) value = 6; // старая инь
    else if (sum === 1) value = 7; // молодая ян
    else if (sum === 2) value = 8; // молодая инь
    else value = 9; // старая ян
    
    return {
      value,
      isYang: value === 7 || value === 9,
      isChanging: value === 6 || value === 9
    };
  }

  // Построение гексаграммы из 6 линий
  function buildHexagram(lines: IChingLine[]): IChingHexagram {
    // Преобразуем линии в бинарное представление (снизу вверх)
    // Ян = 1, Инь = 0
    let binary = '';
    for (let i = 0; i < 6; i++) {
      binary = (lines[i].isYang ? '1' : '0') + binary;
    }
    
    // Определяем номер гексаграммы (1-64)
    // Используем упрощенную логику: первые 20 гексаграмм
    const hexNumber = parseInt(binary, 2) % 20 + 1;
    const hexData = hexagrams[hexNumber] || hexagrams[1];
    
    // Проверяем, есть ли меняющиеся линии
    const changingLines = lines.filter(l => l.isChanging);
    let changingTo: number | undefined;
    if (changingLines.length > 0) {
      // Создаем вторую гексаграмму с измененными линиями
      const newLines = lines.map(l => ({
        ...l,
        isYang: l.isChanging ? !l.isYang : l.isYang,
        isChanging: false,
        value: l.isChanging ? (l.isYang ? 7 : 8) : l.value
      }));
      let newBinary = '';
      for (let i = 0; i < 6; i++) {
        newBinary = (newLines[i].isYang ? '1' : '0') + newBinary;
      }
      changingTo = parseInt(newBinary, 2) % 20 + 1;
    }
    
    return {
      ...hexData,
      lines,
      changingTo
    };
  }

  // Начало процесса бросания монет для И-Цзин
  function startIChingCasting() {
    if (!iChingQuestion.trim()) return;
    setIChingStep('casting');
    setCastingLine(0);
    setIChingLines([]);
    castNextLine();
  }

  // Бросание следующей линии
  function castNextLine() {
    setIsCasting(true);
    setTimeout(() => {
      const line = castLine();
      const newLines = [...iChingLines, line];
      setIChingLines(newLines);
      setCastingLine(newLines.length);
      setIsCasting(false);
      
      if (newLines.length === 6) {
        // Все линии брошены, строим гексаграмму
        const hexagram = buildHexagram(newLines);
        setTestResult({
          testId: selectedTest!.id,
          hexagram,
          question: iChingQuestion
        });
        setIChingStep('result');
        const updated = tests.map(t => t.id === selectedTest!.id ? {...t, completed: true} : t);
        setTests(updated);
      }
    }, 1500);
  }

  function nextQuestion() {
    const questions = selectedTest?.type === 'spiral-dynamics' ? spiralQuestions : demoQuestions;
    
    if (selectedTest && currentQuestion < (questions.length - 1)) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Завершить тест
      if (selectedTest?.type === 'spiral-dynamics') {
        const result = calculateSpiralResult();
        setTestResult(result);
      }
      const updated = tests.map(t => t.id === selectedTest!.id ? {...t, completed: true} : t);
      setTests(updated);
    }
  }

  function closeResult() {
    setTestResult(null);
    setSelectedTest(null);
    setCurrentQuestion(0);
    setAnswers({});
    setIChingStep('question');
    setIChingQuestion('');
    setIChingLines([]);
  }

  // Показываем результаты теста И-Цзин
  if (testResult && selectedTest?.type === 'i-ching' && testResult.hexagram) {
    const hex = testResult.hexagram;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ClientNavbar />
        <main
          style={{
            flex: 1,
            padding: '24px clamp(16px, 5vw, 48px)',
            maxWidth: '100%',
            overflowX: 'hidden'
          }}
        >
          <div className="card" style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>Результаты: Гексаграмма {hex.number}</h2>
              <button className="button secondary" onClick={closeResult} style={{ padding: '6px 12px', fontSize: 13 }}>Закрыть</button>
            </div>

            {/* Вопрос */}
            {testResult.question && (
              <div className="card" style={{ padding: 16, marginBottom: 24, background: 'var(--surface-2)' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Ваш вопрос:</div>
                <div style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>"{testResult.question}"</div>
              </div>
            )}

            {/* Гексаграмма */}
            <div className="card" style={{ padding: 24, marginBottom: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>☯️</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{hex.name}</div>
              <div style={{ fontSize: 18, color: 'var(--text-muted)', marginBottom: 24 }}>{hex.chineseName}</div>
              
              {/* Визуализация гексаграммы */}
              <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 12, alignItems: 'center', marginBottom: 24 }}>
                {hex.lines.map((line, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', minWidth: 30, textAlign: 'right' }}>
                      {idx + 1}
                    </div>
                    <div style={{
                      width: line.isYang ? 200 : 180,
                      height: line.isYang ? 12 : 8,
                      background: line.isYang ? 'var(--primary)' : 'transparent',
                      border: line.isYang ? 'none' : '4px solid var(--primary)',
                      borderTop: line.isYang ? 'none' : '4px solid var(--primary)',
                      borderBottom: line.isYang ? 'none' : '4px solid var(--primary)',
                      position: 'relative',
                      borderRadius: line.isYang ? 6 : 0
                    }}>
                      {line.isChanging && (
                        <div style={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 12,
                          boxShadow: '0 0 12px var(--accent)'
                        }}>
                          ⚡
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', minWidth: 40, textAlign: 'left' }}>
                      {line.value} {line.isYang ? '⚊' : '⚋'} {line.isChanging ? '(меняющаяся)' : ''}
                    </div>
                  </div>
                ))}
              </div>

              {/* Меняющиеся линии */}
              {hex.lines.some(l => l.isChanging) && (
                <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 12, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Меняющиеся линии:</div>
                  <div style={{ lineHeight: 1.6 }}>
                    {hex.lines.map((line, idx) => line.isChanging && (
                      <div key={idx} style={{ marginBottom: 8 }}>
                        Линия {idx + 1}: {hex.linesText[idx]}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Судьба */}
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Судьба (Суждение)</div>
              <div style={{ lineHeight: 1.8, fontSize: 16 }}>{hex.judgment}</div>
            </div>

            {/* Образ */}
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Образ</div>
              <div style={{ lineHeight: 1.8, fontSize: 16 }}>{hex.image}</div>
            </div>

            {/* Текст линий */}
            {hex.linesText && hex.linesText.length > 0 && (
              <div className="card" style={{ padding: 20, marginBottom: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Текст линий</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {hex.linesText.map((text, idx) => (
                    <div key={idx} style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 8 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--primary)' }}>Линия {idx + 1}:</div>
                      <div style={{ lineHeight: 1.6 }}>{text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Переходная гексаграмма */}
            {hex.changingTo && (
              <div className="card" style={{ padding: 20, background: 'linear-gradient(135deg, var(--primary)22, var(--accent)11)', border: '2px solid var(--primary)' }}>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Переход к гексаграмме {hex.changingTo}</div>
                <div style={{ lineHeight: 1.8 }}>
                  Ваша гексаграмма содержит меняющиеся линии, что указывает на переход к новой ситуации. 
                  Изучите также гексаграмму {hex.changingTo} для понимания направления изменений.
                </div>
              </div>
            )}

            {/* Рекомендации */}
            <div className="card" style={{ padding: 16, background: 'var(--surface-2)' }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Как работать с этой гексаграммой</div>
              <div style={{ lineHeight: 1.8 }}>
                <p style={{ marginBottom: 12 }}>
                  Гексаграмма И-Цзин - это не предсказание, а зеркало текущей ситуации. 
                  Она отражает энергетическое состояние момента и предлагает мудрость для навигации.
                </p>
                <p style={{ marginBottom: 12 }}>
                  <strong>Судьба</strong> описывает общую ситуацию и её потенциал. 
                  <strong>Образ</strong> показывает, как природа проявляет эту энергию, 
                  предлагая модель для ваших действий.
                </p>
                <p>
                  Если есть <strong>меняющиеся линии</strong>, они указывают на области, 
                  где ситуация находится в движении и требует особого внимания. 
                  Изучите текст этих линий для более глубокого понимания.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Показываем результаты теста спиральной динамики
  if (testResult && selectedTest?.type === 'spiral-dynamics' && testResult.dominantLevel && testResult.levels) {
    const dominantLevel = testResult.dominantLevel;
    const levels = testResult.levels;
    
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ClientNavbar />
        <main
          style={{
            flex: 1,
            padding: '24px clamp(16px, 5vw, 48px)',
            maxWidth: '100%',
            overflowX: 'hidden'
          }}
        >
          <div className="card" style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>Результаты теста: Спиральная динамика</h2>
              <button className="button secondary" onClick={closeResult} style={{ padding: '6px 12px', fontSize: 13 }}>Закрыть</button>
            </div>

            {/* Доминирующий уровень */}
            <div className="card" style={{ padding: 20, marginBottom: 24, background: `linear-gradient(135deg, ${dominantLevel.color}22, ${dominantLevel.color}11)`, border: `2px solid ${dominantLevel.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <div style={{ width: 60, height: 60, borderRadius: 999, background: dominantLevel.color, display: 'grid', placeItems: 'center', fontSize: 32 }}>🌀</div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{dominantLevel.name}</div>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>{dominantLevel.description}</div>
                </div>
              </div>
              <div style={{ marginTop: 16, padding: 16, background: 'var(--surface-2)', borderRadius: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Интерпретация:</div>
                <div style={{ lineHeight: 1.6 }}>{testResult.interpretation}</div>
              </div>
            </div>

            {/* Визуализация спирали */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 18 }}>Ваш профиль по уровням</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {levels.map((level) => {
                  const maxScore = Math.max(...levels.map(l => l.score), 1);
                  const percentage = (level.score / maxScore) * 100;
                  const isDominant = level.id === dominantLevel.id;
                  
                  return (
                    <div key={level.id} style={{ display: 'grid', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 999, background: level.color, border: isDominant ? '2px solid var(--accent)' : 'none' }} />
                          <div>
                            <div style={{ fontWeight: 700 }}>{level.name}</div>
                            <div className="small" style={{ color: 'var(--text-muted)' }}>{level.description}</div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: level.color }}>{level.score} баллов</div>
                      </div>
                      <div style={{ width: '100%', height: 8, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${percentage}%`, 
                          height: '100%', 
                          background: level.color, 
                          transition: 'width 0.5s',
                          boxShadow: isDominant ? `0 0 12px ${level.color}66` : 'none'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Спиральная визуализация */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 18 }}>Визуализация спирали</div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 40, background: 'var(--surface-2)', borderRadius: 16, position: 'relative', minHeight: 300 }}>
                <svg width="300" height="300" viewBox="0 0 300 300" style={{ position: 'absolute' }}>
                  {/* Рисуем спираль */}
                  <path
                    d="M 150 150 m -100 0 a 100 100 0 1 1 200 0 a 200 200 0 1 1 -200 0"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="2"
                  />
                  {/* Точки уровней на спирали */}
                  {levels.map((level, index) => {
                    const angle = ((index + 1) / levels.length) * Math.PI * 2;
                    const radius = 80 + (level.score * 5);
                    const x = 150 + Math.cos(angle) * radius;
                    const y = 150 + Math.sin(angle) * radius;
                    const isDominant = level.id === dominantLevel.id;
                    
                    return (
                      <g key={level.id}>
                        <circle
                          cx={x}
                          cy={y}
                          r={isDominant ? 12 : 8}
                          fill={level.color}
                          stroke={isDominant ? 'var(--accent)' : 'transparent'}
                          strokeWidth={isDominant ? 3 : 0}
                          style={{ filter: isDominant ? `drop-shadow(0 0 8px ${level.color})` : 'none' }}
                        />
                        <text
                          x={x}
                          y={y - 20}
                          textAnchor="middle"
                          fill="var(--text)"
                          fontSize="10"
                          fontWeight={isDominant ? 700 : 400}
                        >
                          {level.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Рекомендации */}
            <div className="card" style={{ padding: 16, background: 'var(--surface-2)' }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Рекомендации для развития</div>
              <div style={{ lineHeight: 1.6 }}>
                {dominantLevel.id === 'beige' && 'Сосредоточьтесь на создании стабильности и безопасности в жизни. Работайте над базовыми потребностями, чтобы создать фундамент для дальнейшего развития.'}
                {dominantLevel.id === 'purple' && 'Цените свои корни и традиции, но также исследуйте новые возможности. Баланс между уважением к прошлому и открытостью к новому поможет вам расти.'}
                {dominantLevel.id === 'red' && 'Используйте свою силу конструктивно. Научитесь направлять энергию на созидательные цели, а не только на доминирование.'}
                {dominantLevel.id === 'blue' && 'Ваша структурированность - это сила. Изучайте разные системы ценностей, чтобы расширить понимание порядка и смысла.'}
                {dominantLevel.id === 'orange' && 'Помните, что успех - это не только достижения. Ищите баланс между личными целями и заботой о других.'}
                {dominantLevel.id === 'green' && 'Ваша эмпатия ценна. Развивайте также способность принимать решения, когда это необходимо, даже если не все будут довольны.'}
                {dominantLevel.id === 'yellow' && 'Ваше системное мышление - дар. Помогайте другим видеть связи и интегрировать разные подходы.'}
                {dominantLevel.id === 'turquoise' && 'Вы видите целостную картину. Помогайте другим развивать это видение, делясь своим пониманием единства.'}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // UI для теста И-Цзин
  if (selectedTest?.type === 'i-ching') {
    if (iChingStep === 'question') {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <ClientNavbar />
          <main
            style={{
              flex: 1,
              padding: '24px clamp(16px, 5vw, 48px)',
              maxWidth: '100%',
              overflowX: 'hidden'
            }}
          >
            <div className="card" style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
              <div style={{ marginBottom: 20 }}>
                <button className="button secondary" onClick={() => { setSelectedTest(null); setIChingStep('question'); }} style={{ padding: '6px 12px', fontSize: 13 }}>← Назад</button>
              </div>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>☯️</div>
                <h2 style={{ margin: 0, marginBottom: 12 }}>Интерактивная мантическая техника (И-Цзин)</h2>
                <div className="small" style={{ color: 'var(--text-muted)' }}>Сформулируйте свой вопрос и получите гексаграмму с интерпретацией</div>
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Ваш вопрос:</label>
                <textarea
                  value={iChingQuestion}
                  onChange={e => setIChingQuestion(e.target.value)}
                  placeholder="Например: Что мне нужно знать о моей текущей ситуации?"
                  style={{ width: '100%', padding: '16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', minHeight: 120, fontSize: 15, fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="button"
                  onClick={startIChingCasting}
                  disabled={!iChingQuestion.trim()}
                  style={{ padding: '12px 24px', fontSize: 15 }}
                >
                  Начать бросание монет →
                </button>
              </div>
            </div>
          </main>
        </div>
      );
    }

    if (iChingStep === 'casting') {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <ClientNavbar />
          <main
            style={{
              flex: 1,
              padding: '24px clamp(16px, 5vw, 48px)',
              maxWidth: '100%',
              overflowX: 'hidden',
              display: 'grid',
              placeItems: 'center'
            }}
          >
            <div className="card" style={{ padding: 32, maxWidth: 600, width: '100%', textAlign: 'center' }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>☯️</div>
                <h3 style={{ margin: 0, marginBottom: 8 }}>Бросание монет</h3>
                <div className="small" style={{ color: 'var(--text-muted)' }}>Линия {castingLine + 1} из 6</div>
              </div>
              
              {/* Анимация бросания монет */}
              <div style={{ marginBottom: 32, minHeight: 200, display: 'grid', placeItems: 'center' }}>
                {isCasting ? (
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    {[1, 2, 3].map(i => (
                      <div
                        key={i}
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 32,
                          animation: 'spin 1s linear infinite',
                          boxShadow: '0 4px 20px rgba(255,255,255,0.2)'
                        }}
                      >
                        🪙
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    {[1, 2, 3].map(i => (
                      <div
                        key={i}
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: '50%',
                          background: 'var(--surface-2)',
                          border: '2px solid rgba(255,255,255,0.12)',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 32
                        }}
                      >
                        🪙
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Отображение уже брошенных линий */}
              {iChingLines.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontWeight: 600, marginBottom: 12 }}>Построенная гексаграмма (снизу вверх):</div>
                  <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 8, alignItems: 'center' }}>
                    {iChingLines.map((line, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 40, textAlign: 'right' }}>
                          {idx + 1}
                        </div>
                        <div style={{
                          width: line.isYang ? 120 : 100,
                          height: 8,
                          background: line.isYang ? 'var(--primary)' : 'transparent',
                          border: line.isYang ? 'none' : '4px solid var(--primary)',
                          borderTop: line.isYang ? 'none' : '4px solid var(--primary)',
                          borderBottom: line.isYang ? 'none' : '4px solid var(--primary)',
                          position: 'relative'
                        }}>
                          {line.isChanging && (
                            <div style={{
                              position: 'absolute',
                              top: -4,
                              right: -4,
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              background: 'var(--accent)',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: 10
                            }}>
                              ⚡
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 30 }}>
                          {line.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isCasting && castingLine < 6 && (
                <button
                  className="button"
                  onClick={castNextLine}
                  style={{ padding: '12px 24px', fontSize: 15 }}
                >
                  Бросить следующую линию
                </button>
              )}
            </div>
          </main>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      );
    }
  }

  if (selectedTest) {
    const questions = selectedTest.type === 'spiral-dynamics' ? spiralQuestions : demoQuestions;
    const question = questions[currentQuestion];
    const totalQuestions = questions.length;
    const progress = ((currentQuestion + 1) / totalQuestions) * 100;

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <ClientNavbar />
          <main
            style={{
              flex: 1,
              padding: '24px clamp(16px, 5vw, 48px)',
              maxWidth: '100%',
              overflowX: 'hidden'
            }}
          >
          <div className="card" style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
            <div style={{ marginBottom: 20 }}>
              <button className="button secondary" onClick={() => { setSelectedTest(null); setCurrentQuestion(0); setAnswers({}); }} style={{ padding: '6px 12px', fontSize: 13 }}>← Назад</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>{selectedTest.title}</div>
              <div style={{ width: '100%', height: 8, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--accent))', transition: 'width 0.3s' }} />
              </div>
              <div className="small" style={{ marginTop: 8, color: 'var(--text-muted)' }}>Вопрос {currentQuestion + 1} из {totalQuestions}</div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 18 }}>{question.text}</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {question.options.map((option, idx) => (
                  <button
                    key={idx}
                    className={answers[question.id] === option ? 'button' : 'button secondary'}
                    onClick={() => handleAnswer(question.id, option)}
                    style={{ padding: '12px 16px', textAlign: 'left', fontSize: 15 }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="button" 
                onClick={nextQuestion}
                disabled={!answers[question.id]}
                style={{ padding: '10px 20px' }}
              >
                {currentQuestion === totalQuestions - 1 ? 'Завершить' : 'Далее →'}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ClientNavbar />
      <main
        style={{
          flex: 1,
          padding: '24px clamp(16px, 5vw, 48px)',
          maxWidth: '100%',
          overflowX: 'hidden'
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Тесты и мантические техники</h1>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {tests.map(test => (
            <div key={test.id} className="card card-hover-shimmer" style={{ 
              padding: 16, 
              display: 'flex', 
              flexDirection: 'column',
              minHeight: 280,
              height: '100%'
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{getTestIcon(test.type)}</div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{test.title}</div>
              <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 12, flex: 1 }}>{test.description}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                {test.questions && (
                  <div className="small" style={{ color: 'var(--text-muted)' }}>📝 {test.questions} вопросов</div>
                )}
                {test.duration && (
                  <div className="small" style={{ color: 'var(--text-muted)' }}>⏱ {test.duration} мин</div>
                )}
              </div>
              <button 
                className={test.completed ? 'button secondary' : 'button'}
                onClick={() => startTest(test)}
                style={{ width: '100%', padding: '10px', marginTop: 'auto' }}
              >
                {test.completed ? '✓ Пройден' : 'Начать тест'}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

