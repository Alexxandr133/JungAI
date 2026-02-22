import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ClientNavbar } from '../../components/ClientNavbar';
import '../../styles/tokens.css';

export default function ClientWorkspace() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [dreams, setDreams] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [rank] = useState({ level: 1, title: 'Начинающий Герой', progress: 45 });
  const [dailyStreak, setDailyStreak] = useState(0);
  const [hasPsychologist, setHasPsychologist] = useState<boolean | null>(null);
  const [, setPsychologist] = useState<any>(null);

  // Загружаем историю чата из localStorage при монтировании
  useEffect(() => {
    const savedChat = localStorage.getItem('client_chat_history');
    if (savedChat) {
      try {
        const parsed = JSON.parse(savedChat);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChatMessages(parsed);
        }
      } catch (e) {
        console.error('Failed to parse saved chat history:', e);
      }
    }
  }, []);

  // Сохраняем историю чата в localStorage при каждом изменении
  useEffect(() => {
    if (chatMessages.length > 0) {
      localStorage.setItem('client_chat_history', JSON.stringify(chatMessages));
    }
  }, [chatMessages]);


  // Проверяем наличие психолога
  useEffect(() => {
    (async () => {
      if (!token) {
        setHasPsychologist(null);
        return;
      }
      try {
        const psych = await api<any>('/api/my-psychologist', { token });
        setPsychologist(psych);
        setHasPsychologist(true);
      } catch {
        setHasPsychologist(false);
        setPsychologist(null);
      }
    })();
  }, [token]);

  useEffect(() => {
    (async () => {
      if (!token) {
        setDreams([
          { id: 'd1', title: 'Лечу над горящим городом', createdAt: new Date().toISOString() },
          { id: 'd2', title: 'Красная дверь и коридор', createdAt: new Date().toISOString() }
        ]);
        setTasks([
          { id: 't1', title: 'Запишите сегодняшний сон', completed: false, type: 'dream' },
          { id: 't2', title: 'Подумайте о тени', completed: false, type: 'reflection' }
        ]);
        setDailyStreak(0);
        return;
      }
      try { 
        const d = await api<{ items: any[]; total: number }>('/api/dreams', { token }); 
        setDreams(d.items.slice(0, 5));
        
        // Подсчет серии дней на основе активности
        // Получаем все сны и записи дневника
        const [dreamsRes, journalRes] = await Promise.all([
          api<{ items: any[] }>('/api/dreams', { token }).catch(() => ({ items: [] })),
          api<{ items: any[] }>('/api/journal/entries', { token }).catch(() => ({ items: [] }))
        ]);
        
        // Объединяем все активности (сны и записи дневника)
        const allActivities: Date[] = [];
        
        // Добавляем даты снов
        if (dreamsRes.items) {
          dreamsRes.items.forEach((dream: any) => {
            if (dream.createdAt) {
              allActivities.push(new Date(dream.createdAt));
            }
          });
        }
        
        // Добавляем даты записей дневника
        if (journalRes.items) {
          journalRes.items.forEach((entry: any) => {
            if (entry.createdAt) {
              allActivities.push(new Date(entry.createdAt));
            }
          });
        }
        
        // Подсчитываем серию дней
        if (allActivities.length === 0) {
          setDailyStreak(0);
        } else {
          // Сортируем по дате (от новых к старым)
          allActivities.sort((a, b) => b.getTime() - a.getTime());
          
          // Нормализуем даты (убираем время, оставляем только день)
          const normalizedDates = allActivities.map(date => {
            const normalized = new Date(date);
            normalized.setHours(0, 0, 0, 0);
            return normalized.getTime();
          });
          
          // Убираем дубликаты (несколько активностей в один день)
          const uniqueDates = Array.from(new Set(normalizedDates)).sort((a, b) => b - a);
          
          // Подсчитываем последовательные дни
          let streak = 0;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayTime = today.getTime();
          
          // Проверяем, была ли активность сегодня
          if (uniqueDates[0] === todayTime) {
            streak = 1;
            // Проверяем предыдущие дни
            for (let i = 1; i < uniqueDates.length; i++) {
              const expectedDate = new Date(today);
              expectedDate.setDate(expectedDate.getDate() - i);
              expectedDate.setHours(0, 0, 0, 0);
              const expectedTime = expectedDate.getTime();
              
              if (uniqueDates[i] === expectedTime) {
                streak++;
              } else {
                break;
              }
            }
          } else if (uniqueDates.length > 0) {
            // Если сегодня активности не было, проверяем вчерашний день
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayTime = yesterday.getTime();
            
            if (uniqueDates[0] === yesterdayTime) {
              streak = 1;
              // Проверяем предыдущие дни
              for (let i = 1; i < uniqueDates.length; i++) {
                const expectedDate = new Date(yesterday);
                expectedDate.setDate(expectedDate.getDate() - i);
                expectedDate.setHours(0, 0, 0, 0);
                const expectedTime = expectedDate.getTime();
                
                if (uniqueDates[i] === expectedTime) {
                  streak++;
                } else {
                  break;
                }
              }
            }
          }
          
          setDailyStreak(streak);
        }
      } catch {}
      // TODO: загрузка задач от ИИ
      setTasks([
        { id: 't1', title: 'Запишите сегодняшний сон', completed: false, type: 'dream' },
        { id: 't2', title: 'Подумайте о тени', completed: false, type: 'reflection' }
      ]);
    })();
  }, [token]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault(); 
    if (!query.trim()) return; 
    navigate(`/client/search?q=${encodeURIComponent(query.trim())}`); 
  }

  async function handleChatSend(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !token || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const response = await api<{ message: string; conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> }>(
        '/api/ai/client/chat',
        {
          method: 'POST',
          token,
          body: {
            message: userMessage,
            conversationHistory: chatMessages
          }
        }
      );
      setChatMessages(response.conversationHistory);
    } catch (error: any) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Ошибка: ${error.message || 'Не удалось отправить сообщение'}` 
      }]);
    } finally {
      setChatLoading(false);
    }
  }

  function handleClearChat() {
    if (window.confirm('Вы уверены, что хотите очистить историю чата?')) {
      setChatMessages([]);
      localStorage.removeItem('client_chat_history');
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ClientNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        {/* Баннер для клиента без психолога */}
        {hasPsychologist === false && (
          <div className="card" style={{ 
            padding: 24, 
            marginBottom: 32, 
            background: 'linear-gradient(135deg, var(--primary)22, var(--accent)11)', 
            border: '2px solid var(--primary)',
            borderRadius: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 32 }}>👨‍⚕️</div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Найдите своего психолога</h3>
                </div>
                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6, fontSize: 14 }}>
                  Для полноценной работы с платформой рекомендуется найти психолога. После назначения психолога вы получите доступ к персональным сессиям, 
                  анализу снов и индивидуальной поддержке.
                </p>
              </div>
              <button 
                className="button" 
                onClick={() => navigate('/client/psychologists')}
                style={{ padding: '12px 24px', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                Найти психолога →
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <form onSubmit={onSearch} style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 600 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 12, top: 10, opacity: .7 }}>🔎</span>
              <input style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', minWidth: 0 }} placeholder="Поиск: сны, записи, материалы" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </form>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div title="Уведомления" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', position: 'relative', cursor: 'pointer' }}>🔔</div>
          </div>
        </div>

        {/* Rank & Streak */}
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          <div className="card card-hover-shimmer" style={{ padding: 14, cursor: 'pointer' }} onClick={() => navigate('/client/rank')}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>⭐ {rank.title}</div>
            <div className="small" style={{ marginBottom: 6 }}>Уровень {rank.level}</div>
            <div style={{ width: '100%', height: 8, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${rank.progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--accent))', transition: 'width 0.3s' }} />
            </div>
            <div className="small" style={{ marginTop: 6, color: 'var(--text-muted)' }}>{rank.progress}% до следующего уровня</div>
          </div>
          <div className="card card-hover-shimmer" style={{ padding: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>🔥 Серия дней</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)' }}>{dailyStreak}</div>
            <div className="small" style={{ color: 'var(--text-muted)' }}>дней подряд</div>
          </div>
        </div>

        {/* Today's Snapshot */}
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          <div className="card card-hover-shimmer" style={{ padding: 14, cursor: 'pointer' }} onClick={() => navigate('/dreams')}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>💭 Мои сны</div>
            <div className="small">Всего записей: <b>{dreams.length}</b></div>
            {dreams[0] && (
              <div className="small" style={{ marginTop: 6 }}>Последний: <b>{dreams[0].title}</b></div>
            )}
          </div>
          <div className="card card-hover-shimmer" style={{ padding: 14, cursor: 'pointer' }} onClick={() => navigate('/client/tasks')}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>✅ Ежедневные задания</div>
            <div className="small">Выполнено: <b>{tasks.filter(t => t.completed).length}/{tasks.length}</b></div>
            {tasks.filter(t => !t.completed).slice(0, 2).map(t => (
              <div key={t.id} className="small" style={{ marginTop: 4 }}>• {t.title}</div>
            ))}
          </div>
          <div className="card card-hover-shimmer" style={{ padding: 14, cursor: 'pointer' }} onClick={() => navigate('/client/journal')}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>📔 Дневник</div>
            <div className="small">Защищённые записи</div>
            <div className="small" style={{ marginTop: 6, color: 'var(--text-muted)' }}>Ваши мысли и эмоции</div>
          </div>
        </div>

        {/* Чат с ИИ-ассистентом */}
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', height: '500px' }}>
            <div style={{ fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🤖</span>
                <span>ИИ-помощник</span>
              </div>
              {chatMessages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="button secondary"
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: 12,
                    whiteSpace: 'nowrap'
                  }}
                  title="Очистить чат"
                >
                  🗑️ Очистить
                </button>
              )}
            </div>
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              marginBottom: 12, 
              padding: 12, 
              background: 'var(--surface-2)', 
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              {chatMessages.length === 0 && (
                <div style={{ 
                  color: 'var(--text-muted)', 
                  fontSize: 14, 
                  textAlign: 'center', 
                  padding: '20px 0',
                  lineHeight: 1.6
                }}>
                  <div style={{ marginBottom: 8, fontWeight: 600 }}>Добро пожаловать!</div>
                  <div>Я ваш ИИ-помощник. Помогаю с интерпретацией снов, поддержкой и рекомендациями.</div>
                  <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
                    Попробуйте спросить: "Что означает мой последний сон?"
                  </div>
                </div>
              )}
              {chatMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    gap: 8
                  }}
                >
                  <div style={{
                    maxWidth: '75%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: msg.role === 'user' 
                      ? 'linear-gradient(135deg, var(--primary), var(--accent))' 
                      : 'var(--surface-3)',
                    color: msg.role === 'user' ? '#0b0f1a' : 'var(--text)',
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'var(--surface-3)',
                    color: 'var(--text)',
                    fontSize: 14
                  }}>
                    Думаю...
                  </div>
                </div>
              )}
            </div>
            <form onSubmit={handleChatSend} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Задайте вопрос помощнику..."
                disabled={chatLoading}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  fontSize: 14
                }}
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="button"
                style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}
              >
                {chatLoading ? '...' : 'Отправить'}
              </button>
            </form>
          </div>
        </div>

      </main>
    </div>
  );
}

