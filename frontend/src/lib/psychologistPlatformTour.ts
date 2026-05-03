import { driver } from 'driver.js';
import type { Config, DriveStep, Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import '../styles/psychologistPlatformTour.css';

export type PsychologistTourId = 'dashboard' | 'clients' | 'workArea' | 'ai' | 'sessions';

const STORAGE_KEY = 'jingai.psychologist.platformTour.v1';

type TourStore = Record<string, Partial<Record<PsychologistTourId, boolean>>>;

function readStore(): TourStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function isPsychologistTourComplete(userId: string | undefined, tourId: PsychologistTourId): boolean {
  const uid = userId || '__anon__';
  return Boolean(readStore()[uid]?.[tourId]);
}

export function markPsychologistTourComplete(userId: string | undefined, tourId: PsychologistTourId): void {
  const uid = userId || '__anon__';
  const store = readStore();
  if (!store[uid]) store[uid] = {};
  store[uid][tourId] = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

function resolveTourStepElement(step: DriveStep): Element | null {
  const el = step.element;
  if (!el) return null;
  if (typeof el === 'string') return document.querySelector(el);
  if (typeof el === 'function') return el() ?? null;
  return el;
}

export function filterResolvableTourSteps(steps: DriveStep[]): DriveStep[] {
  return steps.filter((step) => {
    if (!step.element) return true;
    return !!resolveTourStepElement(step);
  });
}

function overlayOptionsForDocumentTheme(): Pick<Config, 'overlayColor' | 'overlayOpacity'> {
  if (typeof document === 'undefined') {
    return { overlayColor: '#020617', overlayOpacity: 0.82 };
  }
  const light = document.documentElement.dataset.theme === 'light';
  if (light) {
    return { overlayColor: '#0f172a', overlayOpacity: 0.4 };
  }
  return { overlayColor: '#030712', overlayOpacity: 0.82 };
}

export const PSYCHOLOGIST_PLATFORM_TOUR_DRIVER_BASE: Partial<Config> = {
  nextBtnText: 'Далее',
  prevBtnText: 'Назад',
  doneBtnText: 'Готово',
  progressText: '{{current}} из {{total}}',
  showProgress: true,
  stagePadding: 10,
  stageRadius: 12,
  smoothScroll: true,
  allowClose: true,
  animate: true,
  overlayClickBehavior: 'close',
  showButtons: ['next', 'previous', 'close'],
  popoverClass: 'psychologist-platform-tour-popover',
  popoverOffset: 16
};

export type RunPsychologistTourOptions = {
  tourId: PsychologistTourId;
  steps: DriveStep[];
  userId?: string;
  /** Если true — после закрытия тура сохраняется флаг в localStorage (автозапуск первого раза). */
  persistOnFinish: boolean;
};

/** Запуск тура (ручной или из хука). Возвращает инстанс driver для destroy при размонтировании. */
export function runPsychologistPlatformTour(opts: RunPsychologistTourOptions): Driver | null {
  const filtered = filterResolvableTourSteps(opts.steps);
  if (filtered.length === 0) {
    return null;
  }

  const d = driver({
    ...PSYCHOLOGIST_PLATFORM_TOUR_DRIVER_BASE,
    ...overlayOptionsForDocumentTheme(),
    steps: filtered,
    onDestroyed: () => {
      if (opts.persistOnFinish) {
        markPsychologistTourComplete(opts.userId, opts.tourId);
      }
    }
  });
  d.drive();
  return d;
}
