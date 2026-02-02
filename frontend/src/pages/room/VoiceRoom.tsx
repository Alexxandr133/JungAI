import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

interface EventData {
  id: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  type: string;
}

export default function VoiceRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!roomId || !token) {
      setError('Room ID or authentication token missing');
      setLoading(false);
      return;
    }

    loadEventData();
  }, [roomId, token]);

  async function loadEventData() {
    try {
      const res = await api<{ event: EventData; voiceRoom: any }>(`/api/events/by-room/${roomId}`, { token: token ?? undefined });
      setEvent(res.event);
      setLoading(false);
      
      // Имитируем подключение других участников
      setTimeout(() => {
        setParticipants([
          { id: '1', name: user?.email || 'Вы' },
          { id: '2', name: 'Психолог' }
        ]);
        setJoined(true);
      }, 1000);
    } catch (e: any) {
      console.error('Failed to load room data:', e);
      setError(e.message || 'Не удалось загрузить данные комнаты');
      setLoading(false);
    }
  }

  function handleJoin() {
    setJoined(true);
    setParticipants([
      { id: '1', name: user?.email || 'Вы' },
      { id: '2', name: 'Психолог' }
    ]);
  }

  function toggleVideo() {
    setIsVideoEnabled(!isVideoEnabled);
  }

  function toggleAudio() {
    setIsAudioEnabled(!isAudioEnabled);
  }

  function handleLeave() {
    setJoined(false);
    setParticipants([]);
    navigate('/events');
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0b0f1a', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div>Загрузка комнаты...</div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0b0f1a', color: '#fff' }}>
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>⚠️</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Ошибка</div>
          <div style={{ color: '#888', marginBottom: 24 }}>{error || 'Комната не найдена'}</div>
          <button className="button" onClick={() => navigate('/events')} style={{ padding: '12px 24px' }}>
            Вернуться к событиям
          </button>
        </div>
      </div>
    );
  }

  const totalParticipants = participants.length;
  const gridCols = totalParticipants <= 1 ? 1 : totalParticipants <= 4 ? 2 : totalParticipants <= 9 ? 3 : 4;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0b0f1a', color: '#fff' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{event.title}</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            {joined ? `Участников: ${totalParticipants}` : 'Подготовка к подключению...'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {event.type === 'session' && (
            <span style={{ padding: '4px 12px', background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', borderRadius: 999, fontSize: 12 }}>
              Сессия
            </span>
          )}
        </div>
      </div>

      {/* Video Grid */}
      <div style={{ flex: 1, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        {!joined ? (
          <div style={{ textAlign: 'center', maxWidth: 500 }}>
            <div style={{ fontSize: 64, marginBottom: 24 }}>🎤</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Готовы присоединиться?</div>
            <div style={{ color: '#888', marginBottom: 32, fontSize: 16 }}>
              Нажмите кнопку ниже, чтобы подключиться к встрече
            </div>
            <button 
              className="button" 
              onClick={handleJoin}
              style={{ 
                padding: '16px 32px', 
                fontSize: 18, 
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
                borderRadius: 12,
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ▶ Присоединиться к встрече
            </button>
          </div>
        ) : (
          <div 
            style={{ 
              width: '100%', 
              maxWidth: '1600px',
              height: '100%',
              display: 'grid',
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              gap: 16,
              alignContent: 'center'
            }}
          >
            {participants.map((participant, index) => (
              <div
                key={participant.id}
                style={{
                  aspectRatio: '16/9',
                  background: isVideoEnabled && index === 0 ? 'linear-gradient(135deg, #1e293b, #334155)' : 'linear-gradient(135deg, #1e293b, #334155)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  position: 'relative',
                  border: index === 0 ? '2px solid rgba(59, 130, 246, 0.5)' : '2px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {/* Placeholder для видео */}
                <div style={{ 
                  width: '100%', 
                  height: '100%', 
                  display: 'grid', 
                  placeItems: 'center',
                  background: 'linear-gradient(135deg, #1e293b, #334155)'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                      fontSize: 72, 
                      marginBottom: 16,
                      width: 120,
                      height: 120,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      display: 'grid',
                      placeItems: 'center',
                      margin: '0 auto 16px',
                      color: '#fff',
                      fontWeight: 700
                    }}>
                      {participant.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{participant.name}</div>
                    <div style={{ fontSize: 14, color: '#888' }}>
                      {index === 0 && !isVideoEnabled && 'Камера выключена'}
                      {index === 0 && !isAudioEnabled && '🔇 Микрофон выключен'}
                    </div>
                  </div>
                </div>

                {/* Индикатор статуса */}
                <div style={{ 
                  position: 'absolute', 
                  bottom: 12, 
                  left: 12, 
                  padding: '6px 12px', 
                  background: 'rgba(0,0,0,0.8)', 
                  borderRadius: 8, 
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  backdropFilter: 'blur(10px)'
                }}>
                  <div style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    background: '#10b981',
                    boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)'
                  }}></div>
                  <span>{participant.name}</span>
                  {index === 0 && !isAudioEnabled && <span>🔇</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ 
        padding: 24, 
        borderTop: '1px solid rgba(255,255,255,0.1)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: 12,
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(10px)'
      }}>
        {!joined ? (
          <button 
            className="button" 
            onClick={handleJoin}
            style={{ 
              padding: '14px 28px', 
              fontSize: 16, 
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
              borderRadius: 12,
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            ▶ Присоединиться к встрече
          </button>
        ) : (
          <>
            <button
              className="button"
              onClick={toggleAudio}
              style={{
                padding: '12px 24px',
                fontSize: 16,
                borderRadius: 999,
                background: isAudioEnabled ? 'rgba(255,255,255,0.1)' : '#ef4444',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s',
                fontWeight: 500
              }}
              onMouseOver={(e) => {
                if (isAudioEnabled) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                }
              }}
              onMouseOut={(e) => {
                if (isAudioEnabled) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }
              }}
            >
              <span style={{ fontSize: 20 }}>{isAudioEnabled ? '🎤' : '🔇'}</span>
              <span>{isAudioEnabled ? 'Микрофон' : 'Выключен'}</span>
            </button>
            
            <button
              className="button"
              onClick={toggleVideo}
              style={{
                padding: '12px 24px',
                fontSize: 16,
                borderRadius: 999,
                background: isVideoEnabled ? 'rgba(255,255,255,0.1)' : '#ef4444',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s',
                fontWeight: 500
              }}
              onMouseOver={(e) => {
                if (isVideoEnabled) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                }
              }}
              onMouseOut={(e) => {
                if (isVideoEnabled) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }
              }}
            >
              <span style={{ fontSize: 20 }}>{isVideoEnabled ? '📹' : '📹🚫'}</span>
              <span>{isVideoEnabled ? 'Камера' : 'Выключена'}</span>
            </button>
            
            <button
              className="button danger"
              onClick={handleLeave}
              style={{
                padding: '12px 28px',
                fontSize: 16,
                borderRadius: 999,
                background: '#ef4444',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#dc2626';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#ef4444';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Покинуть встречу
            </button>
          </>
        )}
      </div>
    </div>
  );
}