import { useState } from 'react';
import { LandingNavbar } from '../../../components/landing/LandingNavbar';
import { LandingFooter } from '../../../components/landing/LandingFooter';
import { CtaBand } from '../../../components/landing/CtaBand';
import { usePageMeta } from '../../../hooks/usePageMeta';
import { SEO_PAGES } from '../../../content/seoPages';
import '../../../styles/landing-tokens.css';
import { CliHero } from './CliHero';
import { CliRequests } from './CliRequests';
import { CliSteps } from './CliSteps';
import { CliCatalog } from './CliCatalog';
import { CliBetween } from './CliBetween';
import { CliTrust } from './CliTrust';
import { CliFaq } from './CliFaq';

export default function ForClientsPage() {
  const seo = SEO_PAGES['/for-clients'];
  usePageMeta({
    title: seo.title,
    description: seo.description,
    path: seo.path,
  });

  const [requestFilter, setRequestFilter] = useState<string | null>(null);

  return (
    <div className="landing">
      <LandingNavbar variant="client" />
      <main style={{ flex: 1 }}>
        <CliHero />
        <CliRequests selected={requestFilter} onSelect={setRequestFilter} />
        <CliSteps />
        <CliCatalog requestFilter={requestFilter} />
        <CliBetween />
        <CliTrust />
        {/* S7 отзывы — только с согласия; пока не публикуем */}
        <CliFaq />
        <CtaBand
          title="Первый шаг — самый сложный. Сделаем его мягким"
          sub="Посмотрите каталог: у каждого специалиста — метод, описание и цена. Выбирать можно спокойно и в своём темпе."
          primaryLabel="Выбрать психолога"
          primaryTo="/match"
          tertiaryLabel="Задать вопрос: inbox@jung-ai.ru"
        />
      </main>
      <LandingFooter />
    </div>
  );
}
