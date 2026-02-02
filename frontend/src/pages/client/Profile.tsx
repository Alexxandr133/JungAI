import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ClientNavbar } from '../../components/ClientNavbar';

export default function ClientProfile() {
  const { refreshProfile } = useAuth();
  
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { token } = useAuth();

  useEffect(() => {
    loadProfile();
  }, [token]);

  async function loadProfile() {
    if (!token) {
      return;
    }

    try {
      const res = await api<{ client: any; profile: any }>('/api/client/profile', { token });
      setName(res.profile?.name || res.client?.name || '');
      setAge(res.profile?.age?.toString() || '');
      setGender(res.profile?.gender || '');
      setBio(res.profile?.bio || '');
      setPhone(res.client?.phone || '');
      setAvatarUrl(res.profile?.avatarUrl || null);
    } catch (e) {
      console.error('Failed to load profile:', e);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await api('/api/client/profile', {
        method: 'POST',
        token: token || undefined,
        body: {
          name,
          age,
          gender,
          bio,
          phone
        }
      });
      
      // Имя клиента уже обновляется в backend при сохранении профиля
      
      setStatus('Профиль сохранен');
      await refreshProfile();
      setTimeout(() => setStatus(null), 3000);
    } catch (e: any) {
      setError(e.message || 'Ошибка при сохранении профиля');
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (!token) return;
    setUploadingAvatar(true);
    setError(null);
    setStatus(null);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      
      const res = await api<{ avatarUrl: string }>('/api/client/profile/avatar', {
        method: 'POST',
        token: token || undefined,
        body: formData
      });
      
      setAvatarUrl(res.avatarUrl);
      setStatus('Фото профиля загружено');
      await refreshProfile();
      await loadProfile();
      setTimeout(() => setStatus(null), 3000);
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить фото');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'удалить') {
      return;
    }
    
    setDeleting(true);
    try {
      await api('/api/client/account', {
        method: 'DELETE',
        token: token || undefined
      });
      // Выходим из аккаунта и перенаправляем на главную
      localStorage.removeItem('token');
      window.location.href = '/login';
    } catch (e: any) {
      alert('Ошибка при удалении аккаунта: ' + (e.message || 'Неизвестная ошибка'));
    } finally {
      setDeleting(false);
    }
  }

  const getAvatarUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const env = (import.meta as any).env || {};
    let baseOrigin: string = env.VITE_API_ORIGIN || env.VITE_API_URL || '';
    if (!baseOrigin && env.DEV && typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '4000') {
      baseOrigin = 'http://localhost:4000';
    }
    if (!baseOrigin && typeof window !== 'undefined') {
      baseOrigin = window.location.origin;
    }
    return `${baseOrigin}${url}`;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ClientNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Профиль</h1>
          <div className="small" style={{ color: 'var(--text-muted)' }}>Управление личной информацией</div>
        </div>

        {/* Status messages */}
        {status && (
          <div className="card" style={{ padding: 12, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: 20, borderRadius: 12 }}>
            {status}
          </div>
        )}
        {error && (
          <div className="card" style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: 20, borderRadius: 12, color: '#ef4444' }}>
            {error}
          </div>
        )}

        {/* Main content: Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: 32, alignItems: 'flex-start', marginBottom: 32 }}>
          {/* Left column: Avatar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'sticky', top: 100 }}>
            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              {/* Avatar */}
              <div style={{ marginBottom: 20, position: 'relative' }}>
                {getAvatarUrl(avatarUrl) ? (
                  <img
                    src={getAvatarUrl(avatarUrl) || ''}
                    alt={name || 'Аватар'}
                    style={{
                      width: 160,
                      height: 160,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.avatar-fallback')) {
                        const fallback = document.createElement('div');
                        fallback.className = 'avatar-fallback';
                        fallback.style.cssText = 'width: 160px; height: 160px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #0b0f1a; display: grid; place-items: center; font-weight: 800; font-size: 48px; border: 3px solid rgba(255,255,255,0.1);';
                        fallback.textContent = (name || '?').trim().charAt(0).toUpperCase();
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  <div style={{
                    width: 160,
                    height: 160,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                    color: '#0b0f1a',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 48,
                    border: '3px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                  }}>
                    {(name || '?').trim().charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Avatar upload button */}
              <div style={{ width: '100%', marginBottom: 20 }}>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadAvatar(file);
                  }}
                  style={{ display: 'none' }}
                  id="avatar-upload-input"
                  disabled={uploadingAvatar}
                />
                <label
                  htmlFor="avatar-upload-input"
                  className="button secondary"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 16px',
                    fontSize: 14,
                    cursor: uploadingAvatar ? 'wait' : 'pointer',
                    textAlign: 'center',
                    opacity: uploadingAvatar ? 0.6 : 1
                  }}
                >
                  {uploadingAvatar ? 'Загрузка...' : avatarUrl ? 'Изменить фото' : 'Загрузить фото'}
                </label>
                <div className="small" style={{ marginTop: 8, color: 'var(--text-muted)', textAlign: 'center' }}>
                  JPG, PNG до 5 МБ
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Основная информация */}
            <div className="card" style={{ padding: 32 }}>
              <h2 style={{ margin: 0, marginBottom: 24, fontSize: 22, fontWeight: 700 }}>Основная информация</h2>
              <form onSubmit={saveProfile} style={{ display: 'grid', gap: 20 }}>
                <div>
                  <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>Имя</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
                    placeholder="Ваше имя"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>Возраст</label>
                    <input
                      type="number"
                      value={age}
                      onChange={e => setAge(e.target.value)}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
                      placeholder="Возраст"
                    />
                  </div>
                  <div>
                    <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>Пол</label>
                    <select
                      value={gender}
                      onChange={e => setGender(e.target.value)}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
                    >
                      <option value="">Не указано</option>
                      <option value="male">Мужской</option>
                      <option value="female">Женский</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>Телефон</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
                    placeholder="+7 900 000-00-00"
                  />
                </div>

                <div>
                  <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>О себе</label>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', minHeight: 120, resize: 'vertical', fontFamily: 'inherit' }}
                    placeholder="Расскажите о себе..."
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
                  <button 
                    className="button danger" 
                    onClick={() => setShowDeleteModal(true)}
                    type="button"
                    style={{ padding: '12px 24px' }}
                  >
                    Удалить аккаунт
                  </button>
                  <button 
                    className="button" 
                    type="submit"
                    disabled={saving}
                    style={{ padding: '12px 24px' }}
                  >
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Modal для удаления аккаунта */}
        {showDeleteModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.75)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', zIndex: 1001, padding: 16 }} onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}>
            <div className="card" style={{ width: 'min(500px, 94vw)', padding: 24, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
                <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>Удаление аккаунта</div>
                <div className="small" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Это действие необратимо. Все ваши данные будут удалены безвозвратно, включая:
                </div>
                <ul style={{ marginTop: 12, paddingLeft: 20, color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.8 }}>
                  <li>Профиль и личная информация</li>
                  <li>Записи дневника</li>
                  <li>Сны и их анализ</li>
                  <li>Сессии терапии</li>
                  <li>Все остальные данные</li>
                </ul>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div className="small" style={{ marginBottom: 8, color: 'var(--text-muted)' }}>
                  Для подтверждения введите слово <strong style={{ color: 'var(--text)' }}>"удалить"</strong>:
                </div>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder="удалить"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button 
                  className="button secondary" 
                  onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}
                  disabled={deleting}
                  style={{ padding: '10px 20px' }}
                >
                  Отмена
                </button>
                <button 
                  className="button danger" 
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirm !== 'удалить'}
                  style={{ padding: '10px 20px' }}
                >
                  {deleting ? 'Удаление...' : 'Удалить аккаунт'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
