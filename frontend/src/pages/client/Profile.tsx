import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, resolvePublicFileUrl } from '../../lib/api';
import { ClientNavbar } from '../../components/ClientNavbar';
import { EmailChangeFlow } from '../../components/EmailChangeFlow';
import {
  PHONE_COUNTRIES,
  composePhone,
  digitsOnly,
  formatNationalNumber,
  parseStoredPhone,
  type PhoneCountryCode,
} from '../../lib/phoneFormat';
import '../../styles/landing-tokens.css';
import '../psychologist/Profile.css';
import './Profile.css';

const BIO_MAX = 600;

type Snapshot = {
  name: string;
  age: string;
  gender: string;
  bio: string;
  phoneCountry: PhoneCountryCode;
  phoneNational: string;
  avatarUrl: string | null;
};

function snapshotEqual(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function ClientProfile() {
  const { refreshProfile, token, user } = useAuth();

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [bio, setBio] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountryCode>('RU');
  const [phoneNational, setPhoneNational] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mediaRev, setMediaRev] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<Snapshot | null>(null);

  const phoneCountryMeta = useMemo(
    () => PHONE_COUNTRIES.find((c) => c.code === phoneCountry) || PHONE_COUNTRIES[0],
    [phoneCountry]
  );

  const phoneDisplay = formatNationalNumber(phoneNational, phoneCountryMeta.nationalLength);

  const currentSnapshot: Snapshot = {
    name,
    age,
    gender,
    bio,
    phoneCountry,
    phoneNational,
    avatarUrl,
  };

  const dirty = savedSnapshot ? !snapshotEqual(currentSnapshot, savedSnapshot) : false;

  const avatarSrc = useMemo(() => {
    const base = resolvePublicFileUrl(avatarUrl);
    if (!base) return null;
    if (base.startsWith('blob:') || base.startsWith('data:')) return base;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}v=${mediaRev}`;
  }, [avatarUrl, mediaRev]);

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadProfile() {
    if (!token) return;
    try {
      const res = await api<{ client: any; profile: any }>('/api/client/profile', { token });
      const nextName = res.profile?.name || res.client?.name || '';
      const nextAge = res.profile?.age?.toString() || '';
      const nextGender = res.profile?.gender || '';
      const nextBio = res.profile?.bio || '';
      const parsed = parseStoredPhone(res.client?.phone || '');
      const nextAvatar = res.profile?.avatarUrl || null;

      setName(nextName);
      setAge(nextAge);
      setGender(nextGender);
      setBio(nextBio);
      setPhoneCountry(parsed.countryCode);
      setPhoneNational(parsed.nationalDigits);
      setAvatarUrl(nextAvatar);
      setSavedSnapshot({
        name: nextName,
        age: nextAge,
        gender: nextGender,
        bio: nextBio,
        phoneCountry: parsed.countryCode,
        phoneNational: parsed.nationalDigits,
        avatarUrl: nextAvatar,
      });
    } catch (e) {
      console.error('Failed to load profile:', e);
    }
  }

  function onPhoneCountryChange(code: PhoneCountryCode) {
    const next = PHONE_COUNTRIES.find((c) => c.code === code) || PHONE_COUNTRIES[0];
    setPhoneCountry(code);
    setPhoneNational((prev) => digitsOnly(prev).slice(0, next.nationalLength));
  }

  function onPhoneNationalChange(raw: string) {
    setPhoneNational(digitsOnly(raw).slice(0, phoneCountryMeta.nationalLength));
  }

  function discardChanges() {
    if (!savedSnapshot) return;
    setName(savedSnapshot.name);
    setAge(savedSnapshot.age);
    setGender(savedSnapshot.gender);
    setBio(savedSnapshot.bio);
    setPhoneCountry(savedSnapshot.phoneCountry);
    setPhoneNational(savedSnapshot.phoneNational);
    setAvatarUrl(savedSnapshot.avatarUrl);
    setError(null);
    setStatus(null);
  }

  async function saveProfile(e?: FormEvent) {
    e?.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const phone = composePhone(phoneCountryMeta.dial, phoneNational);
      await api('/api/client/profile', {
        method: 'POST',
        token,
        body: {
          name,
          age,
          gender,
          bio,
          phone,
        },
      });
      setSavedSnapshot({ ...currentSnapshot, phoneNational, phoneCountry, avatarUrl });
      setStatus('Профиль сохранён');
      await refreshProfile();
      setTimeout(() => setStatus(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка при сохранении профиля';
      setError(msg);
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
        token,
        body: formData,
      });
      setAvatarUrl(res.avatarUrl);
      setMediaRev((n) => n + 1);
      setStatus('Фото профиля загружено');
      await refreshProfile();
      await loadProfile();
      setTimeout(() => setStatus(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Не удалось загрузить фото';
      setError(msg);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'удалить' || !token) return;
    setDeleting(true);
    try {
      await api('/api/client/account', { method: 'DELETE', token });
      localStorage.removeItem('token');
      window.location.href = '/login';
    } catch (err: unknown) {
      alert('Ошибка при удалении аккаунта: ' + (err instanceof Error ? err.message : 'Неизвестная ошибка'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={`client-profile${dirty ? ' is-dirty' : ''}`}>
      <ClientNavbar />
      <div className={`landing psy-profile-editor${dirty ? ' is-dirty' : ''}`}>
        <h1 className="psy-profile-editor__title">Профиль</h1>
        <p className="psy-profile-editor__lead">Личные данные и настройки аккаунта</p>

        {status ? <div className="psy-profile-alert psy-profile-alert--ok">{status}</div> : null}
        {error ? <div className="psy-profile-alert psy-profile-alert--err">{error}</div> : null}

        <div className="psy-profile-editor__layout client-profile__layout">
          <div className="psy-profile-editor__form-col">
            <section className="psy-profile-zone" aria-labelledby="about-zone-title">
              <div className="psy-profile-zone__head">
                <div>
                  <p className="psy-profile-zone__eyebrow">О вас</p>
                  <h2 id="about-zone-title" className="psy-profile-zone__title">
                    Личная информация
                  </h2>
                  <p className="psy-profile-zone__subtitle">
                    Эти данные видите вы и ваш психолог — без публичной страницы
                  </p>
                </div>
              </div>

              <div className="psy-profile-section">
                <h3 className="psy-profile-section__title">Фото</h3>
                <div className="psy-profile-avatar-row">
                  <div className="psy-profile-avatar">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="" />
                    ) : (
                      <span>{(name || '?').trim().charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      id="client-avatar-upload"
                      style={{ display: 'none' }}
                      disabled={uploadingAvatar}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadAvatar(file);
                        e.target.value = '';
                      }}
                    />
                    <label
                      htmlFor="client-avatar-upload"
                      className={`psy-profile-file-btn${uploadingAvatar ? ' is-busy' : ''}`}
                    >
                      {uploadingAvatar ? 'Загрузка…' : avatarUrl ? 'Изменить фото' : 'Загрузить фото'}
                    </label>
                    <p className="psy-profile-section__help" style={{ marginTop: 8, marginBottom: 0 }}>
                      JPG, PNG, WEBP до 5 МБ
                    </p>
                  </div>
                </div>
              </div>

              <form className="psy-profile-section" onSubmit={(e) => void saveProfile(e)}>
                <h3 className="psy-profile-section__title">Основное</h3>
                <div className="psy-profile-fields">
                  <div className="psy-profile-field">
                    <label htmlFor="client-name">Имя</label>
                    <input
                      id="client-name"
                      className="psy-profile-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Как к вам обращаться"
                      autoComplete="name"
                    />
                  </div>

                  <div className="psy-profile-fields psy-profile-fields--2">
                    <div className="psy-profile-field">
                      <label htmlFor="client-age">Возраст</label>
                      <input
                        id="client-age"
                        className="psy-profile-input"
                        type="number"
                        min={1}
                        max={120}
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="Возраст"
                      />
                    </div>
                    <div className="psy-profile-field">
                      <label htmlFor="client-gender">Пол</label>
                      <select
                        id="client-gender"
                        className="psy-profile-select"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                      >
                        <option value="">Не указано</option>
                        <option value="male">Мужской</option>
                        <option value="female">Женский</option>
                      </select>
                    </div>
                  </div>

                  <div className="psy-profile-field">
                    <label htmlFor="client-bio">
                      О себе <span className="client-profile__char">{bio.length}/{BIO_MAX}</span>
                    </label>
                    <textarea
                      id="client-bio"
                      className="psy-profile-textarea"
                      value={bio}
                      maxLength={BIO_MAX}
                      onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                      placeholder="Коротко о себе — для психолога"
                      rows={5}
                    />
                  </div>
                </div>
              </form>
            </section>

            <section className="psy-profile-zone psy-profile-zone--account" aria-labelledby="account-zone-title">
              <p className="psy-profile-zone__eyebrow">Только для вас</p>
              <h2 id="account-zone-title" className="psy-profile-zone__title" style={{ fontSize: 20 }}>
                Аккаунт
              </h2>
              <p className="psy-profile-zone__subtitle" style={{ marginBottom: 16 }}>
                Контакты и доступ к кабинету
              </p>

              <div className="psy-profile-account-row">
                <div>
                  <div className="psy-profile-account-label">Email</div>
                  <div className="psy-profile-account-value">{user?.email || '—'}</div>
                </div>
                <EmailChangeFlow />
              </div>

              <div className="psy-profile-account-row" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="psy-profile-account-label">Телефон</div>
                  <div className="psy-profile-phone">
                    <select
                      className="psy-profile-select"
                      value={phoneCountry}
                      onChange={(e) => onPhoneCountryChange(e.target.value as PhoneCountryCode)}
                      aria-label="Код страны"
                    >
                      {PHONE_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <div className="psy-profile-phone__national">
                      <span className="psy-profile-phone__dial">{phoneCountryMeta.dial}</span>
                      <input
                        value={phoneDisplay}
                        onChange={(e) => onPhoneNationalChange(e.target.value)}
                        placeholder={
                          phoneCountryMeta.nationalLength >= 10
                            ? '(900) 000-00-00'
                            : phoneCountryMeta.nationalLength === 9
                              ? '(90) 000-00-00'
                              : '(90) 000-000'
                        }
                        inputMode="tel"
                        autoComplete="tel-national"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="psy-profile-account-row">
                <div>
                  <div className="psy-profile-account-label">Пароль</div>
                  <p className="psy-profile-account-note">
                    Смена пароля — через «Забыли пароль?» на{' '}
                    <Link to="/login" className="landing-btn landing-btn--tertiary" style={{ padding: 0 }}>
                      странице входа
                    </Link>
                    .
                  </p>
                </div>
              </div>

              <div className="psy-profile-account-row client-profile__danger">
                <div>
                  <div className="psy-profile-account-label">Удаление</div>
                  <p className="psy-profile-account-note">
                    Удалит профиль, дневник, сны и сессии без возможности восстановления.
                  </p>
                </div>
                <button type="button" className="landing-btn landing-btn--ghost client-profile__delete-btn" onClick={() => setShowDeleteModal(true)}>
                  Удалить аккаунт
                </button>
              </div>
            </section>
          </div>
        </div>

        {dirty ? (
          <div className="psy-profile-savebar" data-sticky-save>
            <div className="psy-profile-savebar__msg">Есть несохранённые изменения</div>
            <div className="psy-profile-savebar__actions">
              <button type="button" className="landing-btn landing-btn--ghost" onClick={discardChanges} disabled={saving}>
                Отменить
              </button>
              <button
                type="button"
                className="landing-btn landing-btn--primary"
                onClick={() => void saveProfile()}
                disabled={saving}
              >
                {saving ? 'Сохранение…' : 'Сохранить изменения'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {showDeleteModal ? (
        <div
          className="client-profile__modal-backdrop"
          onClick={() => {
            setShowDeleteModal(false);
            setDeleteConfirm('');
          }}
        >
          <div className="client-profile__modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>Удаление аккаунта</h3>
            <p>
              Это действие необратимо. Будут удалены профиль, дневник, сны, сессии и остальные данные.
            </p>
            <p className="client-profile__modal-hint">
              Для подтверждения введите слово <strong>удалить</strong>:
            </p>
            <input
              className="psy-profile-input"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="удалить"
              autoComplete="off"
            />
            <div className="client-profile__modal-actions">
              <button
                type="button"
                className="landing-btn landing-btn--ghost"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirm('');
                }}
                disabled={deleting}
              >
                Отмена
              </button>
              <button
                type="button"
                className="landing-btn client-profile__delete-confirm"
                onClick={() => void handleDeleteAccount()}
                disabled={deleting || deleteConfirm !== 'удалить'}
              >
                {deleting ? 'Удаление…' : 'Удалить аккаунт'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
