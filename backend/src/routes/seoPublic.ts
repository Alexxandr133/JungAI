import { Router } from 'express';
import { prisma } from '../db/prisma';

const router = Router();
const SITE = process.env.PUBLIC_SITE_URL || 'https://jung-ai.ru';

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

function seoHtml(opts: {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  type?: string;
  bodyHtml?: string;
}) {
  const title = escapeHtml(opts.title);
  const description = escapeHtml(opts.description);
  const url = escapeHtml(opts.url);
  const image = escapeHtml(opts.image || `${SITE}/jungai-logo.png`);
  const type = escapeHtml(opts.type || 'website');
  const body = opts.bodyHtml || `<p>${description}</p>`;
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${title} — JungAI</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="${url}" />
  <meta property="og:site_name" content="JungAI" />
  <meta property="og:locale" content="ru_RU" />
  <meta property="og:type" content="${type}" />
  <meta property="og:title" content="${title} — JungAI" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${image}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title} — JungAI" />
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

router.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *
Allow: /
Allow: /communities
Allow: /publications/
Allow: /guest/publications
Disallow: /admin
Disallow: /api/
Disallow: /login
Disallow: /register

Sitemap: ${SITE}/sitemap.xml
`);
});

router.get('/sitemap.xml', async (_req, res) => {
  try {
    const [communities, posts] = await Promise.all([
      (prisma as any).community.findMany({
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 2000
      }),
      (prisma as any).publicationPost.findMany({
        where: { status: 'published' },
        select: { id: true, updatedAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5000
      })
    ]);

    const urls: string[] = [
      ['/', '1.0', 'daily'],
      ['/for-clients', '0.9', 'weekly'],
      ['/for-researchers', '0.9', 'weekly'],
      ['/communities', '0.9', 'hourly'],
      ['/guest/publications', '0.8', 'hourly'],
      ['/psychologists', '0.8', 'weekly']
    ]
      .map(
        ([path, priority, changefreq]) => `  <url>
    <loc>${SITE}${path}</loc>
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
        (posts || []).map(
          (p: any) => `  <url>
    <loc>${SITE}/publications/post/${encodeURIComponent(p.id)}</loc>
    <lastmod>${new Date(p.updatedAt || p.createdAt || Date.now()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`
        )
      );

    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`);
  } catch (e: any) {
    res.status(500).type('text/plain').send(e.message || 'sitemap error');
  }
});

/** HTML with OG tags for crawlers (nginx proxies bots here). */
router.get('/og/post/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    const post = await (prisma as any).publicationPost.findUnique({ where: { id } });
    if (!post || post.status !== 'published') return res.status(404).send('Not found');
    const url = `${SITE}/publications/post/${id}`;
    const description = stripHtml(post.content, 240);
    const image = post.imageUrl
      ? post.imageUrl.startsWith('http')
        ? post.imageUrl
        : `${SITE}${post.imageUrl.startsWith('/') ? '' : '/'}${post.imageUrl}`
      : null;
    res
      .type('html')
      .send(
        seoHtml({
          title: post.title,
          description: description || 'Публикация в сообществе JungAI',
          url,
          image,
          type: 'article',
          bodyHtml: `<article><p>${escapeHtml(description)}</p></article>`
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
    const url = `${SITE}/publications/community/${encodeURIComponent(slug)}`;
    const description = String(community.description || '').trim() || 'Сообщество на JungAI';
    const image = community.coverUrl || community.avatarUrl;
    const imageAbs = image
      ? String(image).startsWith('http')
        ? String(image)
        : `${SITE}${String(image).startsWith('/') ? '' : '/'}${image}`
      : null;
    res.type('html').send(
      seoHtml({
        title: community.name,
        description,
        url,
        image: imageAbs,
        type: 'website',
        bodyHtml: `<p>${escapeHtml(description)}</p>`
      })
    );
  } catch (e: any) {
    res.status(500).send(e.message || 'error');
  }
});

export default router;
