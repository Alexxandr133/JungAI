/** Единый SEO-словарь публичных страниц (SPA + совпадает с backend seoPublic). */

export type SeoPage = {
  path: string;
  title: string;
  description: string;
};

export const SITE_ORIGIN = 'https://jung-ai.ru';
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/jungai-logo.png`;

/** Главная = лендинг для психологов */
export const SEO_HOME: SeoPage = {
  path: '/',
  title: 'JungAI — платформа для психологов: CRM, календарь, видео, ИИ и транскрибация',
  description:
    'Один контур для частной практики: карточки клиентов, самозапись, видеосессии, транскрибация сессий и ИИ, который учитывает вашу модальность. Ранний доступ — бесплатно.',
};

export const SEO_PAGES: Record<string, SeoPage> = {
  '/': SEO_HOME,
  '/for-psychologists': SEO_HOME,
  '/for-clients': {
    path: '/for-clients',
    title: 'JungAI — психолог онлайн: сессии, дневник снов, тесты',
    description:
      'Верифицированные психологи аналитической традиции. Видео-сессии на платформе, дневник снов с символами, тесты и поддержка между сессиями. Стоимость видна до записи.',
  },
  '/for-researchers': {
    path: '/for-researchers',
    title: 'JungAI для исследователей — сны, символы, индивидуация',
    description:
      'Дневник снов с ИИ-извлечением символов, частота символов, модель индивидуации и исследовательские проекты. Платформа юнгианской традиции для исследователей и психологов.',
  },
  '/communities': {
    path: '/communities',
    title: 'Сообщества JungAI — лента постов психологов и клиентов',
    description:
      'Лента и сообщества JungAI: читайте посты психологов, клиентов и исследователей без регистрации. Обсуждения, статьи и заметки из практики.',
  },
  '/psychologists': {
    path: '/psychologists',
    title: 'Психологи — каталог верифицированных специалистов JungAI',
    description:
      'Верифицированные психологи JungAI: подбор по темам, формату и бюджету. Публичные профили и запись на сессию.',
  },
  '/guest/publications': {
    path: '/guest/publications',
    title: 'Публикации JungAI',
    description: 'Открытая лента публикаций сообщества JungAI. Читайте без регистрации.',
  },
};

export function getSeoPage(pathname: string): SeoPage {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
  return SEO_PAGES[path] || SEO_HOME;
}
