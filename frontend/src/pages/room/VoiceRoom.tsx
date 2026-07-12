import { type CSSProperties, type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAppearance } from '../../context/AppearanceContext';
import { api, getApiBaseUrl, resolvePublicFileUrl } from '../../lib/api';
import '@livekit/components-styles';
import './VoiceRoom.css';
import {
  DisconnectButton,
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
import { CalendarClock, Check, MessageSquare, Mic, MicOff, MonitorUp, MoreHorizontal, Paperclip, PhoneOff, SendHorizontal, Users, Video, VideoOff } from 'lucide-react';

interface EventData {
  id: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  type: string;
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

function LiveKitConferenceRu({ eventType, eventTitle, eventStartsAt, eventEndsAt, roomId, selfDisplayName, selfAvatarUrl }: ConferenceProps) {
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
            <DisconnectButton className="voice-room-ctrl-btn voice-room-ctrl-btn--hangup" title="Покинуть встречу" aria-label="Покинуть встречу">
              <PhoneOff size={22} strokeWidth={2.25} />
            </DisconnectButton>
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
  const { appearance } = useAppearance();
  const navigate = useNavigate();
  const isLight = appearance.colorMode === 'light';

  const guestForced = searchParams.get('guest') === '1';
  const [authFallbackGuest, setAuthFallbackGuest] = useState(false);
  const isGuestMode = guestForced || !token || authFallbackGuest;
  const roomApiToken = isGuestMode ? undefined : (token ?? undefined);
  
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [livekitToken, setLivekitToken] = useState<string>('');
  const [livekitUrl, setLivekitUrl] = useState<string>('');
  const [guestDisplayName, setGuestDisplayName] = useState('');
  const [joinedAsName, setJoinedAsName] = useState('');
  const [reconnectHint, setReconnectHint] = useState<string | null>(null);

  const loadEventData = useCallback(async () => {
    if (!roomId) return;
    try {
      setLoading(true);
      if (!guestForced && token) {
        try {
          const res = await api<{ event: EventData; voiceRoom: any }>(`/api/events/by-room/${roomId}`, {
            token,
            suppressSessionExpired: true,
          });
          setEvent(res.event);
          setAuthFallbackGuest(false);
          setError(null);
          return;
        } catch (e: any) {
          if (e?.status !== 401) throw e;
          setAuthFallbackGuest(true);
        }
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
  }, [roomId, guestForced, token]);

  useEffect(() => {
    if (!roomId) {
      setError('Room ID missing');
      setLoading(false);
      return;
    }

    void loadEventData();
  }, [roomId, loadEventData]);

  async function handleJoin() {
    if (!roomId) return;
    if (isGuestMode && !guestDisplayName.trim()) {
      setError('Введите имя для входа в комнату');
      return;
    }
    try {
      let res: LiveKitTokenResponse;
      if (isGuestMode) {
        res = await api<LiveKitTokenResponse>(`/api/events/room/${roomId}/guest-livekit-token`, {
          method: 'POST',
          body: { displayName: guestDisplayName.trim() },
        });
      } else {
        try {
          res = await api<LiveKitTokenResponse>(`/api/events/room/${roomId}/livekit-token`, {
            token: roomApiToken,
            suppressSessionExpired: true,
          });
        } catch (e: any) {
          if (e?.status !== 401) throw e;
          setAuthFallbackGuest(true);
          if (!guestDisplayName.trim()) {
            setError('Сессия истекла. Введите имя и присоединитесь как гость.');
            return;
          }
          res = await api<LiveKitTokenResponse>(`/api/events/room/${roomId}/guest-livekit-token`, {
            method: 'POST',
            body: { displayName: guestDisplayName.trim() },
          });
        }
      }
      setLivekitToken(res.token);
      setLivekitUrl(res.url);
      setJoinedAsName(res.name || '');
      setJoined(true);
      setReconnectHint(null);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Не удалось подключиться к видеокомнате');
    }
  }

  function handleLeave() {
    setJoined(false);
    setLivekitToken('');
    setReconnectHint(null);
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

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: isLight ? '#f8fafc' : '#0b0f1a', color: isLight ? '#0f172a' : '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div>Загрузка комнаты...</div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: isLight ? '#f8fafc' : '#0b0f1a', color: isLight ? '#0f172a' : '#fff' }}>
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>⚠️</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Ошибка</div>
          <div style={{ color: '#888', marginBottom: 24 }}>{error || 'Комната не найдена'}</div>
          <button className="button" onClick={() => navigate(isGuestMode ? '/' : user?.role === 'researcher' ? '/researcher/calls' : '/events')} style={{ padding: '12px 24px' }}>
            {isGuestMode ? 'На главную' : 'Вернуться к событиям'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: joined ? '#121212' : (isLight ? 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)' : '#0b0f1a'), color: joined ? '#f5f5f5' : (isLight ? '#0f172a' : '#fff'), overflow: 'hidden' }}>
      {!joined && (
      <div style={{ padding: '16px 24px', borderBottom: isLight ? '1px solid rgba(15,23,42,0.12)' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{event.title}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {event.type === 'session' && (
            <span style={{ padding: '4px 12px', background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', borderRadius: 999, fontSize: 12 }}>
              Сессия
            </span>
          )}
        </div>
      </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {!joined ? (
          <div style={{ width: 'min(720px, 94vw)', margin: 'auto', padding: 24 }}>
            <div className="card" style={{ borderRadius: 20, padding: 24, border: isLight ? '1px solid rgba(15,23,42,0.2)' : '1px solid rgba(255,255,255,0.1)', background: isLight ? 'rgba(248,250,252,0.98)' : 'rgba(15,23,42,0.6)', boxShadow: isLight ? '0 24px 56px rgba(15,23,42,0.16)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: isLight ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.22)', display: 'grid', placeItems: 'center', color: '#3b82f6' }}>
                  <Video size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>Готовы присоединиться?</div>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>Проверьте детали встречи и нажмите кнопку входа</div>
                </div>
              </div>
              <div style={{ marginTop: 14, borderRadius: 12, padding: 14, background: isLight ? '#ffffff' : 'rgba(2,6,23,0.55)', border: isLight ? '1px solid rgba(15,23,42,0.16)' : '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{event.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: isLight ? '#334155' : 'var(--text-muted)', marginBottom: event.description ? 8 : 0 }}>
                  <CalendarClock size={15} />
                  {new Date(event.startsAt).toLocaleString('ru-RU', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </div>
                {event.description && (
                  <div className="small" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{event.description}</div>
                )}
              </div>
              {reconnectHint && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 12,
                    border: isLight ? '1px solid rgba(234,179,8,0.45)' : '1px solid rgba(234,179,8,0.35)',
                    background: isLight ? 'rgba(254,252,232,0.95)' : 'rgba(66,32,6,0.55)',
                    color: isLight ? '#713f12' : '#fde68a',
                    fontSize: 14,
                    lineHeight: 1.45
                  }}
                >
                  {reconnectHint}
                </div>
              )}
              {guestForced && token && user?.email && (
                <div
                  className="small"
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 12,
                    border: isLight ? '1px solid rgba(59,130,246,0.35)' : '1px solid rgba(59,130,246,0.4)',
                    background: isLight ? 'rgba(239,246,255,0.95)' : 'rgba(30,58,138,0.35)',
                    color: isLight ? '#1e3a8a' : '#bfdbfe',
                    lineHeight: 1.45,
                  }}
                >
                  Вы вошли как <b>{user.email}</b>, но по этой ссылке вход выполняется как гость — аккаунт не используется.
                </div>
              )}
              {isGuestMode && (
                <div style={{ marginTop: 14 }}>
                  <label className="small" style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)' }}>
                    {authFallbackGuest && token ? 'Сессия истекла — войдите как гость' : 'Как вас записать в комнате'}
                  </label>
                  <input
                    value={guestDisplayName}
                    onChange={(e) => setGuestDisplayName(e.target.value)}
                    placeholder="Введите ваше имя"
                    style={{ width: '100%', padding: '12px 12px', borderRadius: 10, border: isLight ? '1px solid rgba(15,23,42,0.18)' : '1px solid rgba(255,255,255,0.16)', background: isLight ? '#fff' : 'rgba(15,23,42,0.7)', color: 'inherit' }}
                  />
                </div>
              )}
              <div style={{ marginTop: 20 }}>
                <button
                  className="button"
                  onClick={handleJoin}
                  style={{
                    width: '100%',
                    padding: '14px 22px',
                    fontSize: 16,
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    borderRadius: 12,
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                >
                  <Video size={18} />
                  Присоединиться к встрече
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <LiveKitRoom
              token={livekitToken}
              serverUrl={livekitUrl}
              connect={joined}
              video={false}
              audio={false}
              options={{ disconnectOnPageLeave: false, adaptiveStream: true, dynacast: true }}
              onDisconnected={(reason) => {
                if (reason === DisconnectReason.CLIENT_INITIATED) {
                  handleLeave();
                  return;
                }
                setJoined(false);
                setLivekitToken('');
                setReconnectHint('Связь с комнатой прервалась. Нажмите «Присоединиться к встрече» ещё раз.');
              }}
              style={{ height: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
            >
              <LiveKitConferenceRu
                eventType={event.type}
                eventTitle={event.title}
                eventStartsAt={event.startsAt}
                eventEndsAt={event.endsAt}
                roomId={roomId!}
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