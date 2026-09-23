import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PROFILE_TAG_SUGGESTIONS, isProfileTag, searchProfileTags } from 'jungai-shared';
import { useAuth } from '../../context/AuthContext';
import { api, resolvePublicFileUrl } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { clearVerificationCache } from '../../utils/verification';
import { EmailChangeFlow } from '../../components/EmailChangeFlow';
import {
  PHONE_COUNTRIES,
  composePhone,
  digitsOnly,
  formatNationalNumber,
  isPhoneComplete,
  parseStoredPhone,
  type PhoneCountryCode,
} from '../../lib/phoneFormat';
import {
  PsychologistPublicCard,
  PROFILE_ACCENT_PRESETS,
} from '../../components/PsychologistPublicCard';
import { PsychologistPublicBody } from '../../components/PsychologistPublicBody';
import '../../styles/landing-tokens.css';
import './Profile.css';

const BIO_MAX = 600;

function normalizeAccent(value: string | null | undefined): string {
  const v = String(value || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v) && (PROFILE_ACCENT_PRESETS as readonly string[]).includes(v)) {
    return v;
  }
  return PROFILE_ACCENT_PRESETS[0];
}

function withCacheBust(url: string | null, rev: number): string | null {
  if (!url) return null;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  const base = resolvePublicFileUrl(url) || url;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}v=${rev}`;
}

type EduDraft = {
  id?: string;
  kind: string;
  institution: string;
  title: string;
  yearFrom: string;
  yearTo: string;
};

type Snapshot = {
  name: string;
  phoneCountry: PhoneCountryCode;
  phoneNational: string;
  location: string;
  bio: string;
  specialization: string;
  experience: string;
  sessionPriceRub: string;
  worksWith: string[];
  audienceFormats: string[];
  educations: EduDraft[];
  accentColor: string;
  avatarUrl: string | null;
  coverUrl: string | null;
};

function emptyEdu(): EduDraft {
  return {
    kind: 'higher',
    institution: '',
    title: '',
    yearFrom: String(new Date().getFullYear()),
    yearTo: '',
  };
}

function snapshotEqual(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function PsychologistProfile() {
  const { token, refreshProfile, user } = useAuth();

  const [name, setName] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountryCode>('RU');
  const [phoneNational, setPhoneNational] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [experience, setExperience] = useState('');
  const [sessionPriceRub, setSessionPriceRub] = useState('');
  const [worksWithSelected, setWorksWithSelected] = useState<string[]>([]);
  const [tagQuery, setTagQuery] = useState('');
  const [audienceFormats, setAudienceFormats] = useState<string[]>(['self']);
  const [educations, setEducations] = useState<EduDraft[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string>(PROFILE_ACCENT_PRESETS[0]);
  const [mediaRev, setMediaRev] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [verificationComment, setVerificationComment] = useState<string | null>(null);
  const [verificationDocument, setVerificationDocument] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<Snapshot | null>(null);
  const [acceptingClients, setAcceptingClients] = useState(true);
  const [savingSearch, setSavingSearch] = useState(false);

  const phoneCountryMeta = useMemo(
    () => PHONE_COUNTRIES.find((c) => c.code === phoneCountry) || PHONE_COUNTRIES[0],
    [phoneCountry]
  );
  const phoneDisplay = formatNationalNumber(phoneNational, phoneCountryMeta.nationalLength);
  const phoneE164 = composePhone(phoneCountryMeta.dial, phoneNational);

  const currentSnapshot = useMemo<Snapshot>(
    () => ({
      name,
      phoneCountry,
      phoneNational,
      location,
      bio,
      specialization,
      experience,
      sessionPriceRub,
      worksWith: [...worksWithSelected].sort(),
      audienceFormats: [...audienceFormats].sort(),
      educations,
      accentColor: normalizeAccent(accentColor),
      avatarUrl,
      coverUrl: coverUrl?.startsWith('blob:') ? null : coverUrl,
    }),
    [
      name,
      phoneCountry,
      phoneNational,
      location,
      bio,
      specialization,
      experience,
      sessionPriceRub,
      worksWithSelected,
      audienceFormats,
      educations,
      accentColor,
      avatarUrl,
      coverUrl,
    ]
  );

  const dirty = savedSnapshot != null && !snapshotEqual(currentSnapshot, savedSnapshot);

  const completeness = useMemo(() => {
    const items = [
      { key: 'photo', label: 'Фото', done: Boolean(avatarUrl) },
      { key: 'cover', label: 'Обложка', done: Boolean(coverUrl) },
      { key: 'bio', label: 'О себе ≥ 200 символов', done: bio.trim().length >= 200 },
      { key: 'tags', label: 'Теги ≥ 3', done: worksWithSelected.length >= 3 },
      {
        key: 'edu',
        label: 'Образование ≥ 1',
        done: educations.some((e) => e.title.trim() && e.institution.trim() && e.yearFrom.trim()),
      },
      {
        key: 'price',
        label: 'Стоимость > 0',
        done: Number(sessionPriceRub) > 0,
      },
    ] as const;
    const doneCount = items.filter((i) => i.done).length;
    return { items, doneCount, total: items.length };
  }, [avatarUrl, coverUrl, bio, worksWithSelected, educations, sessionPriceRub]);

  const tagResults = useMemo(() => {
    const q = tagQuery.trim();
    if (q) return searchProfileTags(q, 20);
    return PROFILE_TAG_SUGGESTIONS.filter((t) => !worksWithSelected.includes(t));
  }, [tagQuery, worksWithSelected]);

  useEffect(() => {
    if (token) {
      void loadProfile();
      void loadVerificationStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function applySnapshot(s: Snapshot, verified: boolean) {
    setName(s.name);
    setPhoneCountry(s.phoneCountry);
    setPhoneNational(s.phoneNational);
    setLocation(s.location);
    setBio(s.bio);
    setSpecialization(s.specialization);
    setExperience(s.experience);
    setSessionPriceRub(s.sessionPriceRub);
    setWorksWithSelected(s.worksWith);
    setAudienceFormats(s.audienceFormats.length ? s.audienceFormats : ['self']);
    setEducations(s.educations);
    setAccentColor(s.accentColor);
    setAvatarUrl(s.avatarUrl);
    setCoverUrl(s.coverUrl);
    setIsVerified(verified);
    setSavedSnapshot({
      ...s,
      worksWith: [...s.worksWith].sort(),
      audienceFormats: [...s.audienceFormats].sort(),
    });
  }

  async function loadProfile() {
    if (!token) return;
    try {
      const res = await api<{
        name?: string;
        phone?: string;
        location?: string;
        bio?: string;
        specialization?: string;
        experience?: string;
        sessionPriceRub?: number | null;
        therapyMethod?: string;
        worksWith?: string[];
        audienceFormats?: string[];
        educations?: Array<{
          id: string;
          kind: string;
          institution: string;
          title: string;
          yearFrom: number;
          yearTo: number | null;
        }>;
        avatarUrl?: string | null;
        coverUrl?: string | null;
        accentColor?: string | null;
        isVerified?: boolean;
        acceptingClients?: boolean;
      }>('/api/psychologist/profile', { token });

      const parsed = parseStoredPhone(res.phone || '');
      const knownTags = (res.worksWith || []).filter((t) => isProfileTag(t));
      const snap: Snapshot = {
        name: res.name || '',
        phoneCountry: parsed.countryCode,
        phoneNational: parsed.nationalDigits,
        location: res.location || '',
        bio: res.bio || '',
        specialization: res.specialization || res.therapyMethod || '',
        experience: res.experience || '',
        sessionPriceRub: res.sessionPriceRub != null ? String(res.sessionPriceRub) : '',
        worksWith: knownTags,
        audienceFormats: res.audienceFormats?.length ? res.audienceFormats : ['self'],
        educations: (res.educations || []).map((e) => ({
          id: e.id,
          kind: e.kind,
          institution: e.institution,
          title: e.title,
          yearFrom: String(e.yearFrom),
          yearTo: e.yearTo != null ? String(e.yearTo) : '',
        })),
        accentColor: normalizeAccent(res.accentColor),
        avatarUrl: res.avatarUrl || null,
        coverUrl: res.coverUrl || null,
      };
      applySnapshot(snap, Boolean(res.isVerified));
      setAcceptingClients(res.acceptingClients !== false);
      setMediaRev((n) => n + 1);
    } catch (e) {
      console.error('Failed to load profile:', e);
    }
  }

  async function loadVerificationStatus() {
    if (!token) return;
    try {
      const res = await api<{ status: string; comment?: string | null }>(
        '/api/psychologist/verification/status',
        { token }
      );
      setVerificationStatus((res.status as typeof verificationStatus) || 'none');
      setVerificationComment(res.comment || null);
    } catch {
      setVerificationStatus('none');
    }
  }

  async function toggleAcceptingClients(next: boolean) {
    if (!token || savingSearch) return;
    const prev = acceptingClients;
    setAcceptingClients(next);
    setSavingSearch(true);
    setError(null);
    try {
      await api('/api/psychologist/profile', {
        method: 'PUT',
        token,
        body: { acceptingClients: next },
      });
      setStatus(next ? 'Поиск клиентов включён' : 'Поиск клиентов выключен — вас нет в каталоге и подборе');
    } catch (e: unknown) {
      setAcceptingClients(prev);
      setError(e instanceof Error ? e.message : 'Не удалось сохранить статус поиска');
    } finally {
      setSavingSearch(false);
    }
  }

  async function saveProfile() {
    if (!token) return;
    if (
      phoneNational.length > 0 &&
      !isPhoneComplete(phoneCountryMeta.dial, phoneNational, phoneCountryMeta.nationalLength)
    ) {
      setError(`Укажите номер полностью: ${phoneCountryMeta.nationalLength} цифр после кода страны — или очистите поле`);
      return;
    }

    const eduPayload: Array<{
      kind: string;
      institution: string;
      title: string;
      yearFrom: number;
      yearTo: number | null;
    }> = [];
    for (let i = 0; i < educations.length; i++) {
      const ed = educations[i];
      const institution = ed.institution.trim();
      const title = ed.title.trim();
      const yearFromRaw = ed.yearFrom.trim();
      const yearToRaw = ed.yearTo.trim();
      // «+» подставляет год — пустая карточка без названия/вуза не считается заполненной
      if (!institution && !title) continue;
      if (!institution || !title) {
        setError(`Образование №${i + 1}: заполните название программы и учебное заведение`);
        return;
      }
      if (!/^\d{4}$/.test(yearFromRaw)) {
        setError(`Образование №${i + 1}: укажите год начала четырьмя цифрами`);
        return;
      }
      const yearFrom = Number(yearFromRaw);
      if (yearFrom < 1950 || yearFrom > 2100) {
        setError(`Образование №${i + 1}: год начала вне допустимого диапазона`);
        return;
      }
      let yearTo: number | null = null;
      if (yearToRaw) {
        if (!/^\d{4}$/.test(yearToRaw)) {
          setError(`Образование №${i + 1}: год окончания — 4 цифры или пусто`);
          return;
        }
        yearTo = Number(yearToRaw);
        if (yearTo < yearFrom || yearTo > 2100) {
          setError(`Образование №${i + 1}: год окончания не может быть раньше года начала`);
          return;
        }
      }
      eduPayload.push({ kind: ed.kind, institution, title, yearFrom, yearTo });
    }

    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const accentToSave = normalizeAccent(accentColor);
      await api('/api/psychologist/profile', {
        method: 'PUT',
        token,
        body: {
          name,
          phone: phoneNational.length ? phoneE164 || null : null,
          location,
          bio: bio.slice(0, BIO_MAX),
          specialization,
          therapyMethod: specialization,
          experience,
          sessionPriceRub: sessionPriceRub === '' ? null : Number(sessionPriceRub),
          worksWith: worksWithSelected,
          audienceFormats,
          accentColor: accentToSave,
          acceptingClients,
        },
      });
      const eduRes = await api<{
        educations?: Array<{
          id: string;
          kind: string;
          institution: string;
          title: string;
          yearFrom: number;
          yearTo: number | null;
        }>;
      }>('/api/psychologist/profile/educations', {
        method: 'PUT',
        token,
        body: { educations: eduPayload },
      });
      const savedEducations: EduDraft[] = (eduRes.educations || []).map((e) => ({
        id: e.id,
        kind: e.kind,
        institution: e.institution,
        title: e.title,
        yearFrom: String(e.yearFrom),
        yearTo: e.yearTo != null ? String(e.yearTo) : '',
      }));
      setEducations(savedEducations);
      setAccentColor(accentToSave);
      const nextSnap: Snapshot = {
        ...currentSnapshot,
        accentColor: accentToSave,
        educations: savedEducations,
        worksWith: [...worksWithSelected].sort(),
        audienceFormats: [...audienceFormats].sort(),
        coverUrl: coverUrl?.startsWith('blob:') ? savedSnapshot?.coverUrl ?? null : coverUrl,
      };
      setSavedSnapshot(nextSnap);
      setStatus('Профиль сохранён');
      await refreshProfile();
      // Не вызываем loadProfile() сразу: при ошибке/пустом GET он затирал только что сохранённые образования.
      // Ответ PUT /educations — источник правды для списка.
      setTimeout(() => setStatus(null), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    if (!savedSnapshot) return;
    applySnapshot(savedSnapshot, isVerified);
    setError(null);
    setTagQuery('');
  }

  function toggleAudience(id: string) {
    setAudienceFormats((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleWorkTopic(t: string) {
    setWorksWithSelected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function onPhoneCountryChange(code: PhoneCountryCode) {
    const next = PHONE_COUNTRIES.find((c) => c.code === code) || PHONE_COUNTRIES[0];
    setPhoneCountry(code);
    setPhoneNational((prev) => digitsOnly(prev).slice(0, next.nationalLength));
  }

  function onPhoneNationalChange(raw: string) {
    setPhoneNational(digitsOnly(raw).slice(0, phoneCountryMeta.nationalLength));
  }

  async function uploadAvatar(file: File) {
    if (!token) return;
    setUploadingAvatar(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api<{ avatarUrl: string }>('/api/psychologist/profile/avatar', {
        method: 'POST',
        token,
        body: formData,
      });
      setAvatarUrl(res.avatarUrl);
      setMediaRev((n) => n + 1);
      setSavedSnapshot((prev) => (prev ? { ...prev, avatarUrl: res.avatarUrl } : prev));
      setStatus('Аватар загружен');
      await refreshProfile();
      setTimeout(() => setStatus(null), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить аватар');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function uploadCover(file: File) {
    if (!token) return;
    const localPreview = URL.createObjectURL(file);
    setCoverUrl(localPreview);
    setMediaRev((n) => n + 1);
    setUploadingCover(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('cover', file);
      const res = await api<{ coverUrl: string }>('/api/psychologist/profile/cover', {
        method: 'POST',
        token,
        body: formData,
      });
      URL.revokeObjectURL(localPreview);
      setCoverUrl(res.coverUrl);
      setMediaRev((n) => n + 1);
      setSavedSnapshot((prev) => (prev ? { ...prev, coverUrl: res.coverUrl } : prev));
      setStatus('Обложка сохранена сразу — можно не жать «Сохранить»');
      setTimeout(() => setStatus(null), 4000);
    } catch (e: unknown) {
      URL.revokeObjectURL(localPreview);
      setCoverUrl(savedSnapshot?.coverUrl ?? null);
      setError(e instanceof Error ? e.message : 'Не удалось загрузить обложку');
    } finally {
      setUploadingCover(false);
    }
  }

  async function removeCover() {
    if (!token) return;
    try {
      await api('/api/psychologist/profile/cover', { method: 'DELETE', token });
      setCoverUrl(null);
      setMediaRev((n) => n + 1);
      setSavedSnapshot((prev) => (prev ? { ...prev, coverUrl: null } : prev));
      setStatus('Обложка удалена');
      setTimeout(() => setStatus(null), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить обложку');
    }
  }

  async function uploadVerificationDocument(e: FormEvent) {
    e.preventDefault();
    if (!verificationDocument || !token) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('document', verificationDocument);
      await api('/api/psychologist/verification/submit', {
        method: 'POST',
        token,
        body: formData,
      });
      setStatus('Документ загружен и отправлен на проверку');
      setVerificationDocument(null);
      setVerificationStatus('pending');
      clearVerificationCache();
      setTimeout(() => setStatus(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить документ');
    } finally {
      setUploading(false);
    }
  }

  const avatarSrc = withCacheBust(avatarUrl, mediaRev);
  const coverSrc = withCacheBust(coverUrl, mediaRev);
  const accentNormalized = normalizeAccent(accentColor);

  const verificationBadge = (() => {
    if (isVerified || verificationStatus === 'approved') {
      return <span className="psy-profile-badge psy-profile-badge--ok">Верифицирован</span>;
    }
    if (verificationStatus === 'pending') {
      return <span className="psy-profile-badge psy-profile-badge--pending">На проверке</span>;
    }
    if (verificationStatus === 'rejected') {
      return <span className="psy-profile-badge psy-profile-badge--rej">Отклонено</span>;
    }
    return <span className="psy-profile-badge psy-profile-badge--none">Не верифицирован</span>;
  })();

  const previewEducations = useMemo(
    () =>
      educations
        .filter((e) => e.title.trim() && e.institution.trim() && e.yearFrom.trim())
        .map((e, i) => ({
          id: e.id || `draft-${i}`,
          kind: e.kind,
          institution: e.institution,
          title: e.title,
          yearFrom: Number(e.yearFrom) || 0,
          yearTo: e.yearTo === '' ? null : Number(e.yearTo) || null,
        })),
    [educations]
  );

  const cardPreview = (
    <div className="psy-profile-live-preview">
      <PsychologistPublicCard
        compact
        showCta
        onBookClick={() => undefined}
        data={{
          name: name || 'Без имени',
          specialization: specialization ? [specialization] : [],
          therapyMethod: specialization || null,
          experience: experience ? parseInt(experience, 10) || 0 : 0,
          avatarUrl: avatarSrc,
          coverUrl: coverSrc,
          accentColor: accentNormalized,
          sessionPriceRub: sessionPriceRub === '' ? null : Number(sessionPriceRub),
          verified: isVerified || verificationStatus === 'approved',
        }}
      />
      <PsychologistPublicBody
        compact
        data={{
          bio,
          worksWith: worksWithSelected,
          audienceFormats,
          educations: previewEducations,
        }}
      />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />

      <div className={`landing psy-profile-editor${dirty ? ' is-dirty' : ''}`}>
        <h1 className="psy-profile-editor__title">Профиль</h1>
        <p className="psy-profile-editor__lead">Публичная карточка для клиентов и настройки аккаунта</p>

        {status ? <div className="psy-profile-alert psy-profile-alert--ok">{status}</div> : null}
        {error ? <div className="psy-profile-alert psy-profile-alert--err">{error}</div> : null}

        {!isVerified && verificationStatus !== 'approved' ? (
          <div className="psy-profile-verify">
            <h2>Верификация аккаунта</h2>
            <p>
              Чтобы попасть в каталог и подбор клиентов, загрузите документ о квалификации (диплом,
              сертификат, лицензию). Администратор проверит его и откроет доступ.
            </p>
            {verificationStatus === 'pending' ? (
              <p className="landing-small">Документ на проверке — можно продолжать заполнять профиль.</p>
            ) : null}
            {verificationStatus === 'rejected' ? (
              <div style={{ marginBottom: 12 }}>
                <p className="landing-small" style={{ color: '#b42318' }}>
                  Запрос отклонён. Загрузите новый документ.
                </p>
                {verificationComment ? (
                  <p className="landing-small" style={{ marginTop: 6 }}>
                    Комментарий: {verificationComment}
                  </p>
                ) : null}
              </div>
            ) : null}
            <form onSubmit={uploadVerificationDocument} style={{ display: 'grid', gap: 12 }}>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="psy-profile-input"
                onChange={(e) => setVerificationDocument(e.target.files?.[0] || null)}
              />
              <div>
                <button
                  type="submit"
                  className="landing-btn landing-btn--primary"
                  disabled={!verificationDocument || uploading}
                >
                  {uploading ? 'Загрузка…' : 'Отправить на проверку'}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="psy-profile-editor__layout">
          <div className="psy-profile-editor__form-col">
            <section className="psy-profile-zone" aria-labelledby="public-zone-title">
              <div className="psy-profile-zone__head">
                <div>
                  <p className="psy-profile-zone__eyebrow">Это видят клиенты</p>
                  <h2 id="public-zone-title" className="psy-profile-zone__title">
                    Публичный профиль
                  </h2>
                  <p className="psy-profile-zone__subtitle">
                    Данные ниже попадают в каталог и на страницу вашего профиля
                  </p>
                  <div className="psy-profile-search">
                    <div className="psy-profile-search__status">
                      Поиск клиентов:{' '}
                      <strong>{acceptingClients ? 'включён' : 'выключен'}</strong>
                    </div>
                    <div className="psy-profile-search__switch" role="group" aria-label="Поиск клиентов">
                      <button
                        type="button"
                        className={`psy-profile-search__btn${acceptingClients ? ' is-on' : ''}`}
                        disabled={savingSearch}
                        onClick={() => void toggleAcceptingClients(true)}
                      >
                        Включён
                      </button>
                      <button
                        type="button"
                        className={`psy-profile-search__btn${!acceptingClients ? ' is-off' : ''}`}
                        disabled={savingSearch}
                        onClick={() => void toggleAcceptingClients(false)}
                      >
                        Выключен
                      </button>
                    </div>
                    <p className="psy-profile-search__hint">
                      {acceptingClients
                        ? 'Вас видно в каталоге и в анкете подбора.'
                        : 'Вас нет в каталоге и в подборе. Прямая ссылка на страницу работает.'}
                    </p>
                  </div>
                </div>
                <div className="psy-profile-complete" aria-live="polite">
                  <p className="psy-profile-complete__progress">
                    Заполнено {completeness.doneCount} из {completeness.total}
                  </p>
                  <div className="psy-profile-complete__bar" aria-hidden>
                    <span style={{ width: `${(completeness.doneCount / completeness.total) * 100}%` }} />
                  </div>
                  <ul className="psy-profile-complete__list">
                    {completeness.items.map((item) => (
                      <li key={item.key} className={item.done ? 'is-done' : undefined}>
                        <span aria-hidden>{item.done ? '✓' : '○'}</span>
                        {item.label}
                      </li>
                    ))}
                  </ul>
                  <p className="psy-profile-complete__hint">Заполненные профили получают больше записей</p>
                </div>
              </div>

              <div className="psy-profile-section">
                <h3 className="psy-profile-section__title">Карточка в каталоге</h3>
                <p className="psy-profile-section__help">
                  Фото, имя, метод, цена и теги — то, что клиент видит первым.
                </p>

                <div className="psy-profile-avatar-row" style={{ marginBottom: 18 }}>
                  <div className="psy-profile-avatar">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="" />
                    ) : (
                      <span aria-hidden>{(name || '?').trim().charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="psy-profile-avatar-meta">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      id="avatar-upload-input"
                      style={{ display: 'none' }}
                      disabled={uploadingAvatar}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadAvatar(file);
                        e.target.value = '';
                      }}
                    />
                    <label
                      htmlFor="avatar-upload-input"
                      className={`psy-profile-file-btn${uploadingAvatar ? ' is-busy' : ''}`}
                    >
                      {uploadingAvatar ? 'Загрузка…' : avatarUrl ? 'Изменить фото' : 'Загрузить фото'}
                    </label>
                    <p className="psy-profile-section__help" style={{ margin: '10px 0 0' }}>
                      Таким вас видят в каталоге
                    </p>
                    {verificationBadge}
                  </div>
                </div>

                <div className="psy-profile-fields">
                  <div className="psy-profile-field">
                    <label htmlFor="psy-name">ФИО</label>
                    <input
                      id="psy-name"
                      className="psy-profile-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Фамилия Имя Отчество"
                      autoComplete="name"
                    />
                  </div>
                  <div className="psy-profile-field">
                    <label htmlFor="psy-method">Метод / подход</label>
                    <input
                      id="psy-method"
                      className="psy-profile-input"
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      placeholder="Например: юнгианская аналитическая психология"
                    />
                  </div>
                  <div className="psy-profile-fields psy-profile-fields--2">
                    <div className="psy-profile-field">
                      <label htmlFor="psy-price">Стоимость сессии, ₽</label>
                      <input
                        id="psy-price"
                        className="psy-profile-input"
                        value={sessionPriceRub}
                        onChange={(e) => setSessionPriceRub(e.target.value.replace(/[^\d]/g, ''))}
                        placeholder="4500"
                        inputMode="numeric"
                      />
                      <p className="psy-profile-section__help" style={{ marginTop: 6, marginBottom: 0 }}>
                        Клиент видит цену до записи — в карточке и в профиле
                      </p>
                    </div>
                    <div className="psy-profile-field">
                      <label htmlFor="psy-exp">Опыт работы, лет</label>
                      <input
                        id="psy-exp"
                        className="psy-profile-input"
                        value={experience}
                        onChange={(e) => setExperience(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                        placeholder="10"
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  <div className="psy-profile-field">
                    <label htmlFor="psy-tag-search">С чем работаете</label>
                    <p className="psy-profile-section__help">
                      Большой словарь тем — ищите по слову и добавляйте. Выбранные видны сверху.
                    </p>
                    {worksWithSelected.length > 0 ? (
                      <div className="psy-profile-tags psy-profile-tags--selected" role="list">
                        {worksWithSelected.map((t) => (
                          <button
                            key={t}
                            type="button"
                            role="listitem"
                            className="psy-profile-tag is-on"
                            onClick={() => toggleWorkTopic(t)}
                            aria-label={`Убрать «${t}»`}
                          >
                            {t}
                            <span className="psy-profile-tag__x" aria-hidden>
                              ×
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <input
                      id="psy-tag-search"
                      className="psy-profile-input psy-profile-tag-search"
                      value={tagQuery}
                      onChange={(e) => setTagQuery(e.target.value)}
                      placeholder="Начните вводить тему: тревога, травма, пары…"
                      autoComplete="off"
                    />
                    <div className="psy-profile-tags" role="list">
                      {tagResults.length === 0 ? (
                        <p className="landing-small" style={{ margin: 0 }}>
                          {tagQuery.trim()
                            ? 'Ничего не найдено — попробуйте другое слово'
                            : 'Все популярные темы уже выбраны — ищите другие в поле выше'}
                        </p>
                      ) : (
                        tagResults.map((t) => {
                          const on = worksWithSelected.includes(t);
                          return (
                            <button
                              key={t}
                              type="button"
                              role="listitem"
                              className={`psy-profile-tag${on ? ' is-on' : ''}`}
                              onClick={() => {
                                toggleWorkTopic(t);
                                if (!on) setTagQuery('');
                              }}
                              aria-pressed={on}
                            >
                              {t}
                              {on ? <span className="psy-profile-tag__x" aria-hidden>×</span> : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                    {!tagQuery.trim() ? (
                      <p className="psy-profile-section__help" style={{ marginTop: 8, marginBottom: 0 }}>
                        Показаны популярные темы. В словаре больше ста — начните поиск, чтобы найти нужную.
                      </p>
                    ) : null}
                    <p className="psy-profile-section__help" style={{ marginTop: 8, marginBottom: 0 }}>
                      Выбрано {worksWithSelected.length} · для полноты нужно минимум 3
                    </p>
                  </div>
                </div>
              </div>

              <div className="psy-profile-section">
                <h3 className="psy-profile-section__title">О себе и подходе</h3>
                <div className="psy-profile-fields">
                  <div className="psy-profile-field">
                    <label htmlFor="psy-bio">О себе</label>
                    <p className="psy-profile-section__help">
                      2–4 предложения: ваш подход, с чем работаете, как проходит первая встреча. Это
                      первый текст, который читает клиент после имени
                    </p>
                    <textarea
                      id="psy-bio"
                      className="psy-profile-textarea"
                      value={bio}
                      maxLength={BIO_MAX}
                      onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                      rows={6}
                      placeholder="Кратко о подходе и том, как проходит первая встреча"
                    />
                    <div className={`psy-profile-counter${bio.length >= BIO_MAX ? ' is-warn' : ''}`}>
                      {bio.length}/{BIO_MAX}
                    </div>
                  </div>
                  <div className="psy-profile-field">
                    <label>С кем работаете</label>
                    <p className="psy-profile-section__help">
                      На публичной странице выводится как «Формат работы: индивидуально · с парами · с
                      детьми»
                    </p>
                    <div className="psy-profile-audience">
                      {(
                        [
                          ['self', 'Индивидуально'],
                          ['couple', 'С парами'],
                          ['child', 'С детьми'],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          className={`psy-profile-chip${audienceFormats.includes(id) ? ' is-on' : ''}`}
                          onClick={() => toggleAudience(id)}
                          aria-pressed={audienceFormats.includes(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="psy-profile-section">
                <div className="psy-profile-edu-actions">
                  <h3 className="psy-profile-section__title" style={{ margin: 0 }}>
                    Образование и курсы
                  </h3>
                  <button
                    type="button"
                    className="landing-btn landing-btn--secondary"
                    style={{ padding: '8px 14px', fontSize: 13 }}
                    onClick={() => setEducations((prev) => [...prev, emptyEdu()])}
                  >
                    + Добавить
                  </button>
                </div>
                <p className="psy-profile-section__help">
                  Образование показывается клиентам — это маркер доверия
                </p>
                <div className="psy-profile-edu">
                  {educations.map((ed, idx) => (
                    <div key={ed.id || idx} className="psy-profile-edu-card">
                      <div className="psy-profile-fields psy-profile-fields--2">
                        <select
                          className="psy-profile-select"
                          value={ed.kind}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEducations((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, kind: v } : x))
                            );
                          }}
                        >
                          <option value="higher">Высшее</option>
                          <option value="course">Курс</option>
                          <option value="other">Другое</option>
                        </select>
                        <input
                          className="psy-profile-input"
                          value={ed.title}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEducations((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, title: v } : x))
                            );
                          }}
                          placeholder="Название программы / специальности"
                        />
                      </div>
                      <input
                        className="psy-profile-input"
                        value={ed.institution}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEducations((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, institution: v } : x))
                          );
                        }}
                        placeholder="Учебное заведение / организатор"
                      />
                      <div className="psy-profile-fields psy-profile-fields--2">
                        <input
                          className="psy-profile-input"
                          value={ed.yearFrom}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
                            setEducations((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, yearFrom: v } : x))
                            );
                          }}
                          placeholder="Год начала"
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            className="psy-profile-input"
                            value={ed.yearTo}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
                              setEducations((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, yearTo: v } : x))
                              );
                            }}
                            placeholder="Год окончания (пусто = н.в.)"
                          />
                          <button
                            type="button"
                            className="landing-btn landing-btn--ghost"
                            style={{ padding: '8px 12px', flexShrink: 0 }}
                            onClick={() => setEducations((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {educations.length === 0 ? (
                    <p className="landing-small">Пока нет записей — добавьте хотя бы одно образование.</p>
                  ) : null}
                </div>
              </div>

              <div className="psy-profile-section">
                <h3 className="psy-profile-section__title">Оформление</h3>
                <div className="psy-profile-cover-preview">
                  {coverSrc ? <img src={coverSrc} alt="" /> : null}
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  id="cover-upload-input"
                  style={{ display: 'none' }}
                  disabled={uploadingCover}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadCover(file);
                    e.target.value = '';
                  }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  <label
                    htmlFor="cover-upload-input"
                    className={`psy-profile-file-btn${uploadingCover ? ' is-busy' : ''}`}
                  >
                    {uploadingCover ? 'Загрузка…' : coverUrl ? 'Сменить обложку' : 'Загрузить обложку'}
                  </label>
                  {coverUrl ? (
                    <button
                      type="button"
                      className="landing-btn landing-btn--ghost"
                      style={{ padding: '10px 16px' }}
                      onClick={() => void removeCover()}
                    >
                      Убрать обложку
                    </button>
                  ) : null}
                </div>
                <p className="psy-profile-section__help">
                  Акцент — это кнопка «Записаться», выбранный слот и цена на вашей публичной странице
                </p>
                <div className="psy-profile-accents" role="radiogroup" aria-label="Акцентный цвет">
                  {PROFILE_ACCENT_PRESETS.map((c) => {
                    const on = accentNormalized === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        className={`psy-profile-accent${on ? ' is-on' : ''}`}
                        style={{ ['--swatch' as string]: c, backgroundColor: c }}
                        aria-label={`Акцент ${c}`}
                        aria-checked={on}
                        onClick={() => setAccentColor(c)}
                      />
                    );
                  })}
                </div>
                <p className="psy-profile-section__help" style={{ marginTop: 10, marginBottom: 0 }}>
                  В превью справа меняются цена и кнопка «Записаться». Не забудьте сохранить.
                </p>
              </div>
            </section>

            <section className="psy-profile-zone psy-profile-zone--account" aria-labelledby="account-zone-title">
              <p className="psy-profile-zone__eyebrow">Только для вас</p>
              <h2 id="account-zone-title" className="psy-profile-zone__title" style={{ fontSize: 20 }}>
                Аккаунт
              </h2>
              <p className="psy-profile-zone__subtitle" style={{ marginBottom: 16 }}>
                Контакты и доступ — не отображаются в каталоге
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
                  <div className="psy-profile-account-label">Локация</div>
                  <input
                    className="psy-profile-input"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Город, страна"
                    style={{ marginTop: 4, maxWidth: 360 }}
                  />
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

              <div className="psy-profile-account-row">
                <div>
                  <div className="psy-profile-account-label">Уведомления</div>
                  <p className="psy-profile-account-note">
                    Заявки и сообщения приходят в колокольчик в шапке кабинета.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <aside className="psy-profile-editor__preview" aria-label="Предпросмотр">
            <p className="psy-profile-editor__preview-label">Так видит клиент</p>
            {cardPreview}
            {user?.id ? (
              <a
                href={`/psychologists/${user.id}`}
                target="_blank"
                rel="noreferrer"
                className="landing-btn landing-btn--tertiary psy-profile-editor__preview-link"
              >
                Открыть публичную страницу →
              </a>
            ) : null}
          </aside>
        </div>

        {showPreview ? (
          <div
            className="psy-profile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Предпросмотр профиля"
            onClick={() => setShowPreview(false)}
          >
            <div className="psy-profile-sheet__panel" onClick={(e) => e.stopPropagation()}>
              <div className="psy-profile-sheet__head">
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>Так профиль видит клиент</div>
                  <div className="landing-small">Live-превью по текущим полям формы</div>
                </div>
                <button
                  type="button"
                  className="landing-btn landing-btn--ghost"
                  onClick={() => setShowPreview(false)}
                >
                  Закрыть
                </button>
              </div>
              {cardPreview}
              {user?.id ? (
                <a
                  href={`/psychologists/${user.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="landing-btn landing-btn--tertiary"
                  style={{ display: 'inline-flex', marginTop: 14 }}
                >
                  Открыть публичную страницу →
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {dirty ? (
          <div className="psy-profile-savebar" data-sticky-save>
            <div className="psy-profile-savebar__msg">Есть несохранённые изменения</div>
            <div className="psy-profile-savebar__actions">
              <button
                type="button"
                className="landing-btn landing-btn--ghost"
                onClick={discardChanges}
                disabled={saving}
              >
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

      <button
        type="button"
        className={`psy-profile-fab${dirty ? ' psy-profile-fab--raised' : ''}`}
        onClick={() => setShowPreview(true)}
      >
        Предпросмотр
      </button>
    </div>
  );
}
