import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ResearcherNavbar } from '../../components/ResearcherNavbar';

const FAVORITES_STORAGE_KEY = 'researcher_favorites_people';

// Случайные имена для обезличивания
const RANDOM_FIRST_NAMES = [
  'Александр', 'Дмитрий', 'Максим', 'Сергей', 'Андрей', 'Алексей', 'Артем', 'Илья',
  'Кирилл', 'Михаил', 'Никита', 'Матвей', 'Роман', 'Егор', 'Арсений', 'Иван',
  'Денис', 'Евгений', 'Данил', 'Тимур', 'Владислав', 'Игорь', 'Владимир', 'Павел',
  'Анна', 'Мария', 'Елена', 'Наталья', 'Ольга', 'Татьяна', 'Ирина', 'Екатерина',
  'Светлана', 'Юлия', 'Анастасия', 'Дарья', 'Оксана', 'Валентина', 'Людмила', 'Марина'
];

const RANDOM_LAST_NAMES = [
  'Иванов', 'Петров', 'Сидоров', 'Смирнов', 'Кузнецов', 'Попов', 'Васильев', 'Петров',
  'Соколов', 'Михайлов', 'Новikov', 'Федоров', 'Морозов', 'Волков', 'Алексеев', 'Лебедев',
  'Семенов', 'Егоров', 'Павлов', 'Козлов', 'Степанов', 'Николаев', 'Орлов', 'Андреев',
  'Макаров', 'Никитин', 'Захаров', 'Зайцев', 'Соловьев', 'Борисов', 'Яковлев', 'Григорьев'
];

function anonymizeName(_originalName: string, index: number): string {
  const firstName = RANDOM_FIRST_NAMES[index % RANDOM_FIRST_NAMES.length];
  const lastName = RANDOM_LAST_NAMES[index % RANDOM_LAST_NAMES.length];
  return `${firstName} ${lastName}`;
}

function anonymizeAge(age: number | null | undefined): number | null {
  if (!age) return null;
  const variance = Math.floor(Math.random() * 11) - 5; // -5 to +5
  return Math.max(18, Math.min(100, age + variance));
}

interface AnonymizedClient {
  id: string;
  anonymizedName: string;
  age: number | null;
  values: string | null;
  irritants: string | null;
}

export default function ResearcherPeople() {
  const { token } = useAuth();
  const [clients, setClients] = useState<AnonymizedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFavorites(new Set(parsed));
        }
      }
    } catch (e) {
      console.error('Failed to load favorites:', e);
    }
  }, []);

  // Save favorites to localStorage
  const saveFavorites = (newFavorites: Set<string>) => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(newFavorites)));
    } catch (e) {
      console.error('Failed to save favorites:', e);
    }
  };

  const toggleFavorite = (clientId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(clientId)) {
      newFavorites.delete(clientId);
    } else {
      newFavorites.add(clientId);
    }
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
  };

  useEffect(() => {
    if (token) {
      loadClients();
    }
  }, [token]);

  async function loadClients() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      // Получаем всех клиентов через эндпоинт исследователя
      const clientsRes = await api<{ items: any[] }>('/api/research/clients', { token });
      const allClients = clientsRes.items || [];

      // Обезличиваем данные и получаем информацию из рабочей области
      const anonymizedClients: AnonymizedClient[] = await Promise.all(
        allClients.map(async (client, index) => {
          // Получаем документы рабочей области для клиента
          let values: string | null = null;
          let irritants: string | null = null;
          let age: number | null = null;

          try {
            // Получаем документы рабочей области через эндпоинт исследователя
            const documentsRes = await api<{ items: any[] }>(
              `/api/research/clients/${client.id}/documents`,
              { token }
            ).catch(() => ({ items: [] }));

            const documents = documentsRes.items || [];
            
            // Ищем документы с ценностями и раздражителями
            const valuesDoc = documents.find((doc: any) => 
              doc.tabName === 'ценности/кредо' || doc.tabName === 'ценности'
            );
            const irritantsDoc = documents.find((doc: any) => 
              doc.tabName === 'раздражители'
            );

            if (valuesDoc) {
              // Извлекаем текст из HTML, если это HTML
              const content = valuesDoc.content || '';
              values = content.replace(/<[^>]*>/g, '').trim() || null;
            }

            if (irritantsDoc) {
              const content = irritantsDoc.content || '';
              irritants = content.replace(/<[^>]*>/g, '').trim() || null;
            }

            // Пытаемся получить возраст из профиля клиента
            try {
              const profileRes = await api<any>(
                `/api/clients/${client.id}/profile`,
                { token }
              ).catch(() => null);
              
              if (profileRes?.profile?.age) {
                age = anonymizeAge(profileRes.profile.age);
              }
            } catch {}
          } catch (e) {
            // Игнорируем ошибки при получении документов
            console.error('Failed to load documents for client:', client.id, e);
          }

          return {
            id: client.id,
            anonymizedName: anonymizeName(client.name || `Клиент ${index + 1}`, index),
            age,
            values,
            irritants
          };
        })
      );

      setClients(anonymizedClients);
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ResearcherNavbar />
      <main
        style={{
          flex: 1,
          padding: '24px clamp(16px, 5vw, 48px)',
          maxWidth: '100%',
          overflowX: 'hidden'
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>👥 Люди</h1>
          <div className="small" style={{ color: 'var(--text-muted)' }}>
            Обезличенные данные всех зарегистрированных клиентов
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--surface-2)', borderRadius: 10, color: '#ff7b7b' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div className="small" style={{ opacity: 0.7 }}>Загрузка данных...</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {clients.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: 'center', gridColumn: '1 / -1' }}>
                <div className="small" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                  Нет данных для отображения
                </div>
              </div>
            ) : (
              clients.map((client) => {
                const isFavorite = favorites.has(client.id);
                return (
                  <div
                    key={client.id}
                  className="card"
                  style={{
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    position: 'relative',
                    transition: 'all 0.2s',
                    background: 'var(--surface)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 16
                  }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Favorite button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(client.id);
                      }}
                      style={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        border: 'none',
                        background: isFavorite ? 'rgba(255, 193, 7, 0.2)' : 'var(--surface-2)',
                        color: isFavorite ? '#ffc107' : 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        transition: 'all 0.2s',
                        zIndex: 10
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isFavorite ? 'rgba(255, 193, 7, 0.3)' : 'var(--surface)';
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isFavorite ? 'rgba(255, 193, 7, 0.2)' : 'var(--surface-2)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                      title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                    >
                      {isFavorite ? '⭐' : '☆'}
                    </button>

                    <div style={{ paddingRight: 40 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                        {client.anonymizedName}
                      </div>
                      {client.age !== null && (
                        <div className="small" style={{ color: 'var(--text-muted)' }}>
                          Возраст: {client.age} лет (±5)
                        </div>
                      )}
                    </div>

                  {client.values && (
                    <div>
                      <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
                        Ценности / Кредо
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {client.values.length > 200 ? `${client.values.substring(0, 200)}...` : client.values}
                      </div>
                    </div>
                  )}

                  {client.irritants && (
                    <div>
                      <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
                        Раздражители
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {client.irritants.length > 200 ? `${client.irritants.substring(0, 200)}...` : client.irritants}
                      </div>
                    </div>
                  )}

                  {!client.values && !client.irritants && client.age === null && (
                    <div className="small" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                      Данные из рабочей области отсутствуют
                    </div>
                  )}
                </div>
              );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
