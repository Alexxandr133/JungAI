import { Router } from 'express';
import { prisma } from '../db/prisma';

const router = Router();
const SITE = process.env.PUBLIC_SITE_URL || 'https://jung-ai.ru';

/** Совпадает с frontend/src/content/seoPages.ts */
const STATIC_SEO: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'JungAI — платформа для психологов: CRM, календарь, видео, ИИ и транскрибация',
    description:
      'Один контур для частной практики: карточки клиентов, самозапись, видеосессии, транскрибация сессий и ИИ, который учитывает вашу модальность. Ранний доступ — бесплатно.',
  },
  '/for-psychologists': {
    title: 'JungAI — платформа для психологов: CRM, календарь, видео, ИИ и транскрибация',
    description:
      'Один контур для частной практики: карточки клиентов, самозапись, видеосессии, транскрибация сессий и ИИ, который учитывает вашу модальность. Ранний доступ — бесплатно.',
  },
  '/for-clients': {
    title: 'JungAI — психолог онлайн: сессии, дневник снов, тесты',
    description:
      'Верифицированные психологи аналитической традиции. Видео-сессии на платформе, дневник снов с символами, тесты и поддержка между сессиями. Стоимость видна до записи.',
  },
  '/for-researchers': {
    title: 'JungAI для исследователей — сны, символы, индивидуация',
    description:
      'Дневник снов с ИИ-извлечением символов, частота символов, модель индивидуации и исследовательские проекты. Платформа юнгианской традиции для исследователей и психологов.',
  },
  '/communities': {
    title: 'Сообщества JungAI — лента постов психологов и клиентов',
    description:
      'Лента и сообщества JungAI: читайте посты психологов, клиентов и исследователей без регистрации. Обсуждения, статьи и заметки из практики.',
  },
  '/psychologists': {
    title: 'Психологи — каталог верифицированных специалистов JungAI',
    description:
      'Верифицированные психологи JungAI: подбор по темам, формату и бюджету. Публичные профили и запись на сессию.',
  },
  '/guest/publications': {
    title: 'Публикации JungAI',
    description: 'Открытая лента публикаций сообщества JungAI. Читайте без регистрации.',
  },
};

function escapeHtml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(html: string, max = 280) {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

function absAsset(url?: string | null) {
  if (!url) return `${SITE}/jungai-logo.png`;
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE}${url.startsWith('/') ? '' : '/'}${url}`;
}

function seoHtml(opts: {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  type?: string;
  bodyHtml?: string;
  publishedTime?: string | null;
  noIndex?: boolean;
}) {
  const title = escapeHtml(opts.title);
  const description = escapeHtml(opts.description);
  const url = escapeHtml(opts.url);
  const image = escapeHtml(opts.image || `${SITE}/jungai-logo.png`);
  const type = escapeHtml(opts.type || 'website');
  const body = opts.bodyHtml || `<p>${description}</p>`;
  const robots = opts.noIndex ? 'noindex,nofollow' : 'index,follow';
  const published =
    opts.publishedTime != null
      ? `  <meta property="article:published_time" content="${escapeHtml(opts.publishedTime)}" />\n`
      : '';
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="${robots}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:site_name" content="JungAI" />
  <meta property="og:locale" content="ru_RU" />
  <meta property="og:type" content="${type}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${image}" />
${published}  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <meta http-equiv="refresh" content="0;url=${url}" />
</head>
<body>
  <main>
    <h1>${title}</h1>
    ${body}
    <p><a href="${url}">Открыть на JungAI</a></p>
  </main>
</body>
</html>`;
}

function normalizePagePath(raw: string) {
  const p = decodeURIComponent(String(raw || '/')).split('?')[0];
  if (!p || p === '/') return '/';
  return p.startsWith('/') ? p.replace(/\/$/, '') || '/' : `/${p.replace(/\/$/, '')}`;
}

router.get('/robots.txt', (_req, res) => {
  res
    .type('text/plain; charset=utf-8')
    .send(`User-agent: *
Allow: /
Allow: /for-clients
Allow: /for-researchers
Allow: /communities
Allow: /psychologists
Allow: /publications/
Allow: /guest/publications
Disallow: /admin
Disallow: /api/
Disallow: /login
Disallow: /register
Disallow: /client/
Disallow: /psychologist/
Disallow: /researcher/

Sitemap: ${SITE}/sitemap.xml
`);
});

router.get('/sitemap.xml', async (_req, res) => {
  try {
    const nowIso = new Date().toISOString();
    const [communities, posts, privateCommunities] = await Promise.all([
      (prisma as any).community.findMany({
        where: { isPrivate: false },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 2000,
      }),
      (prisma as any).publicationPost.findMany({
        where: { status: 'published' },
        select: { id: true, communityId: true, updatedAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      }),
      (prisma as any).community.findMany({
        where: { isPrivate: true },
        select: { id: true },
        take: 5000,
      }),
    ]);

    const privateIds = new Set(
      ((privateCommunities || []) as Array<{ id: string }>).map((c) => String(c.id))
    );
    const publicPosts = ((posts || []) as Array<{ id: string; communityId?: string | null; updatedAt?: Date; createdAt?: Date }>).filter(
      (p) => !p.communityId || !privateIds.has(String(p.communityId))
    );

    const staticPaths: Array<[string, string, string]> = [
      ['/', '1.0', 'daily'],
      ['/for-clients', '0.9', 'weekly'],
      ['/for-researchers', '0.9', 'weekly'],
      ['/communities', '0.9', 'hourly'],
      ['/psychologists', '0.8', 'weekly'],
      ['/guest/publications', '0.7', 'daily'],
    ];

    const urls: string[] = staticPaths
      .map(
        ([path, priority, changefreq]) => `  <url>
    <loc>${SITE}${path}</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
      )
      .concat(
        (communities || []).map(
          (c: any) => `  <url>
    <loc>${SITE}/publications/community/${encodeURIComponent(c.slug)}</loc>
    <lastmod>${new Date(c.updatedAt || Date.now()).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`
        )
      )
      .concat(
        publicPosts.map(
          (p) => `  <url>
    <loc>${SITE}/publications/post/${encodeURIComponent(p.id)}</loc>
    <lastmod>${new Date(p.updatedAt || p.createdAt || Date.now()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`
        )
      );

    // Yandex Webmaster prefers text/xml without charset in Content-Type
    res
      .set('Content-Type', 'text/xml')
      .send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://schemas.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`);
  } catch (e: any) {
    res.status(500).type('text/plain').send(e.message || 'sitemap error');
  }
});

/** Пререндер статичных лендингов для ботов */
router.get('/og/page', (req, res) => {
  const path = normalizePagePath(String(req.query.path || '/'));
  const page = STATIC_SEO[path] || STATIC_SEO['/'];
  const url = `${SITE}${path === '/' ? '/' : path}`;
  res.type('html').send(
    seoHtml({
      title: page.title,
      description: page.description,
      url,
      type: 'website',
      bodyHtml: `<p>${escapeHtml(page.description)}</p>`,
    })
  );
});

/** HTML with OG tags for crawlers (nginx proxies bots here). */
router.get('/og/post/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    const post = await (prisma as any).publicationPost.findUnique({ where: { id } });
    if (!post || post.status !== 'published') return res.status(404).send('Not found');

    if (post.communityId) {
      const community = await (prisma as any).community.findUnique({
        where: { id: String(post.communityId) },
        select: { isPrivate: true },
      });
      if (community?.isPrivate) {
        return res
          .status(404)
          .type('html')
          .send(
            seoHtml({
              title: 'Публикация недоступна',
              description: 'Эта публикация находится в закрытом сообществе.',
              url: `${SITE}/communities`,
              noIndex: true,
            })
          );
      }
    }

    const url = `${SITE}/publications/post/${id}`;
    const fullText = stripHtml(post.content, 800);
    const description = stripHtml(post.content, 220) || 'Публикация в сообществе JungAI';
    const image = post.imageUrl ? absAsset(post.imageUrl) : null;
    const publishedTime = post.createdAt ? new Date(post.createdAt).toISOString() : null;
    res.type('html').send(
      seoHtml({
        title: post.title,
        description,
        url,
        image,
        type: 'article',
        publishedTime,
        bodyHtml: `<article><p>${escapeHtml(fullText)}</p></article>`,
      })
    );
  } catch (e: any) {
    res.status(500).send(e.message || 'error');
  }
});

router.get('/og/community/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '');
    const community = await (prisma as any).community.findFirst({ where: { slug } });
    if (!community) return res.status(404).send('Not found');
    if (community.isPrivate) {
      return res
        .status(404)
        .type('html')
        .send(
          seoHtml({
            title: 'Закрытое сообщество',
            description: 'Это сообщество доступно только участникам.',
            url: `${SITE}/communities`,
            noIndex: true,
          })
        );
    }
    const url = `${SITE}/publications/community/${encodeURIComponent(slug)}`;
    const description = String(community.description || '').trim() || 'Сообщество на JungAI';
    const imageAbs = absAsset(community.coverUrl || community.avatarUrl);
    res.type('html').send(
      seoHtml({
        title: community.name,
        description,
        url,
        image: imageAbs,
        type: 'website',
        bodyHtml: `<p>${escapeHtml(description)}</p>`,
      })
    );
  } catch (e: any) {
    res.status(500).send(e.message || 'error');
  }
});

export default router;
