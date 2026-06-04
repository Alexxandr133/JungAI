import { consumeAiTokens } from './aiTokenQuota';
import { transcribeAudioBuffer, type TranscriptionProgressUpdate } from './audioTranscription';
import {
  completeAiTranscription,
  failAiTranscription,
  updateAiTranscriptionProgress,
} from '../repositories/aiTranscriptionRepository';

const activeJobs = new Set<string>();

export function isTranscriptionJobActive(id: string): boolean {
  return activeJobs.has(id);
}

export function runTranscriptionJob(params: {
  id: string;
  psychologistId: string;
  buffer: Buffer;
  format: string;
  language?: string;
}): void {
  const { id, psychologistId, buffer, format, language } = params;
  if (activeJobs.has(id)) return;
  activeJobs.add(id);

  void (async () => {
    const report = async (percent: number, stage: string) => {
      await updateAiTranscriptionProgress(id, psychologistId, { progressPercent: percent, progressStage: stage });
    };

    try {
      await report(12, 'Подготовка аудио');
      const onProgress = async (u: TranscriptionProgressUpdate) => {
        await report(u.percent, u.stage || 'Транскрибация');
      };

      const result = await transcribeAudioBuffer(buffer, format, language, onProgress);

      await report(98, 'Сохранение');
      const row = await completeAiTranscription(id, psychologistId, {
        text: result.text,
        language: result.language,
        durationSec: result.durationSec ?? null,
      });
      if (!row) return;

      await consumeAiTokens(psychologistId, {
        promptText: `[transcription ${result.durationSec ?? '?'}s]`,
        completionText: result.text,
      });
    } catch (e: any) {
      console.error('[STT] job failed', { id, error: e?.message || e });
      await failAiTranscription(id, psychologistId, e?.message || 'Не удалось выполнить транскрибацию');
    } finally {
      activeJobs.delete(id);
    }
  })();
}
