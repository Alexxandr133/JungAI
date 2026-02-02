import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ResearcherNavbar } from '../../components/ResearcherNavbar';
import { clearVerificationCache } from '../../utils/verification';

export default function ResearcherProfile() {
  const { token, refreshProfile } = useAuth();
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [experience, setExperience] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [verificationComment, setVerificationComment] = useState<string | null>(null);
  const [verificationDocument, setVerificationDocument] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (token) {
      loadProfile();
      loadVerificationStatus();
    }
  }, [token]);

  async function loadProfile() {
    if (!token) return;
    try {
      const res = await api<{ name?: string; phone?: string; location?: string; bio?: string; specialization?: string; experience?: string; avatarUrl?: string | null; isVerified?: boolean }>('/api/researcher/profile', { token });
      setName(res.name || '');
      setPhone(res.phone || '');
      setLocation(res.location || '');
      setBio(res.bio || '');
      setSpecialization(res.specialization || '');
      setExperience(res.experience || '');
      setAvatarUrl(res.avatarUrl || null);
      setIsVerified(res.isVerified || false);
      console.log('Profile loaded, avatarUrl:', res.avatarUrl);
    } catch (e) {
      console.error('Failed to load profile:', e);
    }
  }

  async function loadVerificationStatus() {
    if (!token) return;
    try {
      const res = await api<{ status: string; comment?: string | null }>('/api/researcher/verification/status', { token });
      setVerificationStatus(res.status as any || 'none');
      setVerificationComment(res.comment || null);
    } catch (e) {
      // No verification request yet
      setVerificationStatus('none');
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await api('/api/researcher/profile', {
        method: 'PUT',
        token,
        body: { name, phone, location, bio, specialization, experience }
      });
      setStatus('Профиль сохранен');
      await refreshProfile();
      setTimeout(() => setStatus(null), 3000);
    } catch (e: any) {
      setError(e.message || 'Не удалось сохранить профиль');
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
      
      const res = await api<{ avatarUrl: string }>('/api/researcher/profile/avatar', {
        method: 'POST',
        token,
        body: formData
      });
      
      setAvatarUrl(res.avatarUrl);
      setStatus('Аватар загружен');
      await refreshProfile();
      await loadProfile();
      setTimeout(() => setStatus(null), 3000);
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить аватар');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function uploadVerificationDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!verificationDocument || !token) return;
    setUploading(true);
    setError(null);
    setStatus(null);
    try {
      const formData = new FormData();
      formData.append('document', verificationDocument);
      
      await api('/api/researcher/verification/submit', {
        method: 'POST',
        token,
        body: formData
      });
      
      setStatus('Документ загружен и отправлен на проверку');
      setVerificationDocument(null);
      setVerificationStatus('pending');
      clearVerificationCache();
      setTimeout(() => setStatus(null), 5000);
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить документ');
    } finally {
      setUploading(false);
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

  const getVerificationBadge = () => {
    if (isVerified) {
      return <span style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>✓ Верифицирован</span>;
    }
    if (verificationStatus === 'pending') {
      return <span style={{ background: 'rgba(255, 193, 7, 0.2)', color: '#ffc107', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>⏳ На проверке</span>;
    }
    if (verificationStatus === 'rejected') {
      return <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>✕ Отклонено</span>;
    }
    return <span style={{ background: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>Не верифицирован</span>;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ResearcherNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Профиль исследователя</h1>
          <div className="small" style={{ color: 'var(--text-muted)' }}>Управление личной информацией и настройками аккаунта</div>
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
          {/* Left column: Avatar and status */}
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

              {/* Verification status */}
              <div style={{ width: '100%', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="small" style={{ marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>Статус верификации</div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {getVerificationBadge()}
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
                  <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>ФИО</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Фамилия Имя Отчество"
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15, transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>Телефон</label>
                    <input
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+7 (999) 123-45-67"
                      style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15, transition: 'border-color 0.2s' }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                    />
                  </div>
                  <div>
                    <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>Локация</label>
                    <input
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="Город, страна"
                      style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15, transition: 'border-color 0.2s' }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                    />
                  </div>
                </div>
                <div>
                  <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>Специализация</label>
                  <input
                    value={specialization}
                    onChange={e => setSpecialization(e.target.value)}
                    placeholder="Например: Исследование сновидений, Аналитическая психология"
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15, transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                  />
                </div>
                <div>
                  <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>Опыт работы</label>
                  <input
                    value={experience}
                    onChange={e => setExperience(e.target.value)}
                    placeholder="Например: 10 лет исследований"
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15, transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                  />
                </div>
                <div>
                  <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>О себе</label>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Краткая информация о вас, ваших исследованиях..."
                    rows={6}
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', resize: 'vertical', transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8 }}>
                  <button type="submit" className="button" disabled={saving} style={{ padding: '12px 24px', fontSize: 15, fontWeight: 600, minWidth: 140 }}>
                    {saving ? 'Сохранение...' : 'Сохранить изменения'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Verification section - full width */}
        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ margin: 0, marginBottom: 20, fontSize: 22, fontWeight: 700 }}>Верификация исследователя</h2>
          <div style={{ marginBottom: 24 }}>
            <p style={{ margin: 0, marginBottom: 12, color: 'var(--text-muted)', lineHeight: 1.6, fontSize: 15 }}>
              Для получения верифицированного статуса исследователя загрузите документ, подтверждающий вашу квалификацию 
              (диплом, сертификат, научные публикации, лицензию и т.д.). Документ будет проверен администратором.
            </p>
          </div>

          {verificationStatus === 'pending' && (
            <div className="card" style={{ padding: 20, background: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.3)', marginBottom: 24, borderRadius: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>⏳ Запрос на проверке</div>
              <div className="small" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>Ваш документ отправлен на проверку. Ожидайте решения администратора.</div>
            </div>
          )}

          {verificationStatus === 'rejected' && (
            <div className="card" style={{ padding: 20, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: 24, borderRadius: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#ef4444', fontSize: 15 }}>✕ Запрос отклонен</div>
              <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>Ваш запрос на верификацию был отклонен. Вы можете загрузить новый документ.</div>
              {verificationComment && (
                <div style={{ marginTop: 12, padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 10 }}>
                  <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Комментарий администратора:</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>{verificationComment}</div>
                </div>
              )}
            </div>
          )}

          {verificationStatus !== 'approved' && (
            <form onSubmit={uploadVerificationDocument} style={{ display: 'grid', gap: 20 }}>
              <div>
                <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>Документ о квалификации</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={e => setVerificationDocument(e.target.files?.[0] || null)}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15, cursor: 'pointer' }}
                />
                <div className="small" style={{ marginTop: 8, color: 'var(--text-muted)' }}>
                  Поддерживаемые форматы: PDF, JPG, PNG, DOC, DOCX (макс. 10 МБ)
                </div>
              </div>
              {verificationDocument && (
                <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="small" style={{ color: 'var(--text)', fontWeight: 600 }}>Выбран файл: {verificationDocument.name}</div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="submit" className="button" disabled={!verificationDocument || uploading} style={{ padding: '12px 24px', fontSize: 15, fontWeight: 600, minWidth: 180 }}>
                  {uploading ? 'Загрузка...' : 'Отправить на проверку'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
      <style>{`
        @media (max-width: 768px) {
          main > div:has(> div[style*="position: sticky"]) {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
          main > div > div[style*="position: sticky"] {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}
