import { useEffect, useState } from 'react';
import { LandingNavbar } from '../../../components/landing/LandingNavbar';
import { LandingFooter } from '../../../components/landing/LandingFooter';
import { CtaBand } from '../../../components/landing/CtaBand';
import { usePageMeta } from '../../../hooks/usePageMeta';
import { SEO_PAGES } from '../../../content/seoPages';
import { api } from '../../../lib/api';
import '../../../styles/landing-tokens.css';
import { ResHero } from './ResHero';
import { ResTour } from './ResTour';
import { ResBridge } from './ResBridge';
import { ResEthics } from './ResEthics';
import { ResSteps } from './ResSteps';
import { ResFaq } from './ResFaq';

type PublicStats = {
  psychologists: number;
  clients: number;
  dreams: number;
  sessions: number;
};

const STATS_DISPLAY_OFFSET = {
  psychologists: 36,
  dreams: 40,
} as const;

function withDisplayOffset(raw: PublicStats): PublicStats {
  return {
    ...raw,
    psychologists: raw.psychologists + STATS_DISPLAY_OFFSET.psychologists,
    dreams: raw.dreams + STATS_DISPLAY_OFFSET.dreams,
  };
}

export default function ForResearchersPage() {
  const seo = SEO_PAGES['/for-researchers'];
  usePageMeta({
    title: seo.title,
    description: seo.description,
    path: seo.path,
  });

  const [stats, setStats] = useState<PublicStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<PublicStats>('/api/psychologists/public/stats');
        if (!cancelled) {
          setStats(
            withDisplayOffset({
              psychologists: data.psychologists ?? 0,
              clients: data.clients ?? 0,
              dreams: data.dreams ?? 0,
              sessions: data.sessions ?? 0,
            })
          );
        }
      } catch {
        if (!cancelled) {
          setStats(withDisplayOffset({ psychologists: 0, clients: 0, dreams: 0, sessions: 0 }));
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="landing">
      <LandingNavbar variant="researcher" />
      <main style={{ flex: 1 }}>
        <ResHero stats={stats} statsLoading={statsLoading} />
        <ResTour />
        <ResBridge />
        <ResEthics />
        <ResSteps />
        <ResFaq />
        <CtaBand
          title="Исследуйте бессознательное"
          sub="Зарегистрируйтесь и запишите первую гипотезу сегодня."
          primaryLabel="Начать исследование"
          primaryTo="/register?role=researcher"
          tertiaryLabel="Написать нам: inbox@jung-ai.ru"
        />
      </main>
      <LandingFooter />
    </div>
  );
}
