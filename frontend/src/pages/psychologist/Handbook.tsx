import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { PlatformIcon, type PlatformIconName } from '../../components/icons';
import './Handbook.css';

type BodyBlock =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'path'; to: string; label: string };

type HandbookArticle = {
  id: string;
  title: string;
  summary: string;
  kind?: 'guide' | 'video' | 'training' | 'material';
  body: BodyBlock[];
};

type HandbookSection = {
  id: string;
  title: string;
  icon: PlatformIconName;
  description: string;
  articles: HandbookArticle[];
};

const HANDBOOK_SECTIONS: HandbookSection[] = [
  {
    id: 'start',
    title: 'С чего начать',
    icon: 'dashboard',
    description: 'Онбординг, карта меню и первый рабочий день.',
    articles: [
      {
        id: 'welcome',
        title: 'Добро пожаловать в JungAI',
        summary: 'Зачем платформа психологу и как устроен кабинет.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'JungAI — рабочая среда для психолога: клиенты, сессии, заметки по кейсу, сны, AI-помощник, материалы и профессиональное сообщество в одном контуре.'
          },
          {
            type: 'p',
            text: 'Клиентский кабинет и ваш кабинет связаны: приглашение, сессии, сообщения и наблюдения между встречами не размазаны по мессенджерам.'
          },
          { type: 'h', text: 'С чего удобно начать' },
          {
            type: 'ul',
            items: [
              'Рабочий стол — сводка дня и быстрые переходы',
              'Профиль — данные и верификация',
              'Туры на экранах (кнопка «?») — короткий обзор раздела',
              'Этот справочник — подробные статьи по каждой странице'
            ]
          },
          { type: 'path', to: '/psychologist', label: 'Открыть рабочий стол' }
        ]
      },
      {
        id: 'navigation',
        title: 'Карта меню',
        summary: 'Коротко о каждой вкладке — зачем она вам в обычный рабочий день.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Сверху — ваше «рабочее пространство». Пункты с стрелкой раскрываются при наведении; справа живут тема, уведомления и ваш профиль. Ниже — смысл каждой вкладки простыми словами.'
          },
          { type: 'h', text: 'Основное' },
          {
            type: 'ul',
            items: [
              'Рабочий стол — утро практики: что горит сегодня и куда быстрее зайти.',
              'Клиенты — CRM. Здесь вы управляете клиентами, приглашаете и ведёте список.',
              'Сессии — когда встречаетесь. Календарь, приглашения и вход в комнату звонка.',
              'Сообщения — чат с клиентом без сторонних мессенджеров.',
              'Заявки на /events — кто сам к вам постучался: принять, ответить или вежливо отказать.'
            ]
          },
          { type: 'h', text: 'Инструменты' },
          {
            type: 'ul',
            items: [
              'Рабочая область — тетрадь по кейсу: заметки, вкладки, то, что не хочется терять между сессиями.',
              'Журнал снов — сны клиентов и ваши записи в одном месте, чтобы возвращаться к образам.',
              'Необъяснимое — синхронии и странные совпадения, которые жалко забыть.',
              'Амплификации — символы и интерпретации под рукой, когда нужна опора.'
            ]
          },
          { type: 'h', text: 'AI и сообщество' },
          {
            type: 'ul',
            items: [
              'AI Ассистент — когда нужно набросать гипотезу, структуру сессии или расшифровать запись.',
              'Публикации и лента — писать своё и читать коллег, без отрыва от кабинета.'
            ]
          },
          { type: 'h', text: 'Ещё рядом' },
          {
            type: 'ul',
            items: [
              'О платформе — короткий обзор (статья в этом справочнике).',
              'Техподдержка — если что-то сломалось или нужен доступ к разбору.',
              'Справочник — эта wiki: подробности по экранам (открывается из меню профиля).'
            ]
          }
        ]
      },
      {
        id: 'first-day',
        title: 'Чеклист первого дня',
        summary: 'Пошаговый запуск практики на платформе.',
        kind: 'guide',
        body: [
          {
            type: 'ul',
            items: [
              'Дождитесь верификации (если раздел закрыт — откройте профиль и проверьте статус).',
              'Заполните профиль: имя, контакты, сведения для каталога при необходимости.',
              'Добавьте клиента или примите входящий запрос.',
              'Скопируйте ссылку-приглашение и отправьте клиенту.',
              'Запланируйте первую сессию в разделе «Сессии».',
              'Откройте рабочую область и создайте первую заметку по кейсу.',
              'При желании настройте AI: модальность и персонализацию.'
            ]
          },
          { type: 'path', to: '/psychologist/profile', label: 'Открыть профиль' }
        ]
      },
      {
        id: 'tours',
        title: 'Туры по разделам',
        summary: 'Как работает кнопка «?» и автозапуск при первом визите.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'При первом заходе на ключевые экраны запускается пошаговый тур. Он подсвечивает блоки интерфейса и объясняет, что где находится.'
          },
          {
            type: 'p',
            text: 'Повторный запуск — кнопка «?» (иконка информации) в шапке раздела. Закрытие тура сохраняет флаг «уже видел» для этого экрана; повтор через «?» не сбрасывает флаг автоматически, но снова показывает подсказки.'
          },
          {
            type: 'ul',
            items: [
              'Туры есть на: рабочем столе, клиентах, сессиях, рабочей области, AI, сообщениях, запросах, снах, необъяснимом, библиотеке, амплификациях, публикациях, ленте, техподдержке.',
              'Если элемент временно скрыт (например, блок «Требуют внимания»), шаг пропускается.'
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'main',
    title: 'Основное',
    icon: 'chart',
    description: 'Ежедневный контур: стол, клиенты, сессии, чат и заявки.',
    articles: [
      {
        id: 'dashboard',
        title: 'Рабочий стол',
        summary: 'Стартовый экран дня: сводка, быстрые действия и виджеты.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Рабочий стол — точка входа после входа в кабинет. Здесь видно контекст практики и можно сразу перейти к нужному действию без поиска по меню.'
          },
          { type: 'h', text: 'Что на экране' },
          {
            type: 'ul',
            items: [
              'Блок приветствия — краткая сводка и быстрый доступ к звонкам/блокноту (если доступны на вашем экране).',
              'Быстрые действия — запланировать встречу, открыть клиентов, рабочую область, AI.',
              'Карточки разделов — крупные переходы в сессии, клиентов, сны, публикации.',
              'Виджеты — настраиваемые блоки (клиенты, сессии, активность). Их можно перетаскивать, менять размер и добавлять через «+».'
            ]
          },
          { type: 'h', text: 'Как пользоваться' },
          {
            type: 'p',
            text: 'Начинайте день со стола: проверьте ближайшие сессии и виджеты внимания, затем уходите в нужный раздел. Тур экрана (кнопка «?») подробно объясняет навигацию всей платформы.'
          },
          { type: 'path', to: '/psychologist', label: 'Перейти на рабочий стол' }
        ]
      },
      {
        id: 'clients',
        title: 'Клиенты',
        summary: 'Список практики: поиск, теги, приглашения, активные и архив.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Раздел «Клиенты» — реестр людей, с которыми вы работаете. Здесь создаёте карточки, выдаёте ссылку регистрации и переходите в кейс.'
          },
          { type: 'h', text: 'Основные действия' },
          {
            type: 'ul',
            items: [
              'Поиск — по имени, почте, телефону, городу, тегам и связанным материалам.',
              '«Добавить клиента» — создание карточки и контактов.',
              'Ссылка-приглашение — клиент регистрируется и привязывается к вам; ссылку можно обновить.',
              'Теги — фильтры по темам работы (тревога, сноведение и др.).',
              'Активные / Архив — текущая практика и завершённые терапии.'
            ]
          },
          { type: 'h', text: 'Важно' },
          {
            type: 'p',
            text: 'После завершения терапии (архивация) клиент больше не видит вас как действующего специалиста. Это ожидаемое поведение soft-завершения.'
          },
          { type: 'path', to: '/clients', label: 'Открыть клиентов' }
        ]
      },
      {
        id: 'sessions',
        title: 'Сессии и встречи',
        summary: 'Календарь практики, приглашения и видеокомнаты.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Единый календарь событий: терапевтические сессии, видеовстречи и связанные форматы. Время показывается в вашем локальном часовом поясе.'
          },
          { type: 'h', text: 'Как работать' },
          {
            type: 'ul',
            items: [
              '«Запланировать» — создать событие, выбрать клиента и параметры встречи.',
              'Фильтры по типу и переключение на историю прошедших встреч.',
              'В карточке события — статус принятия клиентом, вход в комнату, копирование приглашения.',
              'Блок «Требуют внимания» подсказывает клиентов без недавних сессий (если есть такие кейсы).'
            ]
          },
          { type: 'h', text: 'Видеокомната' },
          {
            type: 'p',
            text: 'Онлайн-встреча проходит на платформе (/room/…). Клиент может войти по ссылке; для гостевого входа предусмотрен отдельный сценарий с отображаемым именем.'
          },
          { type: 'path', to: '/events', label: 'Открыть сессии' }
        ]
      },
      {
        id: 'messages',
        title: 'Сообщения',
        summary: 'Внутренний чат с клиентами в стиле переписки.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Сообщения — оперативная переписка внутри JungAI: уточнения, согласования времени, короткие ответы без внешних мессенджеров.'
          },
          { type: 'h', text: 'Интерфейс' },
          {
            type: 'ul',
            items: [
              'Слева — список диалогов/клиентов.',
              'Справа — история и поле ввода.',
              'На мобильном сначала список, после выбора — переписка.'
            ]
          },
          {
            type: 'p',
            text: 'Содержательную фиксацию кейса лучше вести в рабочей области; чат — для коммуникации, а не для длинных клинических заметок.'
          },
          { type: 'path', to: '/messages', label: 'Открыть сообщения' }
        ]
      },
      {
        id: 'requests',
        title: 'Заявки и запросы',
        summary: 'Входящие заявки на слот и из подбора — на экране Сессии.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Блок «Заявки и запросы» на /events объединяет заявки с публичной страницы и анкеты подбора.'
          },
          { type: 'h', text: 'Действия по заявке' },
          {
            type: 'ul',
            items: [
              '«Принять» — событие с бейджем «Первая встреча».',
              '«Написать» — чат, если у заявителя есть аккаунт (иначе disabled).',
              '«Отклонить» — с причиной на email/в чат.',
              '«В клиенты» — на карточке первой встречи после принятия.'
            ]
          },
          { type: 'path', to: '/events#requests', label: 'Открыть заявки в сессиях' }
        ]
      }
    ]
  },
  {
    id: 'tools',
    title: 'Инструменты',
    icon: 'hammer',
    description: 'Ведение кейса, сны, феномены и амплификации.',
    articles: [
      {
        id: 'work-area',
        title: 'Рабочая область',
        summary: 'Главное место ведения случая: вкладки и редактор по клиенту.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Рабочая область — пространство документов и наблюдений по выбранному клиенту. Выберите клиента в шапке — подгрузятся его вкладки и сохранённый контент.'
          },
          { type: 'h', text: 'Вкладки' },
          {
            type: 'ul',
            items: [
              'Стандартные и ваши собственные вкладки (ведение, анамнез, сны и др.).',
              'Переименование, удаление, смена порядка перетаскиванием.',
              'Добавление новой вкладки кнопкой «+».',
              'На части вкладок — карточки связанных материалов (сны и т.п.), а не только текст.'
            ]
          },
          { type: 'h', text: 'Редактор' },
          {
            type: 'p',
            text: 'Текстовое поле с форматированием. Сохранение автоматическое и по кнопке «Сохранить». Используйте как единый журнал наблюдений между сессиями.'
          },
          { type: 'path', to: '/psychologist/work-area', label: 'Открыть рабочую область' }
        ]
      },
      {
        id: 'dreams',
        title: 'Журнал снов',
        summary: 'Карточки сновидений клиентов и ваши записи.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Журнал снов собирает сновидения в карточках: название, текст, дата. Психолог может создавать запись с привязкой к клиенту.'
          },
          { type: 'h', text: 'Возможности' },
          {
            type: 'ul',
            items: [
              '«+ Новая запись» — форма создания сна.',
              'Поиск по названию и тексту.',
              'Фильтр «Все / Мои».',
              'Открытие карточки для детального просмотра и дальнейшей работы (в т.ч. с AI и амплификациями).'
            ]
          },
          { type: 'path', to: '/dreams', label: 'Открыть журнал снов' }
        ]
      },
      {
        id: 'paranormal',
        title: 'Необъяснимое',
        summary: 'Синхронии и необычные феномены в едином формате.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Раздел для фиксации необычных явлений и синхроний: название, описание, привязка к клиенту. Удобно собирать наблюдения «в моменте» и возвращаться к ним на сессии.'
          },
          {
            type: 'ul',
            items: [
              'Создание записи через «+ Новая запись».',
              'Поиск и фильтр «Все / Мои».',
              'Кнопка «К клиенту» — переход в рабочую область привязанного клиента.'
            ]
          },
          { type: 'path', to: '/paranormal', label: 'Открыть необъяснимое' }
        ]
      },
      {
        id: 'amplifications',
        title: 'Амплификации',
        summary: 'Символы, архетипы и интерпретации для опоры в анализе.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Амплификации — методическая база: символ, заголовок, содержание, категория и теги. Используйте как опору при анализе снов и образов. Раздел открывается из меню «Инструменты».'
          },
          {
            type: 'ul',
            items: [
              'Поиск и фильтры по категории/тегам.',
              'Карточка амплификации с полным текстом.',
              'Можно опираться из журнала снов и AI-чата.'
            ]
          },
          { type: 'path', to: '/research/amplifications', label: 'Открыть амплификации' }
        ]
      }
    ]
  },
  {
    id: 'ai',
    title: 'AI Ассистент',
    icon: 'bot',
    description: 'Диалоги, шорткаты, вложения, транскрибация и настройки.',
    articles: [
      {
        id: 'ai-chat',
        title: 'AI чат',
        summary: 'Диалоговый помощник по кейсу и подготовке к сессии.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'AI Ассистент помогает формулировать гипотезы, структуру сессии и разбор материалов. Качество ответа зависит от модальности (школы/подхода) и ясности запроса.'
          },
          { type: 'h', text: 'Слевая панель' },
          {
            type: 'ul',
            items: [
              '«Новый чат» и «Новая папка» — организация историй.',
              'Список диалогов с переключением контекста.',
              'Переименование и группировка по папкам.'
            ]
          },
          { type: 'h', text: 'Основная область' },
          {
            type: 'ul',
            items: [
              'Поле ввода и история сообщений.',
              'Шорткаты — готовые промпты (можно редактировать).',
              'Вложения: PDF, DOCX, изображения (с лимитом количества файлов).',
              'Привязка клиента усиливает контекст, когда данные доступны на платформе.'
            ]
          },
          {
            type: 'p',
            text: 'Не смешивайте несовместимые терапевтические школы в одном потоке настроек — модальность задаёт рамку ответов.'
          },
          { type: 'path', to: '/psychologist/ai', label: 'Открыть AI' }
        ]
      },
      {
        id: 'ai-transcription',
        title: 'Транскрибация',
        summary: 'Аудио → текст; файл не хранится в системе.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Кнопка «Транскрибация» в шапке AI переключает режим: загружаете запись сессии или голосовую заметку и получаете текст расшифровки.'
          },
          {
            type: 'ul',
            items: [
              'Текст сохраняется в базе для дальнейшей работы.',
              'Исходный аудиофайл не хранится на сервере как постоянный медиаархив.',
              'Расшифровку можно использовать в чате AI или перенести в рабочую область.'
            ]
          },
          { type: 'path', to: '/psychologist/ai', label: 'Открыть AI / транскрибацию' }
        ]
      },
      {
        id: 'ai-settings',
        title: 'Настройки и персонализация',
        summary: 'Модальность, память ассистента и параметры диалога.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Шестерёнка в шапке AI открывает настройки: модальность, персонализация («давайте познакомимся» / память) и связанные параметры.'
          },
          {
            type: 'p',
            text: 'Задайте ассистенту устойчивый контекст о вашем стиле работы — это уменьшает «общие» ответы и делает подсказки ближе к вашей практике.'
          },
          { type: 'path', to: '/psychologist/ai', label: 'Открыть AI' }
        ]
      }
    ]
  },
  {
    id: 'research',
    title: 'Сообщества',
    icon: 'book',
    description: 'Публикации и общая лента.',
    articles: [
      {
        id: 'publications',
        title: 'Публикации',
        summary: 'Ваши статьи, сообщества и черновики.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Раздел «Публикации» — ваш контент и сообщества. Слева профиль и список сообществ, справа — создание поста и лента ваших публикаций.'
          },
          {
            type: 'ul',
            items: [
              'Создание сообщества (если роль позволяет).',
              'Публикация от аккаунта или от сообщества (для владельца/модератора).',
              'Редактор с форматированием, изображение к посту.',
              'Открытие полной статьи для комментариев и правок.'
            ]
          },
          { type: 'path', to: '/publications', label: 'Открыть публикации' }
        ]
      },
      {
        id: 'feed',
        title: 'Лента',
        summary: 'Общий поток постов авторов и сообществ.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Лента показывает публикации коллег: сообщества слева, посты в центре, авторы/фильтры справа (на широком экране).'
          },
          {
            type: 'ul',
            items: [
              'Фильтр по автору и сброс фильтра.',
              'Переход в «Мои публикации».',
              'Клик по посту — полная статья и комментарии.'
            ]
          },
          { type: 'path', to: '/feed', label: 'Открыть ленту' }
        ]
      }
    ]
  },
  {
    id: 'account',
    title: 'Аккаунт и помощь',
    icon: 'user',
    description: 'Профиль, справочник, «О платформе» и техподдержка.',
    articles: [
      {
        id: 'profile',
        title: 'Профиль психолога',
        summary: 'Личные данные, аватар и статус верификации.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'В профиле вы управляете данными аккаунта, аватаром и сведениями, которые могут отображаться в каталоге/публичных сценариях. Если функционал закрыт — чаще всего нужна верификация.'
          },
          {
            type: 'ul',
            items: [
              'Проверьте статус верификации при первом входе.',
              'Обновляйте контакты и отображаемое имя.',
              'Из меню профиля также открывается этот справочник.'
            ]
          },
          { type: 'path', to: '/psychologist/profile', label: 'Открыть профиль' }
        ]
      },
      {
        id: 'handbook',
        title: 'Справочник',
        summary: 'Где лежит база знаний и как по ней ходить.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Справочник открывается только из меню иконки профиля (пункт «Справочник» перед «Профиль»). В главном верхнем меню его нет специально — чтобы не смешивать ежедневную навигацию и базу знаний.'
          },
          {
            type: 'ul',
            items: [
              'Слева — разделы и список статей.',
              'Справа — полный текст выбранной статьи.',
              'Поиск фильтрует статьи текущего раздела.',
              'Сюда будем добавлять обучения, видео и новые материалы.'
            ]
          },
          { type: 'path', to: '/psychologist/handbook', label: 'Обновить справочник' }
        ]
      },
      {
        id: 'about',
        title: 'О платформе',
        summary: 'Обзорная документация по разделам для вашей роли.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Статья «О платформе» в этом справочнике — краткая карта продукта. Отдельная страница `/about` остаётся доступной по прямой ссылке, но в главном меню психолога вкладки больше нет.'
          },
          {
            type: 'ul',
            items: [
              'Откройте эту статью из раздела «Аккаунт и помощь».',
              'Или перейдите по кнопке ниже на полную обзорную страницу.'
            ]
          },
          { type: 'path', to: '/about', label: 'Открыть полную страницу «О платформе»' }
        ]
      },
      {
        id: 'support',
        title: 'Техподдержка',
        summary: 'Запросы администратору: баги, доступы, разбор проблем.',
        kind: 'guide',
        body: [
          {
            type: 'p',
            text: 'Если что-то сломалось или нужен разбор с доступом к рабочей области клиента — создайте запрос в техподдержку.'
          },
          {
            type: 'ul',
            items: [
              'Укажите тему и подробное описание.',
              'При необходимости разрешите доступ к рабочей области выбранного клиента.',
              'Ответ администратора и статусы отображаются в списке ваших запросов.'
            ]
          },
          { type: 'path', to: '/psychologist/support', label: 'Открыть техподдержку' }
        ]
      },
      {
        id: 'faq',
        title: 'Частые вопросы',
        summary: 'Верификация, архив клиентов, туры, приглашения.',
        kind: 'guide',
        body: [
          { type: 'h', text: 'Не открывается раздел' },
          {
            type: 'p',
            text: 'Проверьте верификацию в профиле. Для психолога часть функций доступна только после подтверждения.'
          },
          { type: 'h', text: 'Клиент пропал / не видит меня' },
          {
            type: 'p',
            text: 'Если терапия завершена (архив), клиент больше не видит вас как активного специалиста. Активные клиенты — во вкладке «Активные».'
          },
          { type: 'h', text: 'Как снова посмотреть тур' },
          {
            type: 'p',
            text: 'Нажмите кнопку «?» на экране раздела — обзор запустится снова.'
          },
          { type: 'h', text: 'Клиент не пришёл по ссылке' },
          {
            type: 'p',
            text: 'Обновите ссылку-приглашение в карточке клиента и отправьте новую. Проверьте срок действия ссылки, если он отображается.'
          }
        ]
      }
    ]
  },
  {
    id: 'trainings',
    title: 'Обучения и видео',
    icon: 'trophy',
    description: 'Место под курсы и видеоконтент (каркас готов к наполненинию).',
    articles: [
      {
        id: 'trainings-overview',
        title: 'Обучающие программы',
        summary: 'Как будет устроен блок курсов в справочнике.',
        kind: 'training',
        body: [
          {
            type: 'p',
            text: 'Этот раздел зарезервирован под программы обучения: модули, уроки, материалы к занятиям и прогресс. Сейчас — каркас wiki; контент будем публиковать сюда же, в том же формате статей.'
          },
          {
            type: 'ul',
            items: [
              'Планируемые типы: вводный курс по платформе, методические модули, разборы кейсов.',
              'Каждый курс получит отдельную статью/серию статей со ссылками на экраны JungAI.'
            ]
          }
        ]
      },
      {
        id: 'videos-overview',
        title: 'Видеоматериалы',
        summary: 'Плейлисты и обзоры интерфейса — в разработке.',
        kind: 'video',
        body: [
          {
            type: 'p',
            text: 'Здесь появятся видео: онбординг по кабинету, сценарии «клиент → сессия → заметка», обзоры AI и рабочей области.'
          },
          {
            type: 'p',
            text: 'Пока опирайтесь на статьи этого справочника и встроенные туры («?») на страницах.'
          }
        ]
      }
    ]
  }
];

const KIND_LABEL: Record<NonNullable<HandbookArticle['kind']>, string> = {
  guide: 'Инструкция',
  video: 'Видео',
  training: 'Обучение',
  material: 'Материал'
};

function articleSearchText(article: HandbookArticle): string {
  const parts = [article.title, article.summary];
  for (const block of article.body) {
    if (block.type === 'p' || block.type === 'h') parts.push(block.text);
    if (block.type === 'ul') parts.push(...block.items);
    if (block.type === 'path') parts.push(block.label, block.to);
  }
  return parts.join(' ').toLowerCase();
}

function BodyRenderer({ body }: { body: BodyBlock[] }) {
  return (
    <div className="handbook-content__body">
      {body.map((block, idx) => {
        if (block.type === 'p') return <p key={idx}>{block.text}</p>;
        if (block.type === 'h') return <h3 key={idx}>{block.text}</h3>;
        if (block.type === 'ul') {
          return (
            <ul key={idx}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx} className="handbook-content__path">
            <Link to={block.to} className="button">
              {block.label}
            </Link>
          </p>
        );
      })}
    </div>
  );
}

export default function PsychologistHandbook() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const sectionId = searchParams.get('section') || HANDBOOK_SECTIONS[0].id;
  const articleId = searchParams.get('article') || '';

  const activeSection = useMemo(
    () => HANDBOOK_SECTIONS.find((s) => s.id === sectionId) || HANDBOOK_SECTIONS[0],
    [sectionId]
  );

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeSection.articles;
    return activeSection.articles.filter((a) => articleSearchText(a).includes(q));
  }, [activeSection, query]);

  const activeArticle = useMemo(() => {
    const fromQuery = activeSection.articles.find((a) => a.id === articleId);
    if (fromQuery && filteredArticles.some((a) => a.id === fromQuery.id)) return fromQuery;
    return filteredArticles[0] || null;
  }, [activeSection, articleId, filteredArticles]);

  function openSection(id: string) {
    const section = HANDBOOK_SECTIONS.find((s) => s.id === id);
    const first = section?.articles[0];
    if (first) setSearchParams({ section: id, article: first.id });
    else setSearchParams({ section: id });
    setMobileNavOpen(false);
  }

  function openArticle(section: string, article: string) {
    setSearchParams({ section, article });
    setMobileNavOpen(false);
  }

  return (
    <div className="handbook-shell">
      <PsychologistNavbar />
      <div className="handbook-layout">
        <aside className={`handbook-nav${mobileNavOpen ? ' is-open' : ''}`}>
          <div className="handbook-nav__head">
            <div className="handbook-nav__eyebrow">Wiki</div>
            <h1 className="handbook-nav__title">Справочник</h1>
            <p className="handbook-nav__lead">Полное описание экранов кабинета психолога, обучения и материалы.</p>
            <input
              className="handbook-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск в разделе…"
              aria-label="Поиск по справочнику"
            />
          </div>

          <nav className="handbook-sections" aria-label="Разделы справочника">
            {HANDBOOK_SECTIONS.map((section) => {
              const active = section.id === activeSection.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  className={`handbook-section${active ? ' is-active' : ''}`}
                  onClick={() => openSection(section.id)}
                >
                  <span className="handbook-section__icon">
                    <PlatformIcon name={section.icon} size={18} strokeWidth={1.7} />
                  </span>
                  <span className="handbook-section__text">
                    <span className="handbook-section__name">{section.title}</span>
                    <span className="handbook-section__count">{section.articles.length}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="handbook-articles">
            <div className="handbook-articles__label">{activeSection.title}</div>
            {filteredArticles.length === 0 ? (
              <div className="handbook-empty">Ничего не найдено</div>
            ) : (
              filteredArticles.map((article) => (
                <button
                  key={article.id}
                  type="button"
                  className={`handbook-article-link${activeArticle?.id === article.id ? ' is-active' : ''}`}
                  onClick={() => openArticle(activeSection.id, article.id)}
                >
                  <span className="handbook-article-link__title">{article.title}</span>
                  {article.kind && (
                    <span className={`handbook-badge handbook-badge--${article.kind}`}>{KIND_LABEL[article.kind]}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="handbook-main">
          <div className="handbook-main__toolbar">
            <button type="button" className="handbook-mobile-toggle" onClick={() => setMobileNavOpen((v) => !v)}>
              {mobileNavOpen ? 'Скрыть разделы' : 'Разделы'}
            </button>
            <div className="handbook-breadcrumb">
              <span>Справочник</span>
              <span aria-hidden>/</span>
              <span>{activeSection.title}</span>
              {activeArticle && (
                <>
                  <span aria-hidden>/</span>
                  <span>{activeArticle.title}</span>
                </>
              )}
            </div>
          </div>

          {activeArticle ? (
            <article className="handbook-content card">
              <header className="handbook-content__head">
                {activeArticle.kind && (
                  <span className={`handbook-badge handbook-badge--${activeArticle.kind}`}>{KIND_LABEL[activeArticle.kind]}</span>
                )}
                <h2>{activeArticle.title}</h2>
                <p>{activeArticle.summary}</p>
              </header>
              <BodyRenderer body={activeArticle.body} />
              <footer className="handbook-content__footer">
                <div className="handbook-content__hint">
                  Раздел «{activeSection.title}»: {activeSection.description}
                </div>
                <div className="handbook-content__links">
                  <Link to="/about" className="button secondary">
                    О платформе
                  </Link>
                  <Link to="/psychologist/support" className="button secondary">
                    Техподдержка
                  </Link>
                </div>
              </footer>
            </article>
          ) : (
            <div className="handbook-content card handbook-content--empty">
              <h2>Выберите статью</h2>
              <p>Слева откройте раздел и материал.</p>
            </div>
          )}
        </main>
      </div>
      {mobileNavOpen && (
        <button type="button" className="handbook-backdrop" aria-label="Закрыть" onClick={() => setMobileNavOpen(false)} />
      )}
    </div>
  );
}
