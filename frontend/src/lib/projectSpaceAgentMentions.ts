export type ParticipantOption = { clientId: string; label: string; count: number };

/** @ABC123 — переопределить участника по коду в тексте */
export function parseParticipantMention(
  text: string,
  participants: ParticipantOption[]
): string | undefined {
  const partMatch = text.match(/@([A-Fa-f0-9]{6})\b/);
  if (!partMatch) return undefined;
  const code = partMatch[1].toUpperCase();
  return participants.find((p) => p.clientId.slice(-6).toUpperCase() === code)?.clientId;
}

export function resolveAgentDreamSettings(
  message: string,
  participants: ParticipantOption[],
  panel: {
    includeDreamsInContext: boolean;
    participantClientId: string;
    dreamsContextRange: string;
    dreamSampleSize: number;
  }
): {
  includeDreamsInContext: boolean;
  participantClientId?: string;
  dreamsContextRange: string;
  dreamSamplingMode: string;
  dreamSampleSize: number;
} {
  const mentionId = parseParticipantMention(message, participants);
  const participantClientId = mentionId || panel.participantClientId || undefined;
  const hasParticipant = Boolean(participantClientId);

  return {
    includeDreamsInContext: panel.includeDreamsInContext,
    participantClientId,
    dreamsContextRange: panel.dreamsContextRange,
    dreamSamplingMode: hasParticipant ? 'all_in_range' : 'recent',
    dreamSampleSize: hasParticipant ? 200 : panel.dreamSampleSize,
  };
}
