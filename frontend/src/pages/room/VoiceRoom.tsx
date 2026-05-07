import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAppearance } from '../../context/AppearanceContext';
import { api, getApiBaseUrl } from '../../lib/api';
import '@livekit/components-styles';
import './VoiceRoom.css';
import {
  DisconnectButton,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  type TrackReferenceOrPlaceholder,
  useAudioPlayback,
  useChat,
  useParticipants,
  useTracks
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { PlatformIcon } from '../../components/icons';
import { CalendarClock, PhoneOff, SendHorizontal, Video } from 'lucide-react';

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

function LiveKitConferenceRu({ onLeave }: { onLeave: () => void }) {
  const { appearance } = useAppearance();
  const isLight = appearance.colorMode === 'light';
  const [sidebarMode, setSidebarMode] = useState<'chat' | 'participants' | null>(null);
  const [chatText, setChatText] = useState('');
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const participantMetaCacheRef = useRef<Record<string, { avatarUrl: string; displayName: string }>>({});
  const { chatMessages, send, isSending } = useChat();
  const participants = useParticipants();
  const { canPlayAudio, startAudio } = useAudioPlayback();
  const cameraTracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true }
    ],
    { onlySubscribed: false }
  );
  const screenTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });

  async function submitChat(e: FormEvent) {
    e.preventDefault();
    const text = chatText.trim();
    if (!text) return;
    await send(text);
    setChatText('');
    if (chatInputRef.current) {
      chatInputRef.current.style.height = '40px';
    }
  }

  const panelBg = isLight ? 'rgba(226,232,240,0.94)' : 'rgba(3,7,18,0.55)';
  const mobileSolidPanel = isLight ? '#e2e8f0' : '#0f172a';
  const chatInputSolid = isLight ? '#ffffff' : '#1e293b';
  const participantRowSolid = isLight ? '#f8fafc' : '#1e293b';
  const panelStrong = isLight ? '#cbd5e1' : 'rgba(15,23,42,0.72)';
  const border = isLight ? '1px solid rgba(15,23,42,0.22)' : '1px solid rgba(255,255,255,0.1)';
  const softText = isLight ? '#475569' : '#94a3b8';
  const mainText = isLight ? '#0f172a' : '#e5e7eb';
  const controlOffBg = isLight ? '#ffffff' : 'rgba(255,255,255,0.12)';
  const controlOnBg = '#2563eb';
  const hasScreenShare = screenTracks.length > 0;
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 900 : false));

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= 900);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const uniqueCameraTracks = (() => {
    const byIdentity = new Map<string, TrackReferenceOrPlaceholder>();
    for (const tr of cameraTracks) {
      const id = tr.participant.identity;
      if (!byIdentity.has(id)) byIdentity.set(id, tr);
    }
    return Array.from(byIdentity.values());
  })();

  const maxTiles = 9;
  const visibleCameraTracks = uniqueCameraTracks.slice(0, maxTiles);
  const extraParticipants = participants.length > maxTiles ? participants.slice(maxTiles) : [];

  const getParticipantMeta = (p: any) => {
    let avatarUrl = '';
    let displayName = p.name || p.identity || 'Участник';
    try {
      const meta = p.metadata ? JSON.parse(p.metadata) : null;
      avatarUrl = meta?.avatarUrl || '';
      displayName = meta?.displayName || displayName;
    } catch {
      // ignore invalid metadata
    }
    if (avatarUrl && avatarUrl.startsWith('/')) {
      avatarUrl = `${getApiBaseUrl()}${avatarUrl}`;
    }
    const cached = participantMetaCacheRef.current[p.identity || ''];
    const resolvedAvatar = avatarUrl || cached?.avatarUrl || '';
    const resolvedName = displayName || cached?.displayName || 'Участник';
    if (p.identity) {
      participantMetaCacheRef.current[p.identity] = {
        avatarUrl: resolvedAvatar,
        displayName: resolvedName
      };
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

  function renderParticipantMainTile(trackRef: TrackReferenceOrPlaceholder, key: string) {
    const { avatarUrl, displayName } = getParticipantMeta(trackRef.participant);
    const hasVideoTrack = Boolean((trackRef as any)?.publication?.track);
    const speakingHighlight = trackRef.participant.isSpeaking ? '0 0 0 2px rgba(34,197,94,0.95), 0 0 24px rgba(34,197,94,0.45)' : undefined;

    if (hasVideoTrack) {
      return (
        <div key={key} className="voice-room-tile-host" style={{ position: 'relative', height: '100%' }}>
          <ParticipantTile
            trackRef={trackRef}
            style={{ width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden', background: isLight ? '#cbd5e1' : 'linear-gradient(135deg, #111827, #1f2937)', boxShadow: speakingHighlight }}
            title={getConnectionQualityLabel(trackRef.participant)}
          />
          <div style={{ position: 'absolute', left: 8, bottom: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '3px 7px', borderRadius: 999, background: 'rgba(0,0,0,0.45)', color: '#fff' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', background: '#334155', display: 'grid', placeItems: 'center' }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none' as const }}
                />
              ) : <PlatformIcon name="user" size={11} color="#cbd5e1" />}
            </div>
            <span className="small">{displayName}</span>
          </div>
        </div>
      );
    }

    return (
      <div key={key} style={{ borderRadius: 10, overflow: 'hidden', position: 'relative', height: '100%', background: isLight ? '#cbd5e1' : 'linear-gradient(135deg, #111827, #1f2937)', boxShadow: speakingHighlight }}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: isLight ? '#dbeafe' : '#0f172a', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none' as const }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: isLight ? '#475569' : '#94a3b8' }}>
            <PlatformIcon name="user" size={92} />
          </div>
        )}
        <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </div>
      </div>
    );
  }

  const chatOpen = sidebarMode === 'chat';
  const participantsOpen = sidebarMode === 'participants';

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: !isMobile && sidebarMode ? 'minmax(0,1fr) 320px' : 'minmax(0,1fr)', minHeight: 0, position: 'relative', overflow: 'hidden' }}>
      <section style={{ minWidth: 0, minHeight: 0, padding: 12, display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) auto', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: panelBg, border }}>
          <div className="small" style={{ color: softText }}>Участников в комнате: {participants.length}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="button secondary"
              onClick={() => setSidebarMode((m) => (m === 'chat' ? null : 'chat'))}
              style={{ padding: '8px 10px', minWidth: 42, background: chatOpen ? controlOnBg : controlOffBg, color: chatOpen ? '#fff' : mainText, border: isLight ? '1px solid rgba(15,23,42,0.18)' : 'none' }}
              title="Чат"
            >
              <PlatformIcon name="message" size={16} />
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setSidebarMode((m) => (m === 'participants' ? null : 'participants'))}
              style={{ padding: '8px 10px', minWidth: 42, background: participantsOpen ? controlOnBg : controlOffBg, color: participantsOpen ? '#fff' : mainText, border: isLight ? '1px solid rgba(15,23,42,0.18)' : 'none' }}
              title="Участники"
            >
              <PlatformIcon name="users" size={16} />
            </button>
          </div>
          {!canPlayAudio && (
            <button className="button secondary" onClick={() => startAudio()} style={{ padding: '8px 10px' }}>
              Включить звук в браузере
            </button>
          )}
        </div>
        <div style={{ minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0, borderRadius: 12, overflow: 'hidden', border, background: panelStrong, position: 'relative' }}>
            {hasScreenShare ? (
              <div style={{ width: '100%', height: '100%', padding: 10 }}>
                <div className="voice-room-tile-host" style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <ParticipantTile
                    trackRef={screenTracks[0]}
                    style={{ width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden', background: isLight ? '#cbd5e1' : 'linear-gradient(135deg, #111827, #1f2937)' }}
                    title={getConnectionQualityLabel(screenTracks[0].participant)}
                  />
                  {(() => {
                    const { avatarUrl, displayName } = getParticipantMeta(screenTracks[0].participant);
                    return (
                      <div style={{ position: 'absolute', left: 10, bottom: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.45)', color: '#fff' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', background: '#334155', display: 'grid', placeItems: 'center' }}>
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={displayName}
                              draggable={false}
                              onDragStart={(e) => e.preventDefault()}
                              onContextMenu={(e) => e.preventDefault()}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none' as const }}
                            />
                          ) : (
                            <PlatformIcon name="user" size={12} color="#cbd5e1" />
                          )}
                        </div>
                        <span className="small">
                          {displayName}
                          <span style={{ opacity: 0.85 }}> · экран</span>
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'grid',
                  gridTemplateColumns:
                    visibleCameraTracks.length <= 1 ? '1fr' :
                    visibleCameraTracks.length <= 4 ? 'repeat(2, 1fr)' :
                    'repeat(3, 1fr)',
                  gridAutoRows: isMobile ? 'minmax(140px, 1fr)' : 'minmax(180px, 1fr)',
                  gap: 10,
                  padding: 10
                }}
              >
                {visibleCameraTracks.map((trackRef, idx) => renderParticipantMainTile(trackRef, `${trackRef.participant.identity}-${idx}`))}
              </div>
            )}
          </div>
          {sidebarMode && isMobile && (
            <aside
              style={{
                position: 'absolute',
                inset: 6,
                minHeight: 0,
                display: 'grid',
                gridTemplateRows: chatOpen ? 'auto minmax(0,1fr) auto' : 'auto minmax(0,1fr)',
                background: mobileSolidPanel,
                border,
                borderRadius: 12,
                zIndex: 20,
                overflow: 'hidden',
                boxShadow: '0 18px 48px rgba(0,0,0,0.55)'
              }}
            >
              <div style={{ padding: 12, fontWeight: 700, color: mainText, borderBottom: border, background: mobileSolidPanel }}>
                {chatOpen ? 'Чат встречи' : 'Участники'}
              </div>
              {chatOpen ? (
                <>
                  <div style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8, background: mobileSolidPanel }}>
                    {chatMessages.length === 0 && <div className="small" style={{ color: softText }}>Сообщений пока нет</div>}
                    {chatMessages.map((msg: any, i: number) => (
                      <div key={`${msg.timestamp || i}-${i}`} style={{ padding: '2px 0' }}>
                        <div className="small" style={{ color: '#60a5fa', marginBottom: 2 }}>{msg.from?.name || msg.from?.identity || 'Участник'}</div>
                        <div style={{ lineHeight: 1.5, color: mainText, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.message}</div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={submitChat} style={{ padding: 10, borderTop: border, display: 'flex', gap: 8, background: mobileSolidPanel }}>
                    <textarea
                      ref={chatInputRef}
                      value={chatText}
                      onChange={(e) => {
                        setChatText(e.target.value);
                        const el = e.target as HTMLTextAreaElement;
                        el.style.height = '40px';
                        el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
                      }}
                      placeholder="Напишите сообщение..."
                      rows={1}
                      style={{
                        width: '100%',
                        minHeight: 40,
                        maxHeight: 180,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border,
                        background: chatInputSolid,
                        color: mainText,
                        resize: 'none',
                        overflowY: 'auto',
                        overflowX: 'hidden'
                      }}
                    />
                    <button className="button" title="Отправить" aria-label="Отправить" disabled={isSending || !chatText.trim()} style={{ width: 40, height: 40, padding: 0, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <SendHorizontal size={16} />
                    </button>
                  </form>
                </>
              ) : (
                <div style={{ minHeight: 0, overflowY: 'auto', padding: 10, display: 'grid', gap: 8, background: mobileSolidPanel }}>
                  {participants.map((p: any) => {
                    const { avatarUrl, displayName } = getParticipantMeta(p);
                    return (
                      <div
                        key={p.identity}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          border,
                          borderRadius: 6,
                          padding: '3px 6px',
                          background: participantRowSolid
                        }}
                        title={getConnectionQualityLabel(p)}
                      >
                        <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', background: isLight ? '#cbd5e1' : '#334155', display: 'grid', placeItems: 'center', color: mainText, fontSize: 11, fontWeight: 700 }}>
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={displayName}
                              draggable={false}
                              onDragStart={(e) => e.preventDefault()}
                              onContextMenu={(e) => e.preventDefault()}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none' as const }}
                            />
                          ) : (
                            <PlatformIcon name="user" size={11} />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: mainText, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                        </div>
                      </div>
                    );
                  })}
                  {extraParticipants.length > 0 && (
                    <div className="small" style={{ color: softText }}>Еще участников вне основной сетки: {extraParticipants.length}</div>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>
        {isMobile ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, flexWrap: 'nowrap', padding: '6px 4px' }}>
            <TrackToggle
              source={Track.Source.Microphone}
              showIcon
              className="button"
              title="Микрофон"
              aria-label="Микрофон"
              style={{
                background: controlOffBg,
                color: mainText,
                border: isLight ? '1px solid rgba(15,23,42,0.18)' : 'none',
                borderRadius: '50%',
                width: 52,
                height: 52,
                padding: 0,
                display: 'grid',
                placeItems: 'center',
                boxShadow: isLight ? '0 2px 8px rgba(15,23,42,0.08)' : '0 2px 10px rgba(0,0,0,0.35)'
              }}
            />
            <TrackToggle
              source={Track.Source.Camera}
              showIcon
              className="button"
              title="Камера"
              aria-label="Камера"
              style={{
                background: controlOffBg,
                color: mainText,
                border: isLight ? '1px solid rgba(15,23,42,0.18)' : 'none',
                borderRadius: '50%',
                width: 52,
                height: 52,
                padding: 0,
                display: 'grid',
                placeItems: 'center',
                boxShadow: isLight ? '0 2px 8px rgba(15,23,42,0.08)' : '0 2px 10px rgba(0,0,0,0.35)'
              }}
            />
            <TrackToggle
              source={Track.Source.ScreenShare}
              showIcon
              className="button"
              title="Экран"
              aria-label="Экран"
              style={{
                background: controlOnBg,
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                minWidth: 64,
                height: 52,
                padding: '4px 10px',
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1,
                boxShadow: '0 2px 10px rgba(37,99,235,0.45)'
              }}
            >
              Экран
            </TrackToggle>
            <DisconnectButton
              className="button danger"
              title="Покинуть встречу"
              aria-label="Покинуть встречу"
              style={{
                borderRadius: '50%',
                width: 52,
                height: 52,
                padding: 0,
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 2px 10px rgba(220,38,38,0.35)',
                marginLeft: 0
              }}
              onClick={onLeave}
            >
              <PhoneOff size={22} strokeWidth={2.25} />
            </DisconnectButton>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <TrackToggle
              source={Track.Source.Microphone}
              showIcon
              className="button"
              style={{ background: controlOffBg, color: mainText, border: isLight ? '1px solid rgba(15,23,42,0.18)' : 'none', borderRadius: 999, padding: '10px 14px', boxShadow: isLight ? '0 3px 10px rgba(15,23,42,0.12)' : '0 2px 10px rgba(0,0,0,0.35)' }}
            >
              Микрофон
            </TrackToggle>
            <TrackToggle
              source={Track.Source.Camera}
              showIcon
              className="button"
              style={{ background: controlOffBg, color: mainText, border: isLight ? '1px solid rgba(15,23,42,0.18)' : 'none', borderRadius: 999, padding: '10px 14px', boxShadow: isLight ? '0 3px 10px rgba(15,23,42,0.12)' : '0 2px 10px rgba(0,0,0,0.35)' }}
            >
              Камера
            </TrackToggle>
            <TrackToggle
              source={Track.Source.ScreenShare}
              showIcon
              className="button"
              style={{ background: controlOnBg, color: '#fff', border: 'none', borderRadius: 999, padding: '10px 14px', boxShadow: '0 2px 10px rgba(37,99,235,0.45)' }}
            >
              Экран
            </TrackToggle>
            <DisconnectButton
              className="button danger"
              style={{ marginLeft: 'auto', borderRadius: 999, padding: '10px 16px', boxShadow: '0 2px 10px rgba(220,38,38,0.35)' }}
              onClick={onLeave}
            >
              Покинуть встречу
            </DisconnectButton>
          </div>
        )}
      </section>
      {sidebarMode && !isMobile && (
        <aside
          style={{
            borderLeft: border,
            minHeight: 0,
            display: 'grid',
            gridTemplateRows: chatOpen ? 'auto minmax(0,1fr) auto' : 'auto minmax(0,1fr)',
            background: panelBg
          }}
        >
          <div style={{ padding: 12, fontWeight: 700, color: mainText, borderBottom: border }}>
            {chatOpen ? 'Чат встречи' : 'Участники'}
          </div>
          {chatOpen ? (
            <>
              <div style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {chatMessages.length === 0 && <div className="small" style={{ color: softText }}>Сообщений пока нет</div>}
                {chatMessages.map((msg: any, i: number) => (
                  <div key={`${msg.timestamp || i}-${i}`} style={{ padding: '2px 0' }}>
                    <div className="small" style={{ color: '#60a5fa', marginBottom: 2 }}>{msg.from?.name || msg.from?.identity || 'Участник'}</div>
                    <div style={{ lineHeight: 1.5, color: mainText, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.message}</div>
                  </div>
                ))}
              </div>
              <form onSubmit={submitChat} style={{ padding: 10, borderTop: border, display: 'flex', gap: 8 }}>
                <textarea
                  ref={chatInputRef}
                  value={chatText}
                  onChange={(e) => {
                    setChatText(e.target.value);
                    const el = e.target as HTMLTextAreaElement;
                    el.style.height = '40px';
                    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
                  }}
                  placeholder="Напишите сообщение..."
                  rows={1}
                  style={{
                    width: '100%',
                    minHeight: 40,
                    maxHeight: 180,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border,
                    background: isLight ? '#fff' : 'rgba(15,23,42,0.85)',
                    color: mainText,
                    resize: 'none',
                    overflowY: 'auto',
                    overflowX: 'hidden'
                  }}
                />
                <button className="button" title="Отправить" aria-label="Отправить" disabled={isSending || !chatText.trim()} style={{ width: 40, height: 40, padding: 0, display: 'grid', placeItems: 'center' }}>
                  <SendHorizontal size={16} />
                </button>
              </form>
            </>
          ) : (
            <div style={{ minHeight: 0, overflowY: 'auto', padding: 10, display: 'grid', gap: 8 }}>
              {participants.map((p: any) => {
                const { avatarUrl, displayName } = getParticipantMeta(p);
                return (
                  <div
                    key={p.identity}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      border,
                      borderRadius: 6,
                      padding: '3px 6px',
                      background: isLight ? '#fff' : 'rgba(15,23,42,0.75)'
                    }}
                    title={getConnectionQualityLabel(p)}
                  >
                    <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', background: isLight ? '#cbd5e1' : '#334155', display: 'grid', placeItems: 'center', color: mainText, fontSize: 11, fontWeight: 700 }}>
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={displayName}
                          draggable={false}
                          onDragStart={(e) => e.preventDefault()}
                          onContextMenu={(e) => e.preventDefault()}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none' as const }}
                        />
                      ) : (
                        <PlatformIcon name="user" size={11} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: mainText, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                    </div>
                  </div>
                );
              })}
              {extraParticipants.length > 0 && (
                <div className="small" style={{ color: softText }}>Еще участников вне основной сетки: {extraParticipants.length}</div>
              )}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

export default function VoiceRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const { token, user } = useAuth();
  const { appearance } = useAppearance();
  const navigate = useNavigate();
  const isLight = appearance.colorMode === 'light';
  
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [livekitToken, setLivekitToken] = useState<string>('');
  const [livekitUrl, setLivekitUrl] = useState<string>('');
  const [guestDisplayName, setGuestDisplayName] = useState('');
  const isGuestMode = !token;

  useEffect(() => {
    if (!roomId) {
      setError('Room ID missing');
      setLoading(false);
      return;
    }

    loadEventData();
  }, [roomId, token]);

  async function loadEventData() {
    try {
      const endpoint = token ? `/api/events/by-room/${roomId}` : `/api/events/public-room/${roomId}`;
      const res = await api<{ event: EventData; voiceRoom: any }>(endpoint, { token: token ?? undefined });
      setEvent(res.event);
      setLoading(false);
      
    } catch (e: any) {
      console.error('Failed to load room data:', e);
      setError(e.message || 'Не удалось загрузить данные комнаты');
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!roomId) return;
    if (!token && !guestDisplayName.trim()) {
      setError('Введите имя для входа в комнату');
      return;
    }
    try {
      const res = token
        ? await api<LiveKitTokenResponse>(`/api/events/room/${roomId}/livekit-token`, { token })
        : await api<LiveKitTokenResponse>(`/api/events/room/${roomId}/guest-livekit-token`, {
            method: 'POST',
            body: { displayName: guestDisplayName.trim() }
          });
      setLivekitToken(res.token);
      setLivekitUrl(res.url);
      setJoined(true);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Не удалось подключиться к видеокомнате');
    }
  }

  function handleLeave() {
    setJoined(false);
    setLivekitToken('');
    if (isGuestMode) {
      navigate('/');
      return;
    }
    if (user?.role === 'client') {
      navigate('/client/sessions');
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
          <button className="button" onClick={() => navigate(token ? '/events' : '/')} style={{ padding: '12px 24px' }}>
            Вернуться к событиям
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: isLight ? 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)' : '#0b0f1a', color: isLight ? '#0f172a' : '#fff', overflow: 'hidden' }}>
      {/* Header */}
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
              {isGuestMode && (
                <div style={{ marginTop: 14 }}>
                  <label className="small" style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)' }}>Как вас записать в комнате</label>
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
          <div style={{ width: '100%', minHeight: 0 }}>
            <LiveKitRoom
              token={livekitToken}
              serverUrl={livekitUrl}
              connect={joined}
              video={false}
              audio={false}
              onDisconnected={handleLeave}
              style={{ height: '100%' }}
            >
              <LiveKitConferenceRu onLeave={handleLeave} />
              <RoomAudioRenderer />
            </LiveKitRoom>
          </div>
        )}
      </div>

    </div>
  );
}