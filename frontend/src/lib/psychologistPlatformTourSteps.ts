import type { DriveStep } from 'driver.js';

/** Селекторы вида [data-tour="…"] задаются в разметке страниц. */
export const PSYCHOLOGIST_DASHBOARD_TOUR_STEPS: DriveStep[] = [
  {
    element: '[data-tour="psych-nav"]',
    popover: {
      title: 'Навигация',
      description:
        'Отсюда доступны рабочий стол, клиенты, сессии, сообщения, рабочая область, AI и другие разделы. Наведите на пункт с ▼, чтобы открыть подменю.',
      side: 'bottom',
      align: 'center'
    }
  },
  {
    element: '[data-tour="dash-hero"]',
    popover: {
      title: 'Приветствие и контекст',
      description:
        'Краткая сводка: сколько клиентов, сессий и новых материалов. Кнопка «Звонки» и блокнот — быстрый доступ к созвонам и заметкам.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="dash-quick"]',
    popover: {
      title: 'Быстрые действия',
      description:
        'Запланировать встречу, открыть список клиентов, перейти в рабочую зону по кейсу или открыть AI-ассистента — без поиска по меню.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="dash-cards"]',
    popover: {
      title: 'Разделы платформы',
      description: 'События и сессии, клиенты, сны и публикации — карточки ведут в соответствующие экраны.',
      side: 'top'
    }
  },
  {
    element: '[data-tour="dash-widgets"]',
    popover: {
      title: 'Виджеты рабочего стола',
      description:
        'Показатели и напоминания (клиенты, сессии, сны и т.д.). Виджеты можно перетаскивать, менять размер и добавлять новые через «+».',
      side: 'top',
      align: 'start'
    }
  }
];

export const PSYCHOLOGIST_CLIENTS_TOUR_STEPS: DriveStep[] = [
  {
    element: '[data-tour="clients-header"]',
    popover: {
      title: 'Поиск клиентов',
      description: 'Найдите человека по имени, почте, телефону, городу или тегам.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="clients-add"]',
    popover: {
      title: 'Новый клиент',
      description:
        'Нажмите «Добавить клиента», заполните контакты и при необходимости теги. После создания клиент сможет получить приглашение на платформу.',
      side: 'bottom',
      align: 'end'
    }
  },
  {
    element: '[data-tour="clients-tags"]',
    popover: {
      title: 'Фильтры по тегам',
      description: 'Быстро сузить список по темам работы (тревога, сноведение и др.). Можно сбросить фильтр.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="clients-grid"]',
    popover: {
      title: 'Карточки клиентов',
      description:
        'Откройте карточку для деталей, ссылок приглашения и работы с кейсом. Список можно обновить кнопкой «Обновить».',
      side: 'top'
    }
  }
];

export const PSYCHOLOGIST_WORK_AREA_TOUR_STEPS: DriveStep[] = [
  {
    element: '[data-tour="workarea-header"]',
    popover: {
      title: 'Клиент и заголовок',
      description:
        'Выберите клиента в выпадающем списке — для него загрузятся вкладки и сохранённые материалы рабочей области.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="workarea-tabs"]',
    popover: {
      title: 'Вкладки ведения',
      description:
        'Темы работы: ведение, анамнез, сны, записи и др. Вкладки можно переименовывать, удалять и менять порядок перетаскиванием.',
      side: 'right',
      align: 'start'
    }
  },
  {
    element: '[data-tour="workarea-editor"]',
    popover: {
      title: 'Редактор и материалы',
      description:
        'Текстовое поле и панель форматирования для заметок и структурированных записей. Сохранение — автоматическое и по кнопке «Сохранить».',
      side: 'left',
      align: 'start'
    }
  }
];

export const PSYCHOLOGIST_AI_TOUR_STEPS: DriveStep[] = [
  {
    element: '[data-tour="ai-sidebar"]',
    popover: {
      title: 'Чаты и папки',
      description:
        'Создавайте новые диалоги, группируйте их в папки и переключайтесь между историями. Контекст сохраняется.',
      side: 'right',
      align: 'start'
    }
  },
  {
    element: '[data-tour="ai-main"]',
    popover: {
      title: 'Диалог с ассистентом',
      description:
        'Задавайте вопросы по кейсу, используйте шорткаты и настройки — ассистент опирается на данные платформы (при подключённом клиенте).',
      side: 'left',
      align: 'start'
    }
  }
];

export const PSYCHOLOGIST_SESSIONS_TOUR_STEPS: DriveStep[] = [
  {
    element: '[data-tour="events-header"]',
    popover: {
      title: 'Сессии и встречи',
      description:
        'Единый календарь событий: видеовстречи, супервизии, вебинары и терапевтические сессии. Учитывается ваш локальный часовой пояс.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="events-toolbar"]',
    popover: {
      title: 'Фильтры и планирование',
      description:
        'Отфильтруйте тип события, переключайтесь на историю прошедших встреч. «Запланировать» — создать новое событие и пригласить клиента.',
      side: 'bottom'
    }
  },
  {
    element: '[data-tour="events-list"]',
    popover: {
      title: 'Расписание и действия',
      description:
        'События по дням: время, тип, комната для звонка, копирование приглашения. Блок «Требуют внимания» подскажет клиентов без недавних сессий.',
      side: 'top',
      align: 'start'
    }
  }
];
