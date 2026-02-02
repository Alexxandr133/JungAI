export type WidgetType = 
  | 'totalClients'
  | 'activeSessions'
  | 'newDreams'
  | 'newJournalEntries'
  | 'topClients'
  | 'topSymbols'
  | 'requiresAttention'
  | 'activityChart'
  | 'recentActivity'
  | 'sessionsCalendar'
  | 'dreamsStats'
  | 'clientProgress'
  | 'monthlyStats'
  | 'symbolsChart';

export type WidgetConfig = {
  id: string;
  type: WidgetType;
  title: string;
  icon: string;
  description: string;
  defaultSize: 'small' | 'medium' | 'large';
  minSize?: 'small' | 'medium' | 'large';
  maxSize?: 'small' | 'medium' | 'large';
};

export type WidgetInstance = {
  id: string;
  type: WidgetType;
  position: number;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
};

export const WIDGET_DEFINITIONS: Record<WidgetType, WidgetConfig> = {
  totalClients: {
    id: 'totalClients',
    type: 'totalClients',
    title: 'Всего клиентов',
    icon: '👥',
    description: 'Общее количество ваших клиентов',
    defaultSize: 'small',
    minSize: 'small',
    maxSize: 'small'
  },
  activeSessions: {
    id: 'activeSessions',
    type: 'activeSessions',
    title: 'Активные сессии',
    icon: '📅',
    description: 'Количество запланированных сессий',
    defaultSize: 'small',
    minSize: 'small',
    maxSize: 'small'
  },
  newDreams: {
    id: 'newDreams',
    type: 'newDreams',
    title: 'Новые сны',
    icon: '💭',
    description: 'Новые сны за последнюю неделю',
    defaultSize: 'small',
    minSize: 'small',
    maxSize: 'small'
  },
  newJournalEntries: {
    id: 'newJournalEntries',
    type: 'newJournalEntries',
    title: 'Записи в дневниках',
    icon: '📝',
    description: 'Новые записи в дневниках клиентов',
    defaultSize: 'small',
    minSize: 'small',
    maxSize: 'small'
  },
  topClients: {
    id: 'topClients',
    type: 'topClients',
    title: 'Топ клиенты',
    icon: '⭐',
    description: 'Самые активные клиенты по количеству снов и сессий',
    defaultSize: 'medium',
    minSize: 'small',
    maxSize: 'large'
  },
  topSymbols: {
    id: 'topSymbols',
    type: 'topSymbols',
    title: 'Частые символы',
    icon: '🔮',
    description: 'Наиболее часто встречающиеся символы в снах',
    defaultSize: 'medium',
    minSize: 'small',
    maxSize: 'large'
  },
  requiresAttention: {
    id: 'requiresAttention',
    type: 'requiresAttention',
    title: 'Требуют внимания',
    icon: '⚠️',
    description: 'Клиенты и сны, требующие вашего внимания',
    defaultSize: 'medium',
    minSize: 'small',
    maxSize: 'large'
  },
  activityChart: {
    id: 'activityChart',
    type: 'activityChart',
    title: 'График активности',
    icon: '📊',
    description: 'Визуализация активности клиентов по времени',
    defaultSize: 'large',
    minSize: 'medium',
    maxSize: 'large'
  },
  recentActivity: {
    id: 'recentActivity',
    type: 'recentActivity',
    title: 'Последние активности',
    icon: '🕐',
    description: 'Недавние сны и записи в дневниках',
    defaultSize: 'medium',
    minSize: 'small',
    maxSize: 'large'
  },
  sessionsCalendar: {
    id: 'sessionsCalendar',
    type: 'sessionsCalendar',
    title: 'Календарь сессий',
    icon: '📆',
    description: 'Ближайшие запланированные сессии',
    defaultSize: 'medium',
    minSize: 'small',
    maxSize: 'large'
  },
  dreamsStats: {
    id: 'dreamsStats',
    type: 'dreamsStats',
    title: 'Статистика снов',
    icon: '💤',
    description: 'Детальная статистика по снам клиентов',
    defaultSize: 'medium',
    minSize: 'small',
    maxSize: 'large'
  },
  clientProgress: {
    id: 'clientProgress',
    type: 'clientProgress',
    title: 'Прогресс клиентов',
    icon: '📈',
    description: 'Визуализация прогресса работы с клиентами',
    defaultSize: 'large',
    minSize: 'medium',
    maxSize: 'large'
  },
  monthlyStats: {
    id: 'monthlyStats',
    type: 'monthlyStats',
    title: 'Статистика за месяц',
    icon: '📅',
    description: 'Общая статистика за текущий месяц',
    defaultSize: 'medium',
    minSize: 'small',
    maxSize: 'large'
  },
  symbolsChart: {
    id: 'symbolsChart',
    type: 'symbolsChart',
    title: 'График символов',
    icon: '🔮',
    description: 'Визуализация частоты символов в снах',
    defaultSize: 'large',
    minSize: 'medium',
    maxSize: 'large'
  }
};

export const WIDGET_STORAGE_KEY = 'psychologist_dashboard_widgets';
