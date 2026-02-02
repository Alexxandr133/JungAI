import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';

type Area = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type AvatarUploadProps = {
  currentAvatarUrl: string | null;
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
  userName?: string;
  userEmail?: string;
};

export function AvatarUpload({ currentAvatarUrl, onUpload, uploading, userName, userEmail }: AvatarUploadProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);

  // Формируем URL для отображения аватара
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

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }

    // Проверяем размер (5 МБ)
    if (file.size > 5 * 1024 * 1024) {
      alert('Размер файла не должен превышать 5 МБ');
      return;
    }

    // Создаем URL для предпросмотра
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setShowCropModal(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const createImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });
  };

  const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.SQRT2);

    canvas.width = safeArea;
    canvas.height = safeArea;

    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.translate(-safeArea / 2, -safeArea / 2);

    ctx.drawImage(
      image,
      safeArea / 2 - image.width * 0.5,
      safeArea / 2 - image.height * 0.5
    );

    const data = ctx.getImageData(0, 0, safeArea, safeArea);

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.putImageData(
      data,
      Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
      Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Canvas is empty');
        }
        resolve(blob);
      }, 'image/jpeg', 0.9);
    });
  };

  const handleCropComplete = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      const file = new File([croppedImage], 'avatar.jpg', { type: 'image/jpeg' });
      await onUpload(file);
      setShowCropModal(false);
      setImageSrc(null);
    } catch (error) {
      console.error('Error cropping image:', error);
      alert('Ошибка при обработке изображения');
    }
  };

  const handleCancel = () => {
    setShowCropModal(false);
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const displayName = userName || (userEmail || '').split('@')[0] || 'U';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';
  const avatarUrl = getAvatarUrl(currentAvatarUrl);
  
  // Отладочная информация
  console.log('AvatarUpload - currentAvatarUrl:', currentAvatarUrl);
  console.log('AvatarUpload - avatarUrl (formatted):', avatarUrl);

  return (
    <>
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: 0, marginBottom: 20, fontSize: 20, fontWeight: 700 }}>Аватар</h2>
        
        {/* Текущий аватар - отображается полностью */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          {avatarUrl ? (
            <img 
              key={avatarUrl} // Принудительное обновление при изменении URL
              src={avatarUrl} 
              alt="Аватар"
              style={{ 
                width: '100%', 
                maxWidth: 300, 
                height: 'auto', 
                borderRadius: 12, 
                objectFit: 'contain',
                border: '1px solid rgba(255,255,255,0.12)'
              }}
              onError={(e) => {
                console.error('Failed to load avatar in profile:', avatarUrl);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
              onLoad={() => {
                console.log('Avatar loaded successfully in profile:', avatarUrl);
              }}
            />
          ) : (
            <div style={{ 
              width: '100%', 
              maxWidth: 300, 
              aspectRatio: '1/1',
              borderRadius: 12, 
              background: 'linear-gradient(135deg, var(--primary), var(--accent))', 
              color: '#0b0f1a', 
              display: 'grid', 
              placeItems: 'center', 
              fontWeight: 800, 
              fontSize: 64,
              border: '1px solid rgba(255,255,255,0.12)'
            }}>
              {initial}
            </div>
          )}
        </div>

        {/* Кнопка загрузки */}
        <div>
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            id="avatar-upload-input"
          />
          <label 
            htmlFor="avatar-upload-input"
            className="button"
            style={{ 
              display: 'inline-block', 
              padding: '10px 20px', 
              fontSize: 14, 
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            {uploading ? 'Загрузка...' : currentAvatarUrl ? 'Изменить аватар' : 'Загрузить аватар'}
          </label>
          <div className="small" style={{ marginTop: 8, color: 'var(--text-muted)' }}>
            Поддерживаемые форматы: JPG, PNG (макс. 5 МБ)
          </div>
        </div>
      </div>

      {/* Модальное окно для кропа */}
      {showCropModal && imageSrc && (
        <div 
          onClick={handleCancel}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.9)', 
            display: 'grid', 
            placeItems: 'center', 
            padding: 16, 
            zIndex: 10000 
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ 
              width: 'min(90vw, 600px)', 
              maxHeight: '90vh',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}
          >
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Выберите область для аватара</h3>
            
            <div style={{ 
              position: 'relative', 
              width: '100%', 
              height: 400, 
              background: '#000',
              borderRadius: 12,
              overflow: 'hidden'
            }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="round"
                showGrid={false}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <label className="small" style={{ minWidth: 60 }}>Масштаб:</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span className="small" style={{ minWidth: 40, textAlign: 'right' }}>{zoom.toFixed(1)}x</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button 
                className="button secondary" 
                onClick={handleCancel}
                disabled={uploading}
                style={{ padding: '10px 20px', fontSize: 14 }}
              >
                Отмена
              </button>
              <button 
                className="button" 
                onClick={handleCropComplete}
                disabled={uploading || !croppedAreaPixels}
                style={{ padding: '10px 20px', fontSize: 14 }}
              >
                {uploading ? 'Загрузка...' : 'Применить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

