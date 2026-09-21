import { useEffect, useState } from 'react';
import { LandingNavbar } from '../../../components/landing/LandingNavbar';
import { LandingFooter } from '../../../components/landing/LandingFooter';
import { CtaBand } from '../../../components/landing/CtaBand';
import { usePageMeta } from '../../../hooks/usePageMeta';
import { SEO_HOME } from '../../../content/seoPages';
import { api } from '../../../lib/api';
import '../../../styles/landing-tokens.css';
import { PsyHero } from './PsyHero';
import { PsyPainZoo } from './PsyPainZoo';
import { PsyTour } from './PsyTour';
import { PsyResearch } from './PsyResearch';
import { PsySteps } from './PsySteps';
import { PsyPricing } from './PsyPricing';
import { PsyVerification } from './PsyVerification';
import { PsyFaq } from './PsyFaq';

type PublicStats = {
  psychologists: number;
  clients: number;
  dreams: number;
  sessions: number;
};

/** Надбавка к живым счётчикам trust-bar на лендинге */
const STATS_DISPLAY_OFFSET = {
  psychologists: 36,
  sessions: 117,
  dreams: 40,
} as const;

function withDisplayOffset(raw: PublicStats): PublicStats {
  return {
    ...raw,
    psychologists: raw.psychologists + STATS_DISPLAY_OFFSET.psychologists,
    sessions: raw.sessions + STATS_DISPLAY_OFFSET.sessions,
    dreams: raw.dreams + STATS_DISPLAY_OFFSET.dreams,
  };
}

export default function ForPsychologistsPage() {
  usePageMeta({
    title: SEO_HOME.title,
    description: SEO_HOME.description,
    path: SEO_HOME.path,
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
      } catch (e) {
        console.error('Failed to load public stats', e);
        if (!cancelled) {
          setStats(
            withDisplayOffset({ psychologists: 0, clients: 0, dreams: 0, sessions: 0 })
          );
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
      <LandingNavbar variant="psychologist" />
      <main style={{ flex: 1 }}>
        <PsyHero stats={stats} statsLoading={statsLoading} />
        <PsyPainZoo />
        <PsyTour />
        <PsyResearch />
        <PsySteps />
        <PsyPricing />
        {/* S7 отзывы — не публикуем без реальных цитат (COPY-PSY) */}
        <div id="testimonials" aria-hidden style={{ height: 1, scrollMarginTop: 80 }} />
        <PsyVerification />
        <PsyFaq />
        <CtaBand />
      </main>
      <LandingFooter />
    </div>
  );
}
