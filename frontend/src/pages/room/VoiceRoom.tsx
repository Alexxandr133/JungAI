import { type CSSProperties, type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, getApiBaseUrl, resolvePublicFileUrl } from '../../lib/api';
import '@livekit/components-styles';
import './VoiceRoom.css';
import {
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  type TrackReferenceOrPlaceholder,
  useAudioPlayback,
  useChat,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks
} from '@livekit/components-react';
import { DisconnectReason, Room, Track } from 'livekit-client';
import { PlatformIcon } from '../../components/icons';
import { Check, MessageSquare, Mic, MicOff, MonitorUp, MoreHorizontal, Paperclip, PhoneOff, SendHorizontal, Users, Video, VideoOff } from 'lucide-react';
import { isJwtExpired } from '../../utils/authSession';

const ROOM_PARTICIPANT_KEY = 'jingai_room_participant_key';
const MAX_AUTO_RECONNECT = 8;

const STABLE_ROOM_OPTIONS = {
  disconnectOnPageLeave: false,
  adaptiveStream: true,
  dynacast: true,
} as const;

const STABLE_CONNECT_OPTIONS = {
  autoSubscribe: true,
  maxRetries: 5,
  peerConnectionTimeout: 45_000,
};

function randomParticipantKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function getRoomParticipantKey(): string {
  try {
    let key = sessionStorage.getItem(ROOM_PARTICIPANT_KEY);
    if (!key) {
      key = randomParticipantKey();
      sessionStorage.setItem(ROOM_PARTICIPANT_KEY, key);
    }
    return key;
  } catch {
    return randomParticipantKey();
  }
}

function rotateRoomParticipantKey(): string {
  const key = randomParticipantKey();
  try {
    sessionStorage.setItem(ROOM_PARTICIPANT_KEY, key);
  } catch {
    /* ignore */
  }
  return key;
}
interface EventData {
  id: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  type: string;
  hostName?: string | null;
}

interface LiveKitTokenResponse {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  name: string;
}

/** Выбор камеры/микрофона (внутри LiveKitRoom), вызывается из выпадающей панели настроек. */
function RoomMediaDeviceSettings({ isLight, isOpen }: { isLight: boolean; isOpen: boolean }) {
  const room = useRoomContext();
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoSel, setVideoSel] = useState('');
  const [audioSel, setAudioSel] = useState('');

  const refreshList = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const all = await navigator.mediaDevices.enumerateDevices();
      setVideoInputs(all.filter((d) => d.kind === 'videoinput'));
      setAudioInputs(all.filter((d) => d.kind === 'audioinput'));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const md = navigator.mediaDevices;
    md?.addEventListener?.('devicechange', refreshList);
    return () => md?.removeEventListener?.('devicechange', refreshList);
  }, [refreshList]);

  useEffect(() => {
    if (isOpen) void refreshList();
  }, [isOpen, refreshList]);

  useEffect(() => {
    const ro = room as unknown as { getActiveDevice?: (k: MediaDeviceKind) => string | undefined };
    if (!ro?.getActiveDevice) return;
    const v = ro.getActiveDevice('videoinput');
    const a = ro.getActiveDevice('audioinput');
    if (v) setVideoSel(v);
    if (a) setAudioSel(a);
  }, [room, videoInputs.length, audioInputs.length, isOpen]);

  if (!room) return null;

  const selectClass = `voice-room-device-select ${isLight ? 'voice-room-device-select--light' : 'voice-room-device-select--dark'}`;
  const selectStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    fontSize: 13,
    padding: '10px 12px',
    borderRadius: 10,
    border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(148, 163, 184, 0.45)',
    background: isLight ? '#ffffff' : '#0f172a',
    color: isLight ? '#0f172a' : '#f1f5f9',
    outline: 'none',
    cursor: 'pointer'
  };
  const labelStyle: CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6,
    color: isLight ? '#475569' : '#94a3b8'
  };
  const titleColor = isLight ? '#0f172a' : '#f8fafc';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 260 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: titleColor }}>Камера и микрофон</div>
      <div>
        <div style={labelStyle}>Камера</div>
        <select
          className={selectClass}
          aria-label="Камера"
          value={videoSel}
          onChange={async (e) => {
            const id = e.target.value;
            setVideoSel(id);
            if (!id) return;
            try {
              await (room as Room).switchActiveDevice('videoinput', id);
            } catch (err) {
              console.error('switch camera', err);
            }
          }}
          style={selectStyle}
        >
          <option value="">Выберите камеру…</option>
          {videoInputs.map((d) => (
            <option key={`v-${d.deviceId}`} value={d.deviceId}>
              {d.label || 'Камера'}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div style={labelStyle}>Микрофон</div>
        <select
          className={selectClass}
          aria-label="Микрофон"
          value={audioSel}
          onChange={async (e) => {
            const id = e.target.value;
            setAudioSel(id);
            if (!id) return;
            try {
              await (room as Room).switchActiveDevice('audioinput', id);
            } catch (err) {
              console.error('switch mic', err);
            }
          }}
          style={selectStyle}
        >
          <option value="">Выберите микрофон…</option>
          {audioInputs.map((d) => (
            <option key={`a-${d.deviceId}`} value={d.deviceId}>
              {d.label || 'Микрофон'}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function isGuestInviteType(type: string): boolean {
  return type === 'video' || type === 'call';
}

function buildGuestInviteText(title: string, startsAt: string, endsAt: string | undefined, roomId: string): string {
  const invite = `${window.location.origin}/room/${roomId}?guest=1`;
  const timeLabel = `${new Date(startsAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}${
    endsAt ? ` – ${new Date(endsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''
  }`;
  const meetingTitle = title.trim() || 'Видеовстреча';
  return (
    `JungAI — приглашение на видеозвонок\n` +
    `Встреча: ${meetingTitle}\n` +
    `Время: ${timeLabel}\n\n` +
    `Ссылка для гостевого входа в комнату (скопируйте в браузер):\n${invite}\n\n` +
    `Откройте ссылку в указанное время. Гостевой режим не требует входа в аккаунт.`
  );
}

type ConferenceProps = {
  eventType: string;
  eventTitle: string;
  eventStartsAt: string;
  eventEndsAt?: string;
  roomId: string;
  selfDisplayName?: string;
  selfAvatarUrl?: string | null;
  onLeave: () => void;
};

function MicStatusIcon({ enabled, size = 14, className = '' }: { enabled: boolean; size?: number; className?: string }) {
  const cls = `voice-room-mic-status${enabled ? '' : ' voice-room-mic-status--off'}${className ? ` ${className}` : ''}`;
  return enabled ? <Mic size={size} strokeWidth={2} className={cls} aria-hidden /> : <MicOff size={size} strokeWidth={2} className={cls} aria-hidden />;
}

function getGridLayoutClass(count: number): string {
  if (count <= 1) return '';
  if (count === 2) return 'voice-room-grid--count-2';
  if (count === 3) return 'voice-room-grid--count-3';
  if (count === 4) return 'voice-room-grid--count-4';
  if (count === 5) return 'voice-room-grid--count-5';
  if (count === 6) return 'voice-room-grid--count-6';
  if (count === 7) return 'voice-room-grid--count-7';
  if (count === 8) return 'voice-room-grid--count-8';
  return 'voice-room-grid--count-9';
}

function ParticipantNameBadge({ displayName, avatarUrl, micEnabled, suffix }: { displayName: string; avatarUrl?: string; micEnabled: boolean; suffix?: string }) {
  return (
    <div className="voice-room-tile__badge">
      {avatarUrl !== undefined && (
        <div className="voice-room-tile__badge-avatar">
          {avatarUrl ? <img src={avatarUrl} alt="" draggable={false} /> : <PlatformIcon name="user" size={11} color="#cbd5e1" />}
        </div>
      )}
      <span className="voice-room-tile__badge-name">{displayName}{suffix ? ` · ${suffix}` : ''}</span>
      <MicStatusIcon enabled={micEnabled} size={13} />
    </div>
  );
}

function LiveKitConferenceRu({ eventType, eventTitle, eventStartsAt, eventEndsAt, roomId, selfDisplayName, selfAvatarUrl, onLeave }: ConferenceProps) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const [sidebarMode, setSidebarMode] = useState<'chat' | 'participants' | null>(null);
  const [deviceMenuOpen, setDeviceMenuOpen] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const deviceMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileDeviceMenuRef = useRef<HTMLDivElement | null>(null);
  const inviteResetTimerRef = useRef<number | null>(null);
  const [chatText, setChatText] = useState('');
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const participantMetaCacheRef = useRef<Record<string, { avatarUrl: string; displayName: string }>>({});
  const { chatMessages, send, isSending } = useChat();
  const participants = useParticipants();
  const { canPlayAudio, startAudio } = useAudioPlayback();
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false });
  const screenTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });
  const showInviteLink = isGuestInviteType(eventType);
  const hasScreenShare = screenTracks.length > 0;
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 900 : false));

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= 900);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!deviceMenuOpen) return;
    let removeListener: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      function onPointerDown(e: PointerEvent) {
        const target = e.target as Node;
        if (deviceMenuRef.current?.contains(target) || mobileDeviceMenuRef.current?.contains(target)) return;
        setDeviceMenuOpen(false);
      }
      document.addEventListener('pointerdown', onPointerDown);
      removeListener = () => document.removeEventListener('pointerdown', onPointerDown);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      removeListener?.();
    };
  }, [deviceMenuOpen]);

  useEffect(() => {
    return () => {
      if (inviteResetTimerRef.current) window.clearTimeout(inviteResetTimerRef.current);
    };
  }, []);

  async function submitChat(e: FormEvent) {
    e.preventDefault();
    const text = chatText.trim();
    if (!text) return;
    await send(text);
    setChatText('');
    if (chatInputRef.current) chatInputRef.current.style.height = '40px';
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(buildGuestInviteText(eventTitle, eventStartsAt, eventEndsAt, roomId));
      setInviteCopied(true);
      if (inviteResetTimerRef.current) window.clearTimeout(inviteResetTimerRef.current);
      inviteResetTimerRef.current = window.setTimeout(() => {
        setInviteCopied(false);
        inviteResetTimerRef.current = null;
      }, 1500);
    } catch {
      /* ignore */
    }
  }

  const uniqueCameraTracks = (() => {
    const byIdentity = new Map<string, TrackReferenceOrPlaceholder>();
    for (const tr of cameraTracks) {
      const id = tr.participant.identity;
      if (!byIdentity.has(id)) byIdentity.set(id, tr);
    }
    return Array.from(byIdentity.values());
  })();

  const maxTiles = 9;
  const participantTiles: TrackReferenceOrPlaceholder[] = participants.slice(0, maxTiles).map((p) => {
    const existing = uniqueCameraTracks.find((t) => t.participant.identity === p.identity);
    if (existing) return existing;
    return { participant: p, source: Track.Source.Camera } as TrackReferenceOrPlaceholder;
  });
  const extraParticipants = participants.length > maxTiles ? participants.slice(maxTiles) : [];
  const soloView = !hasScreenShare && participantTiles.length === 1;

  const getParticipantMeta = (p: any) => {
    let avatarUrl = '';
    let displayName = p.name || p.identity || 'Участник';
    if (p.isLocal) {
      if (selfDisplayName) displayName = selfDisplayName;
      if (selfAvatarUrl) avatarUrl = selfAvatarUrl;
    }
    try {
      const meta = p.metadata ? JSON.parse(p.metadata) : null;
      if (!avatarUrl) avatarUrl = meta?.avatarUrl || '';
      if (!p.isLocal || !selfDisplayName) displayName = meta?.displayName || displayName;
    } catch {
      /* ignore */
    }
    if (avatarUrl && avatarUrl.startsWith('/')) {
      avatarUrl = `${getApiBaseUrl()}${avatarUrl}`;
    }
    const cached = participantMetaCacheRef.current[p.identity || ''];
    const resolvedAvatar = avatarUrl || cached?.avatarUrl || '';
    const resolvedName = displayName || cached?.displayName || 'Участник';
    if (p.identity) {
      participantMetaCacheRef.current[p.identity] = { avatarUrl: resolvedAvatar, displayName: resolvedName };
    }
    return { avatarUrl: resolvedAvatar, displayName: resolvedName };
  };

  const getConnectionQualityLabel = (p: any) => {
    const q = String(p?.connectionQuality || '').toLowerCase();
    if (q.includes('excellent')) return 'Качество связи: отличное';
    if (q.includes('good')) return 'Качество связи: хорошее';
    if (q.includes('poor')) return 'Качество связи: слабое';
    return 'Качество связи: неизвестно';
  };

  function renderParticipantTile(trackRef: TrackReferenceOrPlaceholder, key: string) {
    const { avatarUrl, displayName } = getParticipantMeta(trackRef.participant);
    const hasVideoTrack = Boolean((trackRef as any)?.publication?.track);
    const speaking = trackRef.participant.isSpeaking;

    if (hasVideoTrack) {
      return (
        <div key={key} className={`voice-room-tile voice-room-tile-host${speaking ? ' voice-room-tile--speaking' : ''}`}>
          <ParticipantTile
            trackRef={trackRef}
            className="voice-room-tile__video"
            title={getConnectionQualityLabel(trackRef.participant)}
          />
          <ParticipantNameBadge
            displayName={displayName}
            avatarUrl={avatarUrl}
            micEnabled={trackRef.participant.isMicrophoneEnabled}
          />
        </div>
      );
    }

    return (
      <div key={key} className={`voice-room-tile${speaking ? ' voice-room-tile--speaking' : ''}`} title={getConnectionQualityLabel(trackRef.participant)}>
        <div className="voice-room-tile__avatar-full">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} draggable={false} onContextMenu={(e) => e.preventDefault()} />
          ) : (
            <div className="voice-room-tile__avatar-fallback" aria-hidden>
              <PlatformIcon name="user" size={56} color="#94a3b8" />
            </div>
          )}
        </div>
        <ParticipantNameBadge displayName={displayName} micEnabled={trackRef.participant.isMicrophoneEnabled} />
      </div>
    );
  }

  function renderSoloView() {
    const p = participantTiles[0]?.participant;
    if (!p) return null;
    const { avatarUrl, displayName } = getParticipantMeta(p);
    const micOn = p.isMicrophoneEnabled;

    return (
      <div className="voice-room-solo">
        <div className={`voice-room-solo__circle${avatarUrl ? '' : ' voice-room-solo__circle--placeholder'}`}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} draggable={false} onContextMenu={(e) => e.preventDefault()} />
          ) : (
            <div className="voice-room-solo__silhouette" aria-hidden>
              <PlatformIcon name="user" size={88} color="#9ca3af" />
            </div>
          )}
        </div>
        <div className="voice-room-solo__name">
          <span>{displayName}</span>
          <MicStatusIcon enabled={micOn} size={15} />
        </div>
      </div>
    );
  }

  function renderParticipantList() {
    return (
      <>
        {participants.map((p: any) => {
          const { avatarUrl, displayName } = getParticipantMeta(p);
          return (
            <div key={p.identity} className="voice-room-participant-row" title={getConnectionQualityLabel(p)}>
              <div className="voice-room-participant-row__avatar">
                {avatarUrl ? <img src={avatarUrl} alt="" draggable={false} /> : <PlatformIcon name="user" size={12} />}
              </div>
              <div className="voice-room-participant-row__name">{displayName}</div>
            </div>
          );
        })}
        {extraParticipants.length > 0 && (
          <div className="small" style={{ color: '#94a3b8' }}>Ещё {extraParticipants.length} вне основной сетки</div>
        )}
      </>
    );
  }

  function renderChatPanel() {
    return (
      <>
        <div className="voice-room-sidebar__body">
          {chatMessages.length === 0 && <div className="small" style={{ color: '#94a3b8' }}>Сообщений пока нет</div>}
          {chatMessages.map((msg: any, i: number) => (
            <div key={`${msg.timestamp || i}-${i}`}>
              <div className="voice-room-chat-msg__from">{msg.from?.name || msg.from?.identity || 'Участник'}</div>
              <div className="voice-room-chat-msg__text">{msg.message}</div>
            </div>
          ))}
        </div>
        <form onSubmit={submitChat} className="voice-room-sidebar__chat-form">
          <textarea
            ref={chatInputRef}
            value={chatText}
            onChange={(e) => {
              setChatText(e.target.value);
              const el = e.target;
              el.style.height = '40px';
              el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
            }}
            placeholder="Напишите сообщение..."
            rows={1}
            className="voice-room-sidebar__chat-input"
          />
          <button type="submit" className="button" title="Отправить" disabled={isSending || !chatText.trim()} style={{ width: 40, height: 40, padding: 0, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <SendHorizontal size={16} />
          </button>
        </form>
      </>
    );
  }

  function renderDeviceMenuPanel(mobile = false) {
    return (
      <div className={`voice-room-device-menu${mobile ? ' voice-room-device-menu--mobile' : ''}`} role="menu">
        {mobile && (
          <button
            type="button"
            className={`voice-room-device-menu__action${isScreenShareEnabled ? ' voice-room-device-menu__action--active' : ''}`}
            onClick={() => void localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
          >
            <MonitorUp size={18} strokeWidth={2} />
            <span>{isScreenShareEnabled ? 'Остановить демонстрацию' : 'Демонстрация экрана'}</span>
          </button>
        )}
        <RoomMediaDeviceSettings isLight={false} isOpen={deviceMenuOpen} />
      </div>
    );
  }

  const chatOpen = sidebarMode === 'chat';
  const participantsOpen = sidebarMode === 'participants';
  const participantCount = participantTiles.length;
  const gridLayoutClass = getGridLayoutClass(participantCount);

  return (
    <div className={`voice-room-call${sidebarMode && !isMobile ? ' voice-room-call--with-sidebar' : ''}${isMobile ? ' voice-room-call--mobile' : ''}`}>
      <div className="voice-room-stage-wrap">
        {!canPlayAudio && (
          <div className="voice-room-audio-hint">
            <button type="button" className="voice-room-ctrl-btn voice-room-ctrl-btn--pill" onClick={() => startAudio()}>
              Включить звук в браузере
            </button>
          </div>
        )}

        <div className={`voice-room-stage${!soloView && !hasScreenShare ? ' voice-room-stage--grid' : ''}${hasScreenShare ? ' voice-room-stage--screenshare' : ''}`}>
          {hasScreenShare ? (
            <div className="voice-room-screenshare">
              <div className="voice-room-screenshare__frame voice-room-tile-host">
                <ParticipantTile trackRef={screenTracks[0]} className="voice-room-tile__video voice-room-tile__video--contain" title={getConnectionQualityLabel(screenTracks[0].participant)} />
                {(() => {
                  const { avatarUrl, displayName } = getParticipantMeta(screenTracks[0].participant);
                  return (
                    <ParticipantNameBadge
                      displayName={displayName}
                      avatarUrl={avatarUrl}
                      micEnabled={screenTracks[0].participant.isMicrophoneEnabled}
                      suffix="экран"
                    />
                  );
                })()}
              </div>
            </div>
          ) : soloView ? (
            renderSoloView()
          ) : (
            <div className={`voice-room-grid ${gridLayoutClass}`}>
              {participantTiles.map((trackRef, idx) => renderParticipantTile(trackRef, `${trackRef.participant.identity}-${idx}`))}
            </div>
          )}

          {extraParticipants.length > 0 && !soloView && (
            <div className="voice-room-extra-hint">+{extraParticipants.length} участник(ов)</div>
          )}

          {sidebarMode && isMobile && (
            <aside className="voice-room-sidebar voice-room-sidebar--overlay" style={{ gridTemplateRows: chatOpen ? 'auto minmax(0,1fr) auto' : 'auto minmax(0,1fr)', display: 'grid' }}>
              <div className="voice-room-sidebar__head">{chatOpen ? 'Чат' : `Участники · ${participants.length}`}</div>
              {chatOpen ? renderChatPanel() : <div className="voice-room-sidebar__body">{renderParticipantList()}</div>}
            </aside>
          )}
        </div>

        {deviceMenuOpen && isMobile && (
          <>
            <button
              type="button"
              className="voice-room-device-menu-backdrop"
              aria-label="Закрыть настройки"
              onClick={() => setDeviceMenuOpen(false)}
            />
            <div ref={mobileDeviceMenuRef}>{renderDeviceMenuPanel(true)}</div>
          </>
        )}

        <div className="voice-room-toolbar">
          <div className="voice-room-toolbar__group voice-room-toolbar__group--left">
            {showInviteLink && (
              <button
                type="button"
                className={`voice-room-ctrl-btn voice-room-ctrl-btn--round${inviteCopied ? ' voice-room-ctrl-btn--copied' : ''}`}
                title="Скопировать ссылку-приглашение"
                onClick={() => void copyInviteLink()}
              >
                {inviteCopied ? <Check size={22} strokeWidth={2} /> : <Paperclip size={22} strokeWidth={2} />}
              </button>
            )}
            <button
              type="button"
              className={`voice-room-ctrl-btn voice-room-ctrl-btn--round${!isMicrophoneEnabled ? ' voice-room-ctrl-btn--muted' : ''}`}
              title="Микрофон"
              aria-label="Микрофон"
              aria-pressed={isMicrophoneEnabled}
              onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
            >
              <MicStatusIcon enabled={isMicrophoneEnabled} size={22} />
            </button>
            <button
              type="button"
              className="voice-room-ctrl-btn voice-room-ctrl-btn--round"
              title="Камера"
              aria-label="Камера"
              aria-pressed={isCameraEnabled}
              onClick={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
            >
              {isCameraEnabled ? <Video size={22} strokeWidth={2} /> : <VideoOff size={22} strokeWidth={2} />}
            </button>
          </div>

          <div className={`voice-room-toolbar__group voice-room-toolbar__group--center${deviceMenuOpen ? ' voice-room-toolbar__group--menu-open' : ''}`}>
            {!isMobile && (
              <button
                type="button"
                className={`voice-room-ctrl-btn voice-room-ctrl-btn--pill voice-room-ctrl-btn--screenshare${isScreenShareEnabled ? ' voice-room-ctrl-btn--active' : ''}`}
                title="Демонстрация"
                aria-label="Демонстрация"
                aria-pressed={isScreenShareEnabled}
                onClick={() => void localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
              >
                <MonitorUp size={20} strokeWidth={2} />
                <span className="voice-room-ctrl-label">Демонстрация</span>
              </button>
            )}
            <button
              type="button"
              className={`voice-room-ctrl-btn voice-room-ctrl-btn--pill${participantsOpen ? ' voice-room-ctrl-btn--active' : ''}`}
              title="Участники"
              onClick={() => { setDeviceMenuOpen(false); setSidebarMode((m) => (m === 'participants' ? null : 'participants')); }}
            >
              <Users size={18} />
              <span className="voice-room-ctrl-label">Участники {participants.length}</span>
            </button>
            <button
              type="button"
              className={`voice-room-ctrl-btn voice-room-ctrl-btn--pill${chatOpen ? ' voice-room-ctrl-btn--active' : ''}`}
              title="Чат"
              onClick={() => { setDeviceMenuOpen(false); setSidebarMode((m) => (m === 'chat' ? null : 'chat')); }}
            >
              <MessageSquare size={18} />
              <span className="voice-room-ctrl-label">Чат</span>
            </button>
            <div ref={deviceMenuRef} className="voice-room-device-menu-anchor">
              <button
                type="button"
                className={`voice-room-ctrl-btn voice-room-ctrl-btn--pill${deviceMenuOpen ? ' voice-room-ctrl-btn--active' : ''}`}
                title="Настройки"
                aria-expanded={deviceMenuOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeviceMenuOpen((o) => !o);
                }}
              >
                <MoreHorizontal size={18} />
              </button>
              {deviceMenuOpen && !isMobile && renderDeviceMenuPanel()}
            </div>
          </div>

          <div className="voice-room-toolbar__group voice-room-toolbar__group--right">
            <button
              type="button"
              className="voice-room-ctrl-btn voice-room-ctrl-btn--hangup"
              title="Покинуть встречу"
              aria-label="Покинуть встречу"
              onClick={onLeave}
            >
              <PhoneOff size={22} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>

      {sidebarMode && !isMobile && (
        <aside className="voice-room-sidebar" style={{ gridTemplateRows: chatOpen ? 'auto minmax(0,1fr) auto' : 'auto minmax(0,1fr)', display: 'grid' }}>
          <div className="voice-room-sidebar__head">{chatOpen ? 'Чат встречи' : `Участники · ${participants.length}`}</div>
          {chatOpen ? renderChatPanel() : <div className="voice-room-sidebar__body">{renderParticipantList()}</div>}
        </aside>
      )}
    </div>
  );
}

export default function VoiceRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const { token, user, profile } = useAuth();
  const navigate = useNavigate();

  const guestForced = searchParams.get('guest') === '1';
  const [authFallbackGuest, setAuthFallbackGuest] = useState(false);
  // Просроченный JWT в localStorage у тех, кто давно не заходил — не считаем сессию живой
  const effectiveAuthToken = token && !isJwtExpired(token) ? token : null;
  const isGuestMode = guestForced || !effectiveAuthToken || authFallbackGuest;
  const roomApiToken = isGuestMode ? undefined : (effectiveAuthToken ?? undefined);
  
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [livekitToken, setLivekitToken] = useState<string>('');
  const [livekitUrl, setLivekitUrl] = useState<string>('');
  const [lkRoom, setLkRoom] = useState<Room | null>(null);
  const [guestDisplayName, setGuestDisplayName] = useState('');
  const [joinedAsName, setJoinedAsName] = useState('');
  const [reconnectHint, setReconnectHint] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [preCameraOn, setPreCameraOn] = useState(true);
  const [preMicOn, setPreMicOn] = useState(true);
  const [joinWithCamera, setJoinWithCamera] = useState(true);
  const [joinWithMic, setJoinWithMic] = useState(true);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDeviceId, setVideoDeviceId] = useState('');
  const [audioDeviceId, setAudioDeviceId] = useState('');
  const [joining, setJoining] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const intentionalLeaveRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectInFlightRef = useRef(false);
  const ignoreDisconnectRef = useRef(false);
  const joinedRef = useRef(false);
  const lkRoomRef = useRef<Room | null>(null);
  const joinMediaRef = useRef({ camera: true, mic: true });
  const guestNameRef = useRef('');
  const isGuestModeRef = useRef(isGuestMode);
  const roomApiTokenRef = useRef(roomApiToken);

  isGuestModeRef.current = isGuestMode;
  roomApiTokenRef.current = roomApiToken;
  guestNameRef.current = guestDisplayName;
  joinedRef.current = joined;

  const displayNameForPreview =
    (isGuestMode ? guestDisplayName.trim() : '') ||
    profile?.name ||
    user?.name ||
    user?.email?.split('@')[0] ||
    'Вы';
  const avatarUrlForPreview = isGuestMode
    ? null
    : resolvePublicFileUrl(profile?.avatarUrl || user?.avatarUrl);

  useEffect(() => {
    if (!isGuestMode && (profile?.name || user?.name) && !guestDisplayName) {
      setGuestDisplayName(String(profile?.name || user?.name || ''));
    }
  }, [isGuestMode, profile?.name, user?.name, guestDisplayName]);

  useEffect(() => {
    let cancelled = false;
    async function loadDevices() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const all = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const vids = all.filter((d) => d.kind === 'videoinput');
        const auds = all.filter((d) => d.kind === 'audioinput');
        setVideoDevices(vids);
        setAudioDevices(auds);
        setVideoDeviceId((prev) => prev || vids[0]?.deviceId || '');
        setAudioDeviceId((prev) => prev || auds[0]?.deviceId || '');
      } catch {
        /* ignore */
      }
    }
    void loadDevices();
    const md = navigator.mediaDevices;
    md?.addEventListener?.('devicechange', loadDevices);
    return () => {
      cancelled = true;
      md?.removeEventListener?.('devicechange', loadDevices);
    };
  }, []);

  useEffect(() => {
    if (joined) {
      previewStreamRef.current?.getTracks().forEach((t) => t.stop());
      previewStreamRef.current = null;
      return;
    }
    let cancelled = false;
    async function startPreview() {
      previewStreamRef.current?.getTracks().forEach((t) => t.stop());
      previewStreamRef.current = null;
      if (!preCameraOn) {
        if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
        return;
      }
      try {
        const constraints: MediaStreamConstraints = {
          video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
          audio: false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        previewStreamRef.current = stream;
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
          void previewVideoRef.current.play().catch(() => undefined);
        }
        // refresh labels after permission
        const all = await navigator.mediaDevices.enumerateDevices();
        setVideoDevices(all.filter((d) => d.kind === 'videoinput'));
        setAudioDevices(all.filter((d) => d.kind === 'audioinput'));
      } catch {
        setPreCameraOn(false);
      }
    }
    void startPreview();
    return () => {
      cancelled = true;
      previewStreamRef.current?.getTracks().forEach((t) => t.stop());
      previewStreamRef.current = null;
    };
  }, [joined, preCameraOn, videoDeviceId]);

  function formatMeetingLine(ev: EventData): string {
    const start = new Date(ev.startsAt);
    const now = new Date();
    const sameDay =
      start.getFullYear() === now.getFullYear() &&
      start.getMonth() === now.getMonth() &&
      start.getDate() === now.getDate();
    const time = start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const when = sameDay
      ? `сегодня, ${time}`
      : start.toLocaleString('ru-RU', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
    const typeLabel =
      ev.type === 'session'
        ? 'Сессия'
        : ev.type === 'video' || ev.type === 'call'
          ? 'Видеовстреча'
          : ev.type === 'supervision'
            ? 'Супервизия'
            : ev.type === 'webinar'
              ? 'Вебинар'
              : (ev.title?.trim() || 'Встреча');
    const name = (ev.hostName || '').trim() || 'специалист';
    return `${typeLabel} · ${name} · ${when}`;
  }

  const loadEventData = useCallback(async () => {
    if (!roomId) return;
    try {
      // Не размонтировать LiveKitRoom спиннером, если уже в звонке
      if (!joinedRef.current) setLoading(true);
      // Гостевая ссылка или просроченный JWT — сразу публичная комната
      if (!guestForced && effectiveAuthToken) {
        try {
          const res = await api<{ event: EventData; voiceRoom: any }>(`/api/events/by-room/${roomId}`, {
            token: effectiveAuthToken,
            suppressSessionExpired: true,
          });
          setEvent(res.event);
          setAuthFallbackGuest(false);
          setError(null);
          return;
        } catch (e: any) {
          // 401/403 → вход как гость (чужой аккаунт / истекшая сессия)
          if (e?.status !== 401 && e?.status !== 403) throw e;
          setAuthFallbackGuest(true);
        }
      } else if (!guestForced && token && !effectiveAuthToken) {
        setAuthFallbackGuest(true);
      }
      const res = await api<{ event: EventData; voiceRoom: any }>(`/api/events/public-room/${roomId}`);
      setEvent(res.event);
      setError(null);
    } catch (e: any) {
      console.error('Failed to load room data:', e);
      setError(e.message || 'Не удалось загрузить данные комнаты');
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [roomId, guestForced, token, effectiveAuthToken]);

  useEffect(() => {
    if (!roomId) {
      setError('Room ID missing');
      setLoading(false);
      return;
    }

    void loadEventData();
  }, [roomId, loadEventData]);

  const fetchLiveKitToken = useCallback(
    async (opts: { asGuest: boolean; displayName: string; authToken?: string | null }) => {
      if (!roomId) throw new Error('Room ID missing');
      const participantKey = getRoomParticipantKey();
      if (opts.asGuest) {
        return api<LiveKitTokenResponse>(`/api/events/room/${roomId}/guest-livekit-token`, {
          method: 'POST',
          body: { displayName: opts.displayName.trim() || 'Гость', participantKey },
        });
      }
      try {
        return await api<LiveKitTokenResponse>(
          `/api/events/room/${roomId}/livekit-token?sid=${encodeURIComponent(participantKey)}`,
          {
            token: opts.authToken || undefined,
            suppressSessionExpired: true,
          }
        );
      } catch (e: any) {
        if (e?.status !== 401 && e?.status !== 403) throw e;
        setAuthFallbackGuest(true);
        const name = opts.displayName.trim();
        if (!name) {
          throw new Error('Сессия истекла. Введите имя и присоединитесь как гость.');
        }
        return api<LiveKitTokenResponse>(`/api/events/room/${roomId}/guest-livekit-token`, {
          method: 'POST',
          body: { displayName: name, participantKey },
        });
      }
    },
    [roomId]
  );

  const ensureLkRoom = useCallback(() => {
    if (lkRoomRef.current) return lkRoomRef.current;
    const room = new Room({ ...STABLE_ROOM_OPTIONS });
    lkRoomRef.current = room;
    setLkRoom(room);
    return room;
  }, []);

  async function handleJoin(opts?: { camera?: boolean; mic?: boolean }) {
    if (!roomId) return;
    const wantCamera = opts?.camera ?? preCameraOn;
    const wantMic = opts?.mic ?? preMicOn;
    if (isGuestMode && !guestDisplayName.trim()) {
      setError('Введите имя для входа в комнату');
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const res = await fetchLiveKitToken({
        asGuest: isGuestMode,
        displayName: guestDisplayName,
        authToken: roomApiToken,
      });
      previewStreamRef.current?.getTracks().forEach((t) => t.stop());
      previewStreamRef.current = null;
      joinMediaRef.current = { camera: wantCamera, mic: wantMic };
      setJoinWithCamera(wantCamera);
      setJoinWithMic(wantMic);
      ensureLkRoom();
      setLivekitToken(res.token);
      setLivekitUrl(res.url);
      setJoinedAsName(res.name || '');
      reconnectAttemptsRef.current = 0;
      intentionalLeaveRef.current = false;
      ignoreDisconnectRef.current = false;
      setJoined(true);
      setReconnecting(false);
      setReconnectHint(null);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Не удалось подключиться к видеокомнате');
    } finally {
      setJoining(false);
    }
  }

  const attemptAutoReconnect = useCallback(async (forceNewIdentity = false) => {
    if (!roomId || reconnectInFlightRef.current || intentionalLeaveRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_AUTO_RECONNECT) {
      setReconnecting(false);
      setReconnectHint('Связь с комнатой прервалась. Нажмите «Подключиться» ещё раз.');
      setJoined(false);
      setLivekitToken('');
      return;
    }
    reconnectInFlightRef.current = true;
    reconnectAttemptsRef.current += 1;
    const attempt = reconnectAttemptsRef.current;
    setReconnecting(true);
    setReconnectHint(`Переподключение… (${attempt}/${MAX_AUTO_RECONNECT})`);
    try {
      await new Promise((r) => setTimeout(r, Math.min(2500, 400 * attempt)));
      if (intentionalLeaveRef.current) return;
      if (forceNewIdentity) rotateRoomParticipantKey();
      const asGuest = isGuestModeRef.current;
      const name =
        guestNameRef.current.trim() ||
        profile?.name ||
        user?.name ||
        user?.email?.split('@')[0] ||
        'Гость';
      const res = await fetchLiveKitToken({
        asGuest,
        displayName: name,
        authToken: roomApiTokenRef.current,
      });
      if (intentionalLeaveRef.current) return;
      ignoreDisconnectRef.current = true;
      ensureLkRoom();
      setLivekitToken(res.token);
      setLivekitUrl(res.url);
      setJoinedAsName(res.name || '');
      setJoinWithCamera(joinMediaRef.current.camera);
      setJoinWithMic(joinMediaRef.current.mic);
      setJoined(true);
      setReconnecting(false);
      setReconnectHint(null);
      window.setTimeout(() => {
        ignoreDisconnectRef.current = false;
      }, 800);
    } catch (e: any) {
      console.warn('[VoiceRoom] auto-reconnect failed:', e);
      if (reconnectAttemptsRef.current >= MAX_AUTO_RECONNECT) {
        setJoined(false);
        setLivekitToken('');
        setReconnecting(false);
        setReconnectHint('Связь с комнатой прервалась. Нажмите «Подключиться» ещё раз.');
      } else {
        reconnectInFlightRef.current = false;
        void attemptAutoReconnect(forceNewIdentity);
        return;
      }
    } finally {
      reconnectInFlightRef.current = false;
    }
  }, [roomId, fetchLiveKitToken, ensureLkRoom, profile?.name, user?.name, user?.email]);

  function handleLeave() {
    intentionalLeaveRef.current = true;
    ignoreDisconnectRef.current = true;
    try {
      lkRoomRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    lkRoomRef.current = null;
    setLkRoom(null);
    setJoined(false);
    setLivekitToken('');
    setReconnectHint(null);
    setReconnecting(false);
    if (isGuestMode) {
      navigate('/');
      return;
    }
    if (user?.role === 'client') {
      navigate('/client/sessions');
      return;
    }
    if (user?.role === 'researcher') {
      navigate('/researcher/calls');
      return;
    }
    navigate('/events');
  }

  const handleRoomDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      if (intentionalLeaveRef.current || ignoreDisconnectRef.current) return;
      if (
        reason === DisconnectReason.ROOM_DELETED ||
        reason === DisconnectReason.PARTICIPANT_REMOVED
      ) {
        setJoined(false);
        setLivekitToken('');
        setReconnecting(false);
        setReconnectHint('Встреча завершена или доступ закрыт.');
        return;
      }
      const duplicate = reason === DisconnectReason.DUPLICATE_IDENTITY;
      void attemptAutoReconnect(duplicate);
    },
    [attemptAutoReconnect]
  );

  const handleRoomError = useCallback(
    (err: Error) => {
      if (intentionalLeaveRef.current) return;
      console.warn('[VoiceRoom] LiveKit error:', err);
      void attemptAutoReconnect();
    },
    [attemptAutoReconnect]
  );

  const handleRoomDisconnectedRef = useRef(handleRoomDisconnected);
  const handleRoomErrorRef = useRef(handleRoomError);
  handleRoomDisconnectedRef.current = handleRoomDisconnected;
  handleRoomErrorRef.current = handleRoomError;

  const stableOnDisconnected = useCallback((reason?: DisconnectReason) => {
    handleRoomDisconnectedRef.current(reason);
  }, []);

  const stableOnError = useCallback((err: Error) => {
    handleRoomErrorRef.current(err);
  }, []);

  if (loading) {
    return (
      <div className="voice-room-prejoin" style={{ placeItems: 'center', display: 'grid' }}>
        <div style={{ textAlign: 'center', opacity: 0.75 }}>Загрузка комнаты…</div>
      </div>
    );
  }

  if ((error && !event) || !event) {
    return (
      <div className="voice-room-prejoin" style={{ placeItems: 'center', display: 'grid' }}>
        <div style={{ textAlign: 'center', padding: 48, maxWidth: 420 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Ошибка</div>
          <div style={{ color: 'rgba(245,245,245,0.6)', marginBottom: 24 }}>{error || 'Комната не найдена'}</div>
          <button
            type="button"
            className="voice-room-prejoin__join"
            style={{ width: 'auto', paddingInline: 24 }}
            onClick={() => navigate(isGuestMode ? '/' : user?.role === 'researcher' ? '/researcher/calls' : '/events')}
          >
            {isGuestMode ? 'На главную' : 'Вернуться к событиям'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: '#121212',
        color: '#f5f5f5',
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {!joined ? (
          <div className="voice-room-prejoin" style={{ width: '100%' }}>
            <div className="voice-room-prejoin__top">{formatMeetingLine(event)}</div>
            <div className="voice-room-prejoin__body">
              <div className="voice-room-prejoin__card">
                <div className="voice-room-prejoin__self">
                  {preCameraOn ? (
                    <video
                      ref={previewVideoRef}
                      className="voice-room-prejoin__video"
                      playsInline
                      muted
                      autoPlay
                    />
                  ) : (
                    <div className="voice-room-prejoin__avatar">
                      {avatarUrlForPreview ? (
                        <img
                          className="voice-room-prejoin__avatar-img"
                          src={avatarUrlForPreview}
                          alt=""
                        />
                      ) : (
                        <div className="voice-room-prejoin__avatar-fallback">
                          {displayNameForPreview.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="voice-room-prejoin__toggles">
                    <button
                      type="button"
                      className={`voice-room-prejoin__toggle${preMicOn ? '' : ' is-off'}`}
                      title={preMicOn ? 'Выключить микрофон' : 'Включить микрофон'}
                      aria-pressed={preMicOn}
                      onClick={() => setPreMicOn((v) => !v)}
                    >
                      {preMicOn ? <Mic size={20} strokeWidth={2} aria-hidden /> : <MicOff size={20} strokeWidth={2} aria-hidden />}
                    </button>
                    <button
                      type="button"
                      className={`voice-room-prejoin__toggle${preCameraOn ? '' : ' is-off'}`}
                      title={preCameraOn ? 'Выключить камеру' : 'Включить камеру'}
                      aria-pressed={preCameraOn}
                      onClick={() => setPreCameraOn((v) => !v)}
                    >
                      {preCameraOn ? <Video size={20} strokeWidth={2} aria-hidden /> : <VideoOff size={20} strokeWidth={2} aria-hidden />}
                    </button>
                  </div>
                </div>

                <div className="voice-room-prejoin__devices">
                  <div className="voice-room-prejoin__device-row">
                    <Video size={18} strokeWidth={2} aria-hidden />
                    <select
                      value={videoDeviceId}
                      onChange={(e) => setVideoDeviceId(e.target.value)}
                      aria-label="Камера"
                    >
                      {videoDevices.length === 0 && <option value="">Камера по умолчанию</option>}
                      {videoDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || 'Камера'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="voice-room-prejoin__device-row">
                    <Mic size={18} strokeWidth={2} aria-hidden />
                    <select
                      value={audioDeviceId}
                      onChange={(e) => setAudioDeviceId(e.target.value)}
                      aria-label="Микрофон"
                    >
                      {audioDevices.length === 0 && <option value="">Микрофон по умолчанию</option>}
                      {audioDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || 'Микрофон'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {(isGuestMode || authFallbackGuest) && (
                  <div className="voice-room-prejoin__field">
                    <label htmlFor="voice-prejoin-name">Ваше имя</label>
                    <input
                      id="voice-prejoin-name"
                      value={guestDisplayName}
                      onChange={(e) => setGuestDisplayName(e.target.value)}
                      placeholder="Как вас представить в комнате"
                      autoComplete="name"
                    />
                  </div>
                )}

                {!isGuestMode && (
                  <div className="voice-room-prejoin__field">
                    <label>Вы входите как</label>
                    <input value={displayNameForPreview} readOnly />
                  </div>
                )}

                <p className="voice-room-prejoin__trust">
                  Встреча проходит на платформе JungAI, без сторонних сервисов. Камеру и микрофон
                  можно выключить в любой момент.
                </p>

                {reconnectHint && <div className="voice-room-prejoin__hint">{reconnectHint}</div>}
                {error && <div className="voice-room-prejoin__error">{error}</div>}
                {guestForced && token && user?.email && (
                  <div className="voice-room-prejoin__trust" style={{ textAlign: 'left' }}>
                    Вы вошли как <b>{user.email}</b>, но по этой ссылке вход выполняется как гость —
                    аккаунт не используется.
                  </div>
                )}

                <div className="voice-room-prejoin__actions">
                  <button
                    type="button"
                    className="voice-room-prejoin__join"
                    disabled={joining || (isGuestMode && !guestDisplayName.trim())}
                    onClick={() => void handleJoin({ camera: preCameraOn, mic: preMicOn })}
                  >
                    <Video size={18} strokeWidth={2} aria-hidden />
                    {joining ? 'Подключение…' : 'Подключиться'}
                  </button>
                  <button
                    type="button"
                    className="voice-room-prejoin__no-cam"
                    disabled={joining || (isGuestMode && !guestDisplayName.trim())}
                    onClick={() => {
                      setPreCameraOn(false);
                      void handleJoin({ camera: false, mic: preMicOn });
                    }}
                  >
                    Без камеры
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <LiveKitRoom
              room={lkRoom ?? undefined}
              token={livekitToken}
              serverUrl={livekitUrl}
              connect={joined && !!livekitToken}
              video={joinWithCamera}
              audio={joinWithMic}
              options={STABLE_ROOM_OPTIONS}
              connectOptions={STABLE_CONNECT_OPTIONS}
              onConnected={() => {
                reconnectAttemptsRef.current = 0;
                setReconnecting(false);
                setReconnectHint(null);
              }}
              onDisconnected={stableOnDisconnected}
              onError={stableOnError}
              style={{ height: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
            >
              {reconnecting && (
                <div
                  style={{
                    position: 'absolute',
                    zIndex: 40,
                    top: 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '8px 14px',
                    borderRadius: 10,
                    background: 'rgba(15, 18, 28, 0.88)',
                    color: '#fff',
                    fontSize: 13,
                    pointerEvents: 'none',
                  }}
                >
                  {reconnectHint || 'Переподключение…'}
                </div>
              )}
              <LiveKitConferenceRu
                eventType={event.type}
                eventTitle={event.title}
                eventStartsAt={event.startsAt}
                eventEndsAt={event.endsAt}
                roomId={roomId!}
                onLeave={handleLeave}
                selfDisplayName={
                  isGuestMode
                    ? (guestDisplayName.trim() || joinedAsName || undefined)
                    : (profile?.name || user?.name || joinedAsName || user?.email || undefined)
                }
                selfAvatarUrl={isGuestMode ? null : resolvePublicFileUrl(profile?.avatarUrl || user?.avatarUrl)}
              />
              <RoomAudioRenderer />
            </LiveKitRoom>
          </div>
        )}
      </div>
    </div>
  );
}
