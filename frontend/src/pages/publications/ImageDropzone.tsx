import { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { resolvePublicFileUrl } from '../../lib/api';
import { uploadPublicationImage, type UploadKind } from '../../lib/publicationImageUpload';

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  kind?: UploadKind;
};

export function ImageDropzone({ label, value, onChange, kind = 'post' }: Props) {
  const { token } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const preview = resolvePublicFileUrl(value) || value;

  async function applyFile(file: File | undefined | null) {
    if (!file) return;
    if (!token) {
      setError('Войдите, чтобы загрузить изображение');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const url = await uploadPublicationImage(file, token, kind);
      onChange(url);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="forum__dropzone-wrap">
      <div className="small">{label}</div>
      <button
        type="button"
        className={`forum__dropzone${over ? ' is-over' : ''}${preview ? ' has-file' : ''}${busy ? ' is-busy' : ''}${kind === 'cover' ? ' forum__dropzone--cover' : ''}${kind === 'avatar' ? ' forum__dropzone--avatar' : ''}`}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void applyFile(e.dataTransfer.files?.[0]);
        }}
      >
        {busy ? (
          <span>Сжатие и загрузка…</span>
        ) : preview ? (
          <img src={preview} alt="" />
        ) : (
          <span>Перетащите изображение или нажмите, чтобы выбрать</span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(e) => {
          void applyFile(e.target.files?.[0]);
          e.currentTarget.value = '';
        }}
      />
      {error ? <div className="forum__error" style={{ marginBottom: 0 }}>{error}</div> : null}
      {value ? (
        <button type="button" className="forum__stat" disabled={busy} onClick={() => onChange('')}>
          Убрать
        </button>
      ) : null}
    </div>
  );
}
