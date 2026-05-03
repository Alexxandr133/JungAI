import { Info } from 'lucide-react';
import {
  runPsychologistPlatformTour,
  type PsychologistTourId
} from '../lib/psychologistPlatformTour';
import type { DriveStep } from 'driver.js';

type Props = {
  tourId: PsychologistTourId;
  steps: DriveStep[];
  userId?: string;
  role?: string;
  title?: string;
};

export function PsychologistTourHelpButton({
  tourId,
  steps,
  userId,
  role,
  title = 'Обзор раздела'
}: Props) {
  if (role !== 'psychologist' && role !== 'admin') {
    return null;
  }

  return (
    <button
      type="button"
      className="psychologist-tour-help-btn"
      title={title}
      aria-label={title}
      onClick={() =>
        runPsychologistPlatformTour({
          tourId,
          steps,
          userId,
          persistOnFinish: false
        })
      }
    >
      <Info size={18} strokeWidth={2.25} aria-hidden />
    </button>
  );
}
