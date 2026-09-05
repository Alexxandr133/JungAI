import { useEffect, useRef } from 'react';
import { ParticipantTile, useParticipants, useTracks } from '@livekit/components-react';
import { Track, type Participant } from 'livekit-client';
import { PlatformIcon } from '../../../components/icons';
import { getApiBaseUrl } from '../../../lib/api';
import { DraggablePip } from './DraggablePip';
import './sessionTests.css';

function participantMeta(p: { name?: string; identity?: string; metadata?: string }) {
  let displayName = p.name || p.identity || 'Участник';
  let avatarUrl = '';
  try {
    const meta = p.metadata ? JSON.parse(p.metadata) : null;
    if (meta?.displayName) displayName = meta.displayName;
    if (meta?.avatarUrl) avatarUrl = meta.avatarUrl;
  } catch {
    /* ignore */
  }
  if (avatarUrl.startsWith('/')) avatarUrl = `${getApiBaseUrl()}${avatarUrl}`;
  return { displayName, avatarUrl };
}

export function pipVisibleCount(width: number) {
  if (width >= 500) return 4;
  if (width >= 340) return 3;
  return 2;
}

function pickVisibleParticipants(list: Participant[], limit: number, lastSpeakerId: string | null) {
  const speaking = list.filter((p) => p.isSpeaking);
  const last = lastSpeakerId && !speaking.some((p) => p.identity === lastSpeakerId)
    ? list.find((p) => p.identity === lastSpeakerId)
    : undefined;
  const rest = list.filter(
    (p) => !p.isSpeaking && p.identity !== last?.identity
  );
  return [...speaking, ...(last ? [last] : []), ...rest].slice(0, Math.max(1, limit));
}

export function SessionTestPip() {
  const participants = useParticipants();
  const lastSpeaker = useRef<string | null>(null);
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: false
  });

  useEffect(() => {
    const speakingNow = participants.find((p) => p.isSpeaking);
    if (speakingNow) lastSpeaker.current = speakingNow.identity;
  }, [participants]);

  return (
    <DraggablePip>
      {(width) => {
        const limit = Math.min(4, Math.max(1, participants.length), pipVisibleCount(width));
        const visible = pickVisibleParticipants(participants, limit, lastSpeaker.current);
        const tiles = visible.map((p) => {
          const track = cameraTracks.find((t) => t.participant.identity === p.identity);
          const hasVideo = Boolean((track as { publication?: { track?: unknown } } | undefined)?.publication?.track);
          return { participant: p, track, hasVideo, speaking: p.isSpeaking, ...participantMeta(p) };
        });
        return (
          <div className={`session-test-pip__videos is-count-${tiles.length}${tiles.length < 2 ? ' is-single' : ''}`}>
            {tiles.map((tile) => (
              <div
                key={tile.participant.identity}
                className={`session-test-pip__tile${tile.speaking ? ' is-speaking' : ''}`}
              >
                {tile.hasVideo && tile.track ? (
                  <ParticipantTile trackRef={tile.track} className="session-test-pip__video" />
                ) : (
                  <div className="session-test-pip__avatar">
                    {tile.avatarUrl ? (
                      <img src={tile.avatarUrl} alt={tile.displayName} draggable={false} />
                    ) : (
                      <span className="session-test-pip__avatar-fallback" aria-hidden>
                        <PlatformIcon name="user" size={36} color="#94a3b8" />
                      </span>
                    )}
                  </div>
                )}
                <span className="session-test-pip__name">{tile.displayName}</span>
              </div>
            ))}
          </div>
        );
      }}
    </DraggablePip>
  );
}
