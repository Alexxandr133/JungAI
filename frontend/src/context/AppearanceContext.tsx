import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';

const STORAGE_KEY = 'jungai.appearance.v1';

export type ColorMode = 'light' | 'dark';
export type LightCardVariant = 'soft' | 'crisp';

export type AppearanceState = {
  colorMode: ColorMode;
  lightCardVariant: LightCardVariant;
  wallpaper: string;
  textScale: number;
};

const DEFAULTS: AppearanceState = {
  colorMode: 'dark',
  lightCardVariant: 'soft',
  wallpaper: '',
  textScale: 1
};

export const TEXT_SCALE_MIN = 0.9;
export const TEXT_SCALE_MAX = 1.15;

function clampTextScale(n: number): number {
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, n));
}

function loadStored(): AppearanceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<AppearanceState>;
    let colorMode: ColorMode = p.colorMode === 'light' ? 'light' : 'dark';
    const wallpaper = typeof p.wallpaper === 'string' ? p.wallpaper : '';
    // С фоном-обоями только тёмная тема
    if (wallpaper && colorMode === 'light') {
      colorMode = 'dark';
    }
    return {
      colorMode,
      lightCardVariant: p.lightCardVariant === 'crisp' ? 'crisp' : 'soft',
      wallpaper,
      textScale: clampTextScale(typeof p.textScale === 'number' ? p.textScale : 1)
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function persist(state: AppearanceState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

type AppearanceContextValue = {
  appearance: AppearanceState;
  setAppearance: (patch: Partial<AppearanceState>) => void;
  resetAppearance: () => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setState] = useState<AppearanceState>(() =>
    typeof window !== 'undefined' ? loadStored() : { ...DEFAULTS }
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as Partial<AppearanceState>;
      if (p.wallpaper && p.colorMode === 'light') {
        p.colorMode = 'dark';
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...p, colorMode: 'dark' }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setAppearance = useCallback((patch: Partial<AppearanceState>) => {
    setState((prev) => {
      let wallpaper = patch.wallpaper !== undefined ? patch.wallpaper : prev.wallpaper;
      let colorMode = patch.colorMode !== undefined ? patch.colorMode : prev.colorMode;

      if (patch.colorMode === 'light') {
        wallpaper = '';
      }
      if (wallpaper) {
        colorMode = 'dark';
      }

      const next: AppearanceState = {
        ...prev,
        ...patch,
        wallpaper,
        colorMode,
        textScale:
          patch.textScale !== undefined ? clampTextScale(patch.textScale) : prev.textScale
      };

      persist(next);
      return next;
    });
  }, []);

  const resetAppearance = useCallback(() => {
    setState({ ...DEFAULTS });
    persist({ ...DEFAULTS });
  }, []);

  const value = useMemo(
    () => ({ appearance, setAppearance, resetAppearance }),
    [appearance, setAppearance, resetAppearance]
  );

  return (
    <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error('useAppearance must be used within AppearanceProvider');
  }
  return ctx;
}
