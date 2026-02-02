export type ResearcherWidgetType = 
  | 'totalDreams'
  | 'totalClients'
  | 'totalSessions'
  | 'totalAmplifications'
  | 'symbolFrequency'
  | 'testDistribution'
  | 'categoryDistribution'
  | 'dreamsChart'
  | 'symbolsChart'
  | 'customWidget';

export type ResearcherWidgetConfig = {
  id: string;
  type: ResearcherWidgetType;
  title: string;
  icon: string;
  description: string;
  defaultSize: 'small' | 'medium' | 'large';
  minSize?: 'small' | 'medium' | 'large';
  maxSize?: 'small' | 'medium' | 'large';
};

export type ResearcherWidgetInstance = {
  id: string;
  type: ResearcherWidgetType;
  position: number;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
};

export const RESEARCHER_WIDGET_DEFINITIONS: Record<ResearcherWidgetType, ResearcherWidgetConfig> = {
  totalDreams: {
    id: 'totalDreams',
    type: 'totalDreams',
    title: 'Всего снов',
    icon: '💭',
    description: 'Общее количество снов в системе',
    defaultSize: 'small',
    minSize: 'small',
    maxSize: 'small'
  },
  totalClients: {
    id: 'totalClients',
    type: 'totalClients',
    title: 'Всего клиентов',
    icon: '👥',
    description: 'Общее количество клиентов',
    defaultSize: 'small',
    minSize: 'small',
    maxSize: 'small'
  },
  totalSessions: {
    id: 'totalSessions',
    type: 'totalSessions',
    title: 'Всего сессий',
    icon: '📅',
    description: 'Общее количество сессий',
    defaultSize: 'small',
    minSize: 'small',
    maxSize: 'small'
  },
  totalAmplifications: {
    id: 'totalAmplifications',
    type: 'totalAmplifications',
    title: 'Амплификаций',
    icon: '🔮',
    description: 'Общее количество амплификаций',
    defaultSize: 'small',
    minSize: 'small',
    maxSize: 'small'
  },
  symbolFrequency: {
    id: 'symbolFrequency',
    type: 'symbolFrequency',
    title: 'Частота символов',
    icon: '🔮',
    description: 'Наиболее часто встречающиеся символы',
    defaultSize: 'medium',
    minSize: 'small',
    maxSize: 'large'
  },
  testDistribution: {
    id: 'testDistribution',
    type: 'testDistribution',
    title: 'Распределение тестов',
    icon: '📊',
    description: 'Распределение результатов по типам тестов',
    defaultSize: 'medium',
    minSize: 'small',
    maxSize: 'large'
  },
  categoryDistribution: {
    id: 'categoryDistribution',
    type: 'categoryDistribution',
    title: 'Категории амплификаций',
    icon: '📚',
    description: 'Распределение амплификаций по категориям',
    defaultSize: 'medium',
    minSize: 'small',
    maxSize: 'large'
  },
  dreamsChart: {
    id: 'dreamsChart',
    type: 'dreamsChart',
    title: 'График снов',
    icon: '📈',
    description: 'Визуализация количества снов по времени',
    defaultSize: 'large',
    minSize: 'medium',
    maxSize: 'large'
  },
  symbolsChart: {
    id: 'symbolsChart',
    type: 'symbolsChart',
    title: 'График символов',
    icon: '🔮',
    description: 'Визуализация частоты символов',
    defaultSize: 'large',
    minSize: 'medium',
    maxSize: 'large'
  },
  customWidget: {
    id: 'customWidget',
    type: 'customWidget',
    title: 'Запросить виджет',
    icon: '➕',
    description: 'Отправить запрос на создание нового виджета',
    defaultSize: 'small',
    minSize: 'small',
    maxSize: 'small'
  }
};

export const RESEARCHER_WIDGET_STORAGE_KEY = 'researcher_dashboard_widgets';
