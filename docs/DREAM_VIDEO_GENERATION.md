# Визуализация снов клиентов в видео

## Теоретический обзор

Этот документ описывает, как можно реализовать генерацию коротких видео из текстовых описаний снов клиентов для создания "Тиктока снов".

## Архитектура решения

### 1. Процесс генерации видео

```
Описание сна → Промпт-инжиниринг → Text-to-Video API → Видео файл → Сохранение URL
```

### 2. Структура данных

**Модель Dream** (нужно добавить поле):
```prisma
model Dream {
  id        String   @id @default(cuid())
  title     String
  content   String
  symbols   Json
  videoUrl  String?  // ← НОВОЕ ПОЛЕ для URL сгенерированного видео
  userId    String?
  createdAt DateTime @default(now())
}
```

## Доступные Text-to-Video модели (2024)

### 1. **Runway Gen-3** ⭐ Рекомендуется
- **Длительность**: 4 секунды
- **Формат**: 16:9 или 9:16
- **API**: https://api.runwayml.com
- **Стоимость**: ~$0.05 за видео
- **Качество**: Очень высокое, кинематографическое
- **Особенности**: Поддержка image-to-video, text-to-video

**Пример промпта:**
```
Cinematic dream visualization: Кит плавал в воде, он был большим и красным, 
как будто бы он хотел с ним поговорить, surreal atmosphere, symbolic imagery, 
whale, water, red color, cinematic composition, soft focus, dreamy color palette, 
mystical ambiance, fluid camera movement, short 3-5 second loop
```

### 2. **Luma Dream Machine** 🆓 Бесплатный вариант
- **Длительность**: 5 секунд
- **Формат**: 9:16 (вертикальный, идеально для TikTok)
- **API**: https://api.lumalabs.ai
- **Стоимость**: Бесплатно (с ограничениями)
- **Качество**: Хорошее
- **Особенности**: Быстрая генерация, бесплатный тариф

### 3. **Stable Video Diffusion** (через Replicate)
- **Длительность**: 4 секунды
- **Формат**: Настраиваемый
- **API**: https://api.replicate.com
- **Стоимость**: ~$0.02 за видео
- **Качество**: Хорошее
- **Особенности**: Open-source модель, доступна через Replicate

### 4. **Kling AI** (альтернатива)
- **Длительность**: До 10 секунд
- **Формат**: 16:9, 9:16, 1:1
- **API**: Через официальный API (если доступен)
- **Качество**: Отличное
- **Особенности**: Длинные видео, высокое качество

## Промпт-инжиниринг для снов

### Базовый шаблон промпта:

```
Cinematic dream visualization: [ОПИСАНИЕ СНА]
, surreal atmosphere, symbolic imagery, [СИМВОЛЫ]
, cinematic composition, soft focus, dreamy color palette
, mystical ambiance, fluid camera movement, short 3-5 second loop
```

### Примеры промптов:

**Сон про кита:**
```
Cinematic dream visualization: A large red whale swimming in deep blue water, 
approaching the viewer as if wanting to communicate, surreal atmosphere, 
symbolic imagery, whale, water, red color, communication, cinematic composition, 
soft focus, dreamy color palette, mystical ambiance, fluid camera movement, 
short 3-5 second loop, underwater perspective, ethereal lighting
```

**Сон про полет:**
```
Cinematic dream visualization: A person flying over a burning city at night, 
surreal atmosphere, symbolic imagery, flight, fire, city, night, freedom, 
cinematic composition, soft focus, dreamy color palette, mystical ambiance, 
fluid camera movement, short 3-5 second loop, bird's eye view, dramatic lighting
```

**Сон про зеркало:**
```
Cinematic dream visualization: A person looking into a mysterious mirror that 
reflects a different reality, surreal atmosphere, symbolic imagery, mirror, 
reflection, duality, self-discovery, cinematic composition, soft focus, 
dreamy color palette, mystical ambiance, fluid camera movement, 
short 3-5 second loop, close-up, mysterious lighting
```

## Техническая реализация

### 1. Добавление поля videoUrl в схему

```bash
# Создать миграцию
npx prisma migrate dev --name add_video_url_to_dreams
```

```prisma
model Dream {
  id        String   @id @default(cuid())
  title     String
  content   String
  symbols   Json
  videoUrl  String?  // URL сгенерированного видео
  userId    String?
  createdAt DateTime @default(now())
}
```

### 2. Интеграция API

См. файл `backend/src/routes/dreams-video.ts` для примеров интеграции.

### 3. Асинхронная обработка

Для больших объемов рекомендуется использовать очередь задач (Bull, BullMQ):

```typescript
// Пример с BullMQ
import { Queue } from 'bullmq';

const videoQueue = new Queue('dream-video-generation', {
  connection: {
    host: 'localhost',
    port: 6379,
  },
});

// Добавление задачи в очередь
await videoQueue.add('generate-video', {
  dreamId: dream.id,
  prompt: videoPrompt,
  provider: 'runway',
});
```

### 4. Frontend интеграция

```typescript
// Генерация видео
const generateVideo = async (dreamId: string) => {
  const response = await api(`/api/dreams/${dreamId}/generate-video`, {
    method: 'POST',
    token,
    body: { provider: 'luma' }
  });
  
  // Проверка статуса
  if (response.status === 'processing') {
    pollVideoStatus(dreamId, response.taskId);
  }
};

// Проверка статуса генерации
const pollVideoStatus = async (dreamId: string, taskId: string) => {
  const interval = setInterval(async () => {
    const status = await api(`/api/dreams/${dreamId}/video-status?taskId=${taskId}`, { token });
    
    if (status.status === 'completed') {
      clearInterval(interval);
      // Обновить UI с видео
    }
  }, 2000);
};
```

## Рекомендации по выбору провайдера

### Для MVP / Тестирования:
- **Luma Dream Machine** - бесплатно, быстро, хорошее качество

### Для продакшена:
- **Runway Gen-3** - лучшее качество, надежный API, но платно

### Для масштабирования:
- **Stable Video Diffusion через Replicate** - дешево, стабильно, open-source

## Стоимость генерации

| Провайдер | Стоимость за видео | Длительность | Качество |
|-----------|-------------------|--------------|----------|
| Luma | Бесплатно | 5 сек | ⭐⭐⭐⭐ |
| Runway | ~$0.05 | 4 сек | ⭐⭐⭐⭐⭐ |
| Replicate | ~$0.02 | 4 сек | ⭐⭐⭐⭐ |
| Kling | ~$0.10 | 10 сек | ⭐⭐⭐⭐⭐ |

## Безопасность и приватность

⚠️ **ВАЖНО**: 
- Сны клиентов - конфиденциальная информация
- Не передавайте полные описания снов в публичные API без согласия
- Используйте анонимизированные версии промптов
- Храните видео на защищенных серверах
- Получайте согласие клиента на генерацию видео

## Примеры использования

### 1. Генерация видео при создании сна

```typescript
// Автоматическая генерация
router.post('/dreams', requireAuth, async (req: AuthedRequest, res) => {
  const dream = await prisma.dream.create({ ... });
  
  // Асинхронная генерация видео
  videoQueue.add('generate-video', { dreamId: dream.id });
  
  res.json(dream);
});
```

### 2. Лента "Тиктока снов"

```typescript
// GET /api/dreams/feed
router.get('/dreams/feed', requireAuth, async (req, res) => {
  const dreams = await prisma.dream.findMany({
    where: { videoUrl: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  
  res.json({ items: dreams });
});
```

### 3. Вертикальный формат для TikTok

```typescript
const prompt = createVideoPrompt(dream);
const result = await generateVideoWithLuma(prompt, {
  aspect_ratio: '9:16', // Вертикальный формат
  duration: 5,
});
```

## Следующие шаги

1. ✅ Добавить поле `videoUrl` в модель Dream
2. ✅ Интегрировать один из text-to-video API
3. ✅ Создать UI для генерации и просмотра видео
4. ✅ Реализовать очередь задач для асинхронной генерации
5. ✅ Добавить обработку ошибок и retry логику
6. ✅ Реализовать кэширование промптов
7. ✅ Создать ленту "Тиктока снов"

## Полезные ссылки

- [Runway API Documentation](https://docs.runwayml.com)
- [Luma API Documentation](https://docs.lumalabs.ai)
- [Replicate API Documentation](https://replicate.com/docs)
- [Stable Video Diffusion](https://stability.ai/news/stable-video-diffusion)

