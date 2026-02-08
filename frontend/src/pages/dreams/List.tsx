import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { api } from '../../lib/api';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';
import { OceanBackground } from '../../components/visuals';

type Dream = {
  id: string;
  title: string;
  content?: string;
  symbols?: string[];
  createdAt: string;
  userId?: string;
};

type Client = { id: string; name?: string };

export default function DreamsList() {
  const { token, user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const isClient = user?.role === 'client';
  const isPsychologist = user?.role === 'psychologist' || user?.role === 'admin';

  const [items, setItems] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'mine'>(isClient ? 'mine' : 'all');
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formClientId, setFormClientId] = useState<string>('');
  const [clients, setClients] = useState<Client[]>([]);

  // Check verification status for psychologists
  useEffect(() => {
    if (!token || !isPsychologist) {
      setIsVerified(null);
      return;
    }
    
    checkVerification(token).then(result => {
      setIsVerified(result.isVerified);
      setVerificationStatus(result.status);
    });
  }, [token, isPsychologist]);

  useEffect(() => {
    if (isPsychologist && isVerified === false) return;
    
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (token) {
          const res = await api<{ items: Dream[]; total: number }>('/api/dreams', { token });
          const list = (res.items || []);
          setItems(list);
        } else {
          // Для гостей загружаем из localStorage или показываем примеры
          const guestDreams = JSON.parse(localStorage.getItem('guest_dreams') || '[]');
          if (guestDreams.length === 0) {
            // Добавляем 9 примеров снов для гостей
            const exampleDreams: Dream[] = [
              { id: 'ex1', title: 'Полет над океаном', content: 'Я летел высоко над бескрайним океаном. Вода была кристально чистой, бирюзового цвета. Внизу я видел коралловые рифы и стаи разноцветных рыб. Чувствовал невероятную свободу и легкость. Ветер обдувал лицо, а солнце светило ярко, но не обжигало.', symbols: ['полет', 'океан', 'свобода', 'вода'], createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), userId: 'guest' },
              { id: 'ex2', title: 'Старый дом с секретами', content: 'Я оказался в старом деревянном доме. Полы скрипели под ногами. В доме было много комнат, и каждая вела в другую. В одной комнате нашел старый сундук, но не смог его открыть. Слышал голоса из других комнат, но никого не видел. Чувствовал тревогу, но и любопытство.', symbols: ['дом', 'сундук', 'тайна', 'тревога'], createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), userId: 'guest' },
              { id: 'ex3', title: 'Встреча с зеркалом', content: 'Стоял перед большим зеркалом в темной комнате. В отражении видел себя, но что-то было не так. Мое отражение улыбалось, когда я не улыбался. Оно начало двигаться независимо от меня. Я протянул руку, и отражение тоже протянуло, но наши руки не встретились. Зеркало начало трескаться.', symbols: ['зеркало', 'отражение', 'тень', 'трещина'], createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), userId: 'guest' },
              { id: 'ex4', title: 'Лес в тумане', content: 'Шел по густому лесу в густом тумане. Деревья были очень высокими, их верхушки терялись в облаках. Слышал звуки животных, но не видел их. Вдруг туман рассеялся, и я увидел поляну с озером. В озере отражалось звездное небо, хотя на небе было солнце.', symbols: ['лес', 'туман', 'озеро', 'звезды'], createdAt: new Date(Date.now() - 86400000 * 7).toISOString(), userId: 'guest' },
              { id: 'ex5', title: 'Красная дверь', content: 'Длинный коридор с множеством дверей. Все двери были одинаковые, кроме одной - она была ярко-красной. Я знал, что за этой дверью что-то важное. Подошел к ней, но рука не слушалась. Слышал стук из-за двери. Кто-то звал мое имя. Проснулся, не открыв дверь.', symbols: ['дверь', 'коридор', 'красный', 'зов'], createdAt: new Date(Date.now() - 86400000 * 10).toISOString(), userId: 'guest' },
              { id: 'ex6', title: 'Город без людей', content: 'Оказался в большом городе, но он был пуст. Машины стояли на улицах, в окнах горел свет, но людей не было. Зашел в кафе - там были готовые блюда на столах, но никого. Слышал музыку издалека. Пошел на звук и нашел концертную площадку, но и там никого не было.', symbols: ['город', 'пустота', 'музыка', 'одиночество'], createdAt: new Date(Date.now() - 86400000 * 12).toISOString(), userId: 'guest' },
              { id: 'ex7', title: 'Подводный мир', content: 'Дышал под водой как рыба. Плавал среди кораллов и морских растений. Встретил дельфина, который показал мне подводный город. Город был из ракушек и жемчуга. Там жили русалки, но они не замечали меня. Чувствовал себя частью этого мира.', symbols: ['вода', 'дельфин', 'город', 'русалки'], createdAt: new Date(Date.now() - 86400000 * 15).toISOString(), userId: 'guest' },
              { id: 'ex8', title: 'Гора и вершина', content: 'Казалось, всю ночь карабкался на гору. Руки были в ссадинах, ноги устали. Но не мог остановиться. На вершине увидел храм. В храме горел огонь. Подошел к огню и увидел в нем свое будущее. Но когда попытался разглядеть детали, все исчезло.', symbols: ['гора', 'храм', 'огонь', 'будущее'], createdAt: new Date(Date.now() - 86400000 * 18).toISOString(), userId: 'guest' },
              { id: 'ex9', title: 'Танец с тенью', content: 'Танцевал в большом зале. Музыка была странной, неземной. Моя тень танцевала отдельно от меня, делая другие движения. Я пытался синхронизироваться с ней, но не получалось. Тень начала расти и стала больше меня. В конце концов, она поглотила меня, и я стал тенью.', symbols: ['танец', 'тень', 'музыка', 'поглощение'], createdAt: new Date(Date.now() - 86400000 * 20).toISOString(), userId: 'guest' }
            ];
            setItems(exampleDreams);
          } else {
            setItems(guestDreams);
          }
        }
      } catch (e: any) {
        // When unauthenticated or API is unavailable, load from localStorage
        const guestDreams = JSON.parse(localStorage.getItem('guest_dreams') || '[]');
        if (guestDreams.length === 0) {
          const exampleDreams: Dream[] = [
            { id: 'ex1', title: 'Полет над океаном', content: 'Я летел высоко над бескрайним океаном. Вода была кристально чистой, бирюзового цвета. Внизу я видел коралловые рифы и стаи разноцветных рыб. Чувствовал невероятную свободу и легкость. Ветер обдувал лицо, а солнце светило ярко, но не обжигало.', symbols: ['полет', 'океан', 'свобода', 'вода'], createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), userId: 'guest' },
            { id: 'ex2', title: 'Старый дом с секретами', content: 'Я оказался в старом деревянном доме. Полы скрипели под ногами. В доме было много комнат, и каждая вела в другую. В одной комнате нашел старый сундук, но не смог его открыть. Слышал голоса из других комнат, но никого не видел. Чувствовал тревогу, но и любопытство.', symbols: ['дом', 'сундук', 'тайна', 'тревога'], createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), userId: 'guest' },
            { id: 'ex3', title: 'Встреча с зеркалом', content: 'Стоял перед большим зеркалом в темной комнате. В отражении видел себя, но что-то было не так. Мое отражение улыбалось, когда я не улыбался. Оно начало двигаться независимо от меня. Я протянул руку, и отражение тоже протянуло, но наши руки не встретились. Зеркало начало трескаться.', symbols: ['зеркало', 'отражение', 'тень', 'трещина'], createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), userId: 'guest' },
            { id: 'ex4', title: 'Лес в тумане', content: 'Шел по густому лесу в густом тумане. Деревья были очень высокими, их верхушки терялись в облаках. Слышал звуки животных, но не видел их. Вдруг туман рассеялся, и я увидел поляну с озером. В озере отражалось звездное небо, хотя на небе было солнце.', symbols: ['лес', 'туман', 'озеро', 'звезды'], createdAt: new Date(Date.now() - 86400000 * 7).toISOString(), userId: 'guest' },
            { id: 'ex5', title: 'Красная дверь', content: 'Длинный коридор с множеством дверей. Все двери были одинаковые, кроме одной - она была ярко-красной. Я знал, что за этой дверью что-то важное. Подошел к ней, но рука не слушалась. Слышал стук из-за двери. Кто-то звал мое имя. Проснулся, не открыв дверь.', symbols: ['дверь', 'коридор', 'красный', 'зов'], createdAt: new Date(Date.now() - 86400000 * 10).toISOString(), userId: 'guest' },
            { id: 'ex6', title: 'Город без людей', content: 'Оказался в большом городе, но он был пуст. Машины стояли на улицах, в окнах горел свет, но людей не было. Зашел в кафе - там были готовые блюда на столах, но никого. Слышал музыку издалека. Пошел на звук и нашел концертную площадку, но и там никого не было.', symbols: ['город', 'пустота', 'музыка', 'одиночество'], createdAt: new Date(Date.now() - 86400000 * 12).toISOString(), userId: 'guest' },
            { id: 'ex7', title: 'Подводный мир', content: 'Дышал под водой как рыба. Плавал среди кораллов и морских растений. Встретил дельфина, который показал мне подводный город. Город был из ракушек и жемчуга. Там жили русалки, но они не замечали меня. Чувствовал себя частью этого мира.', symbols: ['вода', 'дельфин', 'город', 'русалки'], createdAt: new Date(Date.now() - 86400000 * 15).toISOString(), userId: 'guest' },
            { id: 'ex8', title: 'Гора и вершина', content: 'Казалось, всю ночь карабкался на гору. Руки были в ссадинах, ноги устали. Но не мог остановиться. На вершине увидел храм. В храме горел огонь. Подошел к огню и увидел в нем свое будущее. Но когда попытался разглядеть детали, все исчезло.', symbols: ['гора', 'храм', 'огонь', 'будущее'], createdAt: new Date(Date.now() - 86400000 * 18).toISOString(), userId: 'guest' },
            { id: 'ex9', title: 'Танец с тенью', content: 'Танцевал в большом зале. Музыка была странной, неземной. Моя тень танцевала отдельно от меня, делая другие движения. Я пытался синхронизироваться с ней, но не получалось. Тень начала расти и стала больше меня. В конце концов, она поглотила меня, и я стал тенью.', symbols: ['танец', 'тень', 'музыка', 'поглощение'], createdAt: new Date(Date.now() - 86400000 * 20).toISOString(), userId: 'guest' }
          ];
          setItems(exampleDreams);
        } else {
          setItems(guestDreams);
        }
        setError(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, isPsychologist, isVerified]);

  // Load clients for assigning dreams
  useEffect(() => {
    (async () => {
      const demoClients: Client[] = [
        { id: 'c1', name: 'Иван Петров' },
        { id: 'c2', name: 'Анна Смирнова' },
        { id: 'c3', name: 'Мария Коваль' }
      ];
      if (!token) { setClients(demoClients); setFormClientId(prev => prev || demoClients[0].id); return; }
      try {
        const res = await api<{ items: any[] }>('/api/clients', { token: token ?? undefined });
        const list = (res.items || []).map(c => ({ id: String(c.id), name: c.name })) as Client[];
        const out = list.length ? list : demoClients;
        setClients(out);
        setFormClientId(prev => prev || out[0]?.id || '');
      } catch {
        setClients(demoClients);
        setFormClientId(prev => prev || demoClients[0].id);
      }
    })();
  }, [token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (scope === 'mine' && user?.id) list = list.filter(d => String(d.userId) === String(user.id));
    if (q) list = list.filter(d => (d.title || '').toLowerCase().includes(q) || (d.content || '').toLowerCase().includes(q));
    return list;
  }, [items, query, scope, user?.id]);


  function openModal() {
    setFormTitle('');
    setFormContent('');
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); }

  async function onCreateDream(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: formTitle.trim() || 'Без названия',
      content: formContent.trim(),
      symbols: [], // Убрали поле символов
      ...(isClient ? {} : { clientId: formClientId || undefined })
    } as any;
    // Optimistic add
    const tempId = `tmp-${Date.now()}`;
    const optimistic: Dream = { id: tempId, createdAt: new Date().toISOString(), ...payload };
    setItems(prev => [optimistic, ...prev]);
    try {
      const created = await api<Dream>('/api/dreams', { method: 'POST', token: token ?? undefined, body: payload });
      setItems(prev => prev.map(d => d.id === tempId ? created : d));
    } catch {
      // Keep optimistic when offline/unauthed
    }
    setShowModal(false);
  }

  async function onDeleteDream(dreamId: string, dreamTitle: string) {
    if (!window.confirm(t('dreams.deleteConfirm').replace('{title}', dreamTitle))) {
      return;
    }

    // Optimistic delete
    setItems(prev => prev.filter(d => d.id !== dreamId));
    
    try {
      await api(`/api/dreams/${dreamId}`, {
        method: 'DELETE',
        token: token ?? undefined,
      });
    } catch (error: any) {
      // Revert on error
      console.error('Error deleting dream:', error);
      // Reload dreams on error
      try {
        const res = await api<{ items: Dream[]; total: number }>('/api/dreams', { token: token ?? undefined });
        setItems(res.items || []);
      } catch {
        // If reload fails, show error
        setError('Не удалось удалить сон. Попробуйте обновить страницу.');
      }
    }
  }

  // Show verification required message for psychologists
  if (isPsychologist && token && isVerified === false) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PsychologistNavbar />
        <VerificationRequired verificationStatus={verificationStatus} />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <OceanBackground opacity={0.85} />
      <UniversalNavbar />

      {/* Main */}
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden', position: 'relative', zIndex: 0 }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>{t('dreams.title')}</h1>
            <span className="small" style={{ color: 'var(--text-muted)' }}>· {items.length}</span>
          </div>
          {token && !isClient && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <input placeholder="Поиск по названиям и тексту" value={query} onChange={e => setQuery(e.target.value)} style={{ width: 280, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }} />
              <select value={scope} onChange={e => setScope(e.target.value as any)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}>
                <option value="all">{t('dreams.all')}</option>
                <option value="mine">{t('dreams.mine')}</option>
              </select>
            </div>
          )}
          {token && isClient && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <input placeholder="Поиск по названиям и тексту" value={query} onChange={e => setQuery(e.target.value)} style={{ width: 280, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }} />
            </div>
          )}
          <button className="button" onClick={openModal} style={{ padding: '10px 20px' }}>+ {t('dreams.newEntry')}</button>
        </div>

        {/* Content */}
        <div style={{ marginTop: 12 }}>
          {loading && (
            <div className="card" style={{ padding: 14 }}>
              <div className="small" style={{ opacity: .8 }}>{t('dreams.loading')}</div>
            </div>
          )}
          {error && (
            <div className="card" style={{ padding: 14, border: '1px solid rgba(255,0,0,0.3)' }}>
              <div className="small" style={{ color: '#ff7b7b' }}>{t('common.error')}: {error}</div>
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="card" style={{ padding: 14 }}>
              <div className="small" style={{ opacity: .8 }}>{t('dreams.noEntries')}</div>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
              {filtered.map(d => (
                <div key={d.id} className="card card-hover-shimmer" onClick={() => navigate(`/dreams/${d.id}`)} style={{ padding: 32, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: 20 }}>
                    <div style={{ fontSize: 40, flexShrink: 0 }}>💭</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                        <h3 style={{ margin: 0, fontSize: 24, fontWeight: 700, lineHeight: 1.3 }}>{d.title || 'Без названия'}</h3>
                        <div className="small" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 14 }}>
                          {new Date(d.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                      </div>
                      <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', lineHeight: 1.8, fontSize: 16, marginBottom: 0 }}>
                        {d.content}
                      </p>
                      {token && d.symbols && Array.isArray(d.symbols) && d.symbols.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
                          {d.symbols.slice(0, 8).map((s, idx) => (
                            <span key={idx} className="small" style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: 6, fontSize: 12 }}>{s}</span>
                          ))}
                        </div>
                      )}
                      {token && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
                          {!isClient && (
                            <>
                              <button className="button secondary" onClick={(e) => { e.stopPropagation(); navigate(`/dreams/${d.id}/feedback`); }} style={{ padding: '6px 12px', fontSize: 13 }}>{t('dreams.analysis')}</button>
                              <button className="button secondary" disabled={!d.userId} onClick={(e) => { e.stopPropagation(); d.userId && navigate(`/psychologist/work-area?client=${encodeURIComponent(String(d.userId))}`); }} style={{ padding: '6px 12px', fontSize: 13 }} title={d.userId ? 'Открыть рабочую область клиента' : 'Клиент не указан'}>{t('dreams.toClient')}</button>
                            </>
                          )}
                          <button 
                            className="button secondary" 
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteDream(d.id, d.title);
                            }} 
                            style={{ 
                              padding: '6px 12px', 
                              fontSize: 13,
                              color: '#ff7b7b',
                              borderColor: 'rgba(255, 123, 123, 0.3)'
                            }}
                            title="Удалить сон"
                          >
                            ✕ Удалить
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      {showModal && (
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.75)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 1000 }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: 'min(600px, 96vw)', maxHeight: '90vh', overflow: 'auto', padding: 32, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💭</div>
              <div style={{ fontWeight: 800, fontSize: 24, marginBottom: 8 }}>Записать сон</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                Опишите свой сон во всех деталях
              </div>
            </div>
            <form onSubmit={onCreateDream} style={{ display: 'grid', gap: 20 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 10, fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                  Название сна
                </label>
                <input 
                  value={formTitle} 
                  onChange={e => setFormTitle(e.target.value)} 
                  placeholder="Короткое название, например: 'Полет над городом'" 
                  required 
                  style={{ 
                    width: '100%', 
                    padding: '14px 16px', 
                    borderRadius: 12, 
                    border: '1px solid rgba(255,255,255,0.12)', 
                    background: 'var(--surface-2)', 
                    color: 'var(--text)', 
                    fontSize: 15,
                    transition: 'all 0.2s'
                  }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 10, fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                  Описание сна
                </label>
                <textarea 
                  value={formContent} 
                  onChange={e => setFormContent(e.target.value)} 
                  placeholder="Опишите свой сон во всех деталях: что вы видели, чувствовали, какие были цвета, звуки, эмоции..." 
                  rows={10} 
                  required 
                  style={{ 
                    width: '100%', 
                    padding: '14px 16px', 
                    borderRadius: 12, 
                    border: '1px solid rgba(255,255,255,0.12)', 
                    background: 'var(--surface-2)', 
                    color: 'var(--text)', 
                    resize: 'vertical',
                    fontSize: 15,
                    fontFamily: 'inherit',
                    lineHeight: 1.6,
                    transition: 'all 0.2s'
                  }} 
                />
              </div>
              {!isClient && token && (
                <div>
                  <label style={{ display: 'block', marginBottom: 10, fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                    Клиент
                  </label>
                  <select value={formClientId} onChange={e => setFormClientId(e.target.value)} required style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }}>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name || c.id}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" className="button secondary" onClick={closeModal} style={{ padding: '12px 24px', fontSize: 15 }}>Отмена</button>
                <button type="submit" className="button" style={{ padding: '12px 24px', fontSize: 15, fontWeight: 600 }}>Сохранить сон</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
