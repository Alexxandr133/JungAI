import type { DriveStep } from 'driver.js';

/** Селекторы вида [data-tour="…"] задаются в разметке страниц. */

export const PSYCHOLOGIST_DASHBOARD_TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Добро пожаловать на рабочий стол',
      description:
        'Это стартовый экран психолога. Отсюда вы видите сводку по практике и быстро переходите в клиенты, сессии, рабочую область и AI. Дальше коротко покажем, где что находится в меню и на этом экране.',
      side: 'over',
      align: 'center'
    }
  },
  {
    element: '[data-tour="psych-nav"]',
    popover: {
      title: 'Верхнее меню',
      description:
        'Главная навигация платформы. Пункты с ▼ открывают подменю при наведении. Справа — тема оформления, уведомления и меню профиля (выход, настройки аккаунта).',
      side: 'bottom',
      align: 'center'
    }
  },
  {
    element: '[data-tour="nav-main"]',
    popover: {
      title: 'Раздел «Основное»',
      description:
        'Рабочий стол (эта страница), Клиенты и Сессии (календарь, заявки на запись). Это ежедневный контур работы с людьми.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="nav-tools"]',
    popover: {
      title: 'Раздел «Инструменты»',
      description:
        'Рабочая область (заметки и вкладки по клиенту), Журнал снов, Необъяснимое и Амплификации. Здесь фиксируете кейс и наблюдения между сессиями.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="nav-ai"]',
    popover: {
      title: 'AI Ассистент',
      description:
        'Диалоги с ИИ по кейсу, шорткаты, привязка клиента, вложения и транскрибация аудио. Открывается одним кликом — отдельный полноэкранный инструмент.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="nav-communities"]',
    popover: {
      title: 'Сообщества',
      description:
        'Публикации — ваши статьи и сообщества; Лента — общий поток материалов коллег. Удобно для обмена практикой и обучения.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="nav-support"]',
    popover: {
      title: 'Техподдержка',
      description:
        'Если что-то сломалось или нужен доступ админа к рабочей области клиента — создайте запрос здесь. Обзор разделов — в Справочнике (меню профиля), статья «О платформе».',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="nav-actions"]',
    popover: {
      title: 'Тема, уведомления, профиль',
      description:
        'Переключатель светлой/тёмной темы, колокольчик уведомлений (приглашения, сообщения, ответы) и меню пользователя справа.',
      side: 'bottom',
      align: 'end'
    }
  },
  {
    element: '[data-tour="dash-hero"]',
    popover: {
      title: 'Приветствие и быстрый контекст',
      description:
        'Краткая сводка дня. Кнопка звонков ведёт к онлайн-встречам, блокнот — к личным заметкам прямо на столе. Отсюда удобно начинать рабочий день.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="dash-quick"]',
    popover: {
      title: 'Быстрые действия',
      description:
        'Запланировать встречу, открыть клиентов, перейти в рабочую зону по кейсу или открыть AI — без поиска по меню. Используйте, когда нужно сделать одно действие сразу.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="dash-cards"]',
    popover: {
      title: 'Карточки разделов',
      description:
        'Крупные переходы: события и сессии, клиенты, сны, публикации. Нажимайте карточку, чтобы попасть в нужный экран.',
      side: 'top'
    }
  },
  {
    element: '[data-tour="dash-widgets"]',
    popover: {
      title: 'Виджеты рабочего стола',
      description:
        'Настраиваемые блоки: клиенты, ближайшие сессии, сны и др. Их можно перетаскивать, менять размер и добавлять через «+». Так стол подстраивается под ваш ритм.',
      side: 'top',
      align: 'start'
    }
  }
];

export const PSYCHOLOGIST_CLIENTS_TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Раздел «Клиенты»',
      description:
        'Здесь живут все ваши клиенты: поиск, теги, приглашения на платформу, переход в карточку и рабочую область. Сначала разберём шапку и фильтры.',
      side: 'over',
      align: 'center'
    }
  },
  {
    element: '[data-tour="clients-header"]',
    popover: {
      title: 'Поиск',
      description:
        'Ищите по имени, почте, телефону, городу, тегам и связанным материалам. Введите запрос — список сузится.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="clients-add"]',
    popover: {
      title: 'Добавить клиента',
      description:
        'Кнопка создаёт карточку: контакты, теги и ссылка-приглашение. Клиент регистрируется по ссылке и появляется в вашем списке. Кнопка «?» справа повторно запускает этот обзор.',
      side: 'bottom',
      align: 'end'
    }
  },
  {
    element: '[data-tour="clients-views"]',
    popover: {
      title: 'Активные и архив',
      description:
        '«Активные» — текущая практика. «Архив» — завершённые терапии (клиент больше не видит вас как действующего специалиста). Переключайтесь, чтобы не смешивать потоки.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="clients-tags"]',
    popover: {
      title: 'Фильтры по тегам',
      description:
        'Теги помогают группировать запросы (тревога, сноведение и др.). Можно выбрать несколько и сбросить фильтр одной кнопкой.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="clients-grid"]',
    popover: {
      title: 'Карточки клиентов',
      description:
        'В карточке: контакты, теги, ссылка приглашения, обновление ссылки. Откройте клиента для деталей и перехода в рабочую область / сессии. Список обновляется после добавления или архивации.',
      side: 'top'
    }
  }
];

export const PSYCHOLOGIST_WORK_AREA_TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Рабочая область',
      description:
        'Личное пространство ведения кейса: вкладки (ведение, анамнез, сны и ваши собственные), редактор заметок и материалы по выбранному клиенту. Сохраняется на сервере.',
      side: 'over',
      align: 'center'
    }
  },
  {
    element: '[data-tour="workarea-header"]',
    popover: {
      title: 'Клиент и заголовок',
      description:
        'Выберите клиента в выпадающем списке — для него подгрузятся вкладки и сохранённый текст. Без выбранного клиента редактор пустой. Здесь же можно свернуть боковую панель вкладок.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="workarea-tabs"]',
    popover: {
      title: 'Вкладки ведения',
      description:
        'Стандартные и ваши вкладки: переименовывайте, удаляйте, меняйте порядок перетаскиванием. Добавляйте новую вкладку кнопкой «+». Каждая вкладка хранит свой текст/набор карточек.',
      side: 'right',
      align: 'start'
    }
  },
  {
    element: '[data-tour="workarea-editor"]',
    popover: {
      title: 'Редактор и материалы',
      description:
        'Пишите заметки по сессии, гипотезы, план. Есть форматирование. Сохранение идёт автоматически и по кнопке «Сохранить». На вкладках со снами/карточками открываются связанные записи клиента.',
      side: 'left',
      align: 'start'
    }
  }
];

export const PSYCHOLOGIST_AI_TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'AI Ассистент',
      description:
        'Помощник для гипотез, структуры сессии и разбора материалов. Важно: выбирайте модальность в настройках и при необходимости привязывайте клиента — так ответы точнее и этичнее.',
      side: 'over',
      align: 'center'
    }
  },
  {
    element: '[data-tour="ai-sidebar"]',
    popover: {
      title: 'Чаты и папки',
      description:
        'Слева: «Новый чат», «Новая папка», список диалогов. Группируйте темы в папки, переименовывайте чаты, переключайтесь между историями — контекст каждого диалога сохраняется.',
      side: 'right',
      align: 'start'
    }
  },
  {
    element: '[data-tour="ai-header"]',
    popover: {
      title: 'Панель чата',
      description:
        'Заголовок показывает текущий режим и модальность. Здесь же кнопка «Транскрибация» (аудио → текст), «?» для повтора тура и шестерёнка настроек ИИ (модальность, персонализация).',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="ai-transcription"]',
    popover: {
      title: 'Транскрибация',
      description:
        'Загрузите запись сессии или голосовую заметку — получите текст расшифровки в базе (файл не хранится). Потом текст можно использовать в чате или в рабочей области.',
      side: 'bottom',
      align: 'end'
    }
  },
  {
    element: '[data-tour="ai-settings"]',
    popover: {
      title: 'Настройки ИИ',
      description:
        'Модальность (школа/подход), персонализация ассистента и связанные параметры. Не смешивайте несовместимые школы в одном запросе — от этого зависит качество ответа.',
      side: 'bottom',
      align: 'end'
    }
  },
  {
    element: '[data-tour="ai-main"]',
    popover: {
      title: 'Диалог и шорткаты',
      description:
        'Пишите запрос в поле внизу, прикрепляйте PDF/DOCX/изображения. Шорткаты подставляют готовые промпты (можно редактировать). При выбранном клиенте ассистент опирается на доступный контекст платформы.',
      side: 'left',
      align: 'start'
    }
  }
];

export const PSYCHOLOGIST_SESSIONS_TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Сессии и встречи',
      description:
        'Календарь вашей практики: терапевтические сессии, видеокомнаты, приглашения клиенту. Время показывается в вашем локальном часовом поясе.',
      side: 'over',
      align: 'center'
    }
  },
  {
    element: '[data-tour="events-header"]',
    popover: {
      title: 'Заголовок раздела',
      description:
        'Здесь видно название раздела и часовой пояс. Кнопка «?» снова запускает этот обзор, если что-то забыли.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="events-toolbar"]',
    popover: {
      title: 'Фильтры и планирование',
      description:
        'Фильтр по типу события, переключение на историю прошедших встреч. «Запланировать» создаёт событие, выбирает клиента и при необходимости комнату для видеозвонка.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="events-my-clients"]',
    popover: {
      title: 'Мои клиенты',
      description:
        'Список клиентов с ближайшей встречей. «Запланировать» создаёт одну сессию, «Постоянный слот» — еженедельную серию, которая занимает публичный календарь.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="events-list"]',
    popover: {
      title: 'Расписание',
      description:
        'События по дням: время, тип, статус принятия клиентом, вход в комнату и копирование ссылки-приглашения. Откройте карточку события, чтобы изменить или отменить встречу.',
      side: 'top',
      align: 'start'
    }
  }
];

export const PSYCHOLOGIST_MESSAGES_TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Сообщения',
      description:
        'Внутренний чат с клиентами: согласования, уточнения и переписка без мессенджеров снаружи. Слева список диалогов, справа — переписка.',
      side: 'over',
      align: 'center'
    }
  },
  {
    element: '[data-tour="messages-sidebar"]',
    popover: {
      title: 'Список диалогов',
      description:
        'Выберите клиента или комнату чата слева. На мобильном сначала виден список — после выбора открывается переписка.',
      side: 'right',
      align: 'start'
    }
  },
  {
    element: '[data-tour="messages-main"]',
    popover: {
      title: 'Переписка',
      description:
        'История сообщений и поле ввода внизу. Используйте для оперативных уточнений; содержательную работу по кейсу удобнее вести в рабочей области и на сессиях.',
      side: 'left',
      align: 'start'
    }
  }
];

export const PSYCHOLOGIST_REQUESTS_TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Заявки и запросы',
      description:
        'Блок на экране Сессии: заявки с публичной страницы и анкеты подбора. «Принять» создаёт первую встречу, если выбран слот; запрос на ведение — без календаря.',
      side: 'over',
      align: 'center'
    }
  },
  {
    element: '[data-tour="events-requests"]',
    popover: {
      title: 'Единый блок заявок',
      description:
        'Бейджи типа, анкета гридом, действия «Принять / Написать / Отклонить». «Написать» недоступно гостям без аккаунта.',
      side: 'bottom'
    }
  }
];

export const PSYCHOLOGIST_DREAMS_TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Журнал снов',
      description:
        'Карточки сновидений клиентов и ваши записи. Можно искать, фильтровать «все / мои» и открывать сон для разбора или связи с рабочей областью.',
      side: 'over',
      align: 'center'
    }
  },
  {
    element: '[data-tour="dreams-header"]',
    popover: {
      title: 'Шапка раздела',
      description:
        'Заголовок и счётчик записей. «+ Новая запись» открывает форму сна (для психолога — с привязкой к клиенту).',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="dreams-toolbar"]',
    popover: {
      title: 'Поиск и фильтр',
      description:
        'Поиск по названию и тексту. Переключатель «Все / Мои» помогает отделить личные записи от клиентских.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="dreams-grid"]',
    popover: {
      title: 'Карточки снов',
      description:
        'Клик по карточке открывает детали. Отсюда удобно брать материал для сессии, амплификаций и AI-разбора.',
      side: 'top'
    }
  }
];

export const PSYCHOLOGIST_PARANORMAL_TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Необъяснимое',
      description:
        'Карточки необычных феноменов и синхроний — в едином формате для последующего анализа и связи с клиентом.',
      side: 'over',
      align: 'center'
    }
  },
  {
    element: '[data-tour="paranormal-header"]',
    popover: {
      title: 'Шапка и создание',
      description:
        '«+ Новая запись» — название, описание и клиент. Поиск и фильтр «Все / Мои» справа.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="paranormal-grid"]',
    popover: {
      title: 'Карточки явлений',
      description:
        'Краткое описание и дата. Кнопка «К клиенту» открывает рабочую область, если запись привязана к клиенту.',
      side: 'top'
    }
  }
];

export const PSYCHOLOGIST_MATERIALS_TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Библиотека',
      description:
        'База знаний: книги, статьи, лекции и видео. Используйте как персональную подборку под метод и кейсы.',
      side: 'over',
      align: 'center'
    }
  },
  {
    element: '[data-tour="materials-header"]',
    popover: {
      title: 'Поиск материалов',
      description:
        'Ищите по названию и тегам. Ниже материалы сгруппированы по типам — откройте карточку, чтобы перейти к содержимому.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="materials-list"]',
    popover: {
      title: 'Коллекции',
      description:
        'Секции «Книги», «Материалы», «Видео». Клик по элементу открывает страницу материала.',
      side: 'top'
    }
  }
];

export const PSYCHOLOGIST_AMPLIFICATIONS_TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Амплификации',
      description:
        'Сборник символов, архетипов и интерпретаций — методическая опора при анализе снов и образов.',
      side: 'over',
      align: 'center'
    }
  },
  {
    element: '[data-tour="amplifications-header"]',
    popover: {
      title: 'Создание и заголовок',
      description:
        '«+ Добавить амплификацию» — новая карточка символа. Ниже поиск и фильтр по категориям.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="amplifications-filters"]',
    popover: {
      title: 'Поиск и категории',
      description:
        'Фильтруйте по тексту и категории, чтобы быстро найти нужный символ во время подготовки к сессии.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="amplifications-list"]',
    popover: {
      title: 'Список амплификаций',
      description:
        'У каждой записи: символ, категория и содержание. Редактируйте и дополняйте базу под свою практику.',
      side: 'top'
    }
  }
];

export const PSYCHOLOGIST_PUBLICATIONS_TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Публикации',
      description:
        'Ваши статьи и сообщества. Слева — профиль и список сообществ, справа — лента ваших публикаций и создание поста.',
      side: 'over',
      align: 'center'
    }
  },
  {
    element: '[data-tour="publications-sidebar"]',
    popover: {
      title: 'Профиль и сообщества',
      description:
        'Карточка профиля и список сообществ. Можно создать сообщество (если доступно) и открыть его страницу управления.',
      side: 'right',
      align: 'start'
    }
  },
  {
    element: '[data-tour="publications-main"]',
    popover: {
      title: 'Ваши публикации',
      description:
        'Создавайте посты от себя или от сообщества (если вы владелец). Открывайте полную статью для комментариев и правок.',
      side: 'left',
      align: 'start'
    }
  }
];

export const PSYCHOLOGIST_FEED_TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Лента',
      description:
        'Общий поток публикаций авторов и сообществ. Удобно следить за коллегами и находить полезные материалы.',
      side: 'over',
      align: 'center'
    }
  },
  {
    element: '[data-tour="feed-header"]',
    popover: {
      title: 'Шапка ленты',
      description:
        'Переход к «Моим публикациям», сброс фильтра по автору. Отсюда же видно активный фильтр, если открыли ленту автора.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="feed-communities"]',
    popover: {
      title: 'Сообщества',
      description:
        'Быстрый переход в сообщества платформы. Клик открывает страницу сообщества.',
      side: 'right',
      align: 'start'
    }
  },
  {
    element: '[data-tour="feed-posts"]',
    popover: {
      title: 'Посты ленты',
      description:
        'Клик по посту открывает полную публикацию и комментарии. На узком экране используйте ссылку в заголовке карточки.',
      side: 'top'
    }
  }
];

export const PSYCHOLOGIST_SUPPORT_TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Техподдержка',
      description:
        'Канал связи с администраторами платформы: баги, доступы, вопросы по кабинету.',
      side: 'over',
      align: 'center'
    }
  },
  {
    element: '[data-tour="support-header"]',
    popover: {
      title: 'Создать запрос',
      description:
        'Кнопка «Создать запрос» открывает форму: тема, описание, при необходимости доступ к рабочей области конкретного клиента для разбора проблемы.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="support-list"]',
    popover: {
      title: 'История запросов',
      description:
        'Статусы обработки и ответы администратора появляются здесь. Следите за обновлениями, пока тикет не закрыт.',
      side: 'top'
    }
  }
];
