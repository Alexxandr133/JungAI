import { useEffect, useRef } from 'react';
import {
  isPsychologistTourComplete,
  runPsychologistPlatformTour,
  type PsychologistTourId
} from '../lib/psychologistPlatformTour';
import type { DriveStep, Driver } from 'driver.js';

type Options = {
  userId: string | undefined;
  role: string | undefined;
  enabled: boolean;
  steps: DriveStep[];
  tourId: PsychologistTourId;
};

export function usePsychologistPlatformTour({ userId, role, enabled, steps, tourId }: Options): void {
  const driverRef = useRef<Driver | null>(null);

  useEffect(() => {
    if (role !== 'psychologist') return;
    if (!enabled || isPsychologistTourComplete(userId, tourId)) return;

    const timer = window.setTimeout(() => {
      if (isPsychologistTourComplete(userId, tourId)) return;

      const d = runPsychologistPlatformTour({
        tourId,
        steps,
        userId,
        persistOnFinish: true
      });
      driverRef.current = d;
    }, 480);

    return () => {
      window.clearTimeout(timer);
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, [enabled, steps, tourId, userId, role]);
}
