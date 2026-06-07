import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GuestNavbar } from '../../components/GuestNavbar';
import { SiteFooter } from '../../components/SiteFooter';
import './LegalDocumentPage.css';

const LEGAL_FILES: Record<string, { file: string; title: string }> = {
  terms: { file: '/legal/terms.md', title: 'Пользовательское соглашение' },
  privacy: { file: '/legal/privacy.md', title: 'Политика конфиденциальности' },
  'personal-data-consent': {
    file: '/legal/personal-data-consent.md',
    title: 'Согласие на обработку персональных данных',
  },
};

type Props = {
  slug: keyof typeof LEGAL_FILES;
};

export default function LegalDocumentPage({ slug }: Props) {
  const meta = LEGAL_FILES[slug];
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(meta.file, { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error('Документ не найден');
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || 'Не удалось загрузить документ');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [meta.file]);

  return (
    <div className="legal-doc-page">
      <GuestNavbar />
      <main className="legal-doc-main">
        <div style={{ marginBottom: 16 }}>
          <Link to="/" className="small" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← На главную
          </Link>
        </div>
        <div className="legal-doc-card">
          {loading && <div className="legal-doc-loading">Загрузка документа…</div>}
          {error && <div className="legal-doc-error">{error}</div>}
          {!loading && !error && (
            <article className="legal-doc-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </article>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
