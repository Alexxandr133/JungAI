# Примеры промптов для визуализации снов

## Пример 1: Сон про красного кита

### Исходные данные:
- **Заголовок**: "Кит в воде"
- **Описание**: "Кит плавал в воде, он был большим и красным, как будто бы он хотел с ним поговорить"
- **Символы**: ["Кит", "Вода", "Красный цвет", "Коммуникация"]

### Сгенерированный промпт:

```
Cinematic dream visualization: A massive red whale swimming gracefully in deep 
blue water, approaching the viewer with an intent to communicate, surreal atmosphere, 
symbolic imagery, whale, water, red color, communication, cinematic composition, 
soft focus, dreamy color palette, mystical ambiance, fluid camera movement, 
short 3-5 second loop, underwater perspective, ethereal lighting, slow motion, 
close-up of whale's eye showing intelligence and connection
```

### Английская версия (для API):
```
A massive red whale swimming gracefully in deep blue water, approaching the viewer 
with an intent to communicate. Surreal atmosphere, symbolic imagery, whale, water, 
red color, communication. Cinematic composition, soft focus, dreamy color palette, 
mystical ambiance, fluid camera movement, short 3-5 second loop, underwater perspective, 
ethereal lighting, slow motion, close-up of whale's eye showing intelligence and connection
```

### Параметры для API:

**Runway Gen-3:**
```json
{
  "prompt": "[промпт выше]",
  "duration": 4,
  "aspect_ratio": "9:16",
  "fps": 24,
  "seed": null
}
```

**Luma Dream Machine:**
```json
{
  "prompt": "[промпт выше]",
  "aspect_ratio": "9:16",
  "duration": 5
}
```

## Пример 2: Сон про полет над городом

### Исходные данные:
- **Заголовок**: "Полет над горящим городом"
- **Описание**: "Я лечу над горящим городом ночью, вижу огонь и дым, чувствую свободу"
- **Символы**: ["Полет", "Огонь", "Город", "Ночь", "Свобода"]

### Промпт:

```
Cinematic dream visualization: A person flying over a burning city at night, 
witnessing flames and smoke below, feeling a sense of freedom and liberation. 
Surreal atmosphere, symbolic imagery, flight, fire, city, night, freedom, 
cinematic composition, soft focus, dreamy color palette, mystical ambiance, 
fluid camera movement, short 3-5 second loop, bird's eye view, dramatic lighting, 
orange and red flames contrasting with dark night sky, smooth gliding motion
```

## Пример 3: Сон про зеркало

### Исходные данные:
- **Заголовок**: "Зеркало и отражение"
- **Описание**: "Смотрю в зеркало, но вижу не себя, а другого человека"
- **Символы**: ["Зеркало", "Отражение", "Двойник", "Тождество"]

### Промпт:

```
Cinematic dream visualization: A person looking into a mysterious mirror that 
reflects a different person instead of themselves, creating a sense of duality 
and self-discovery. Surreal atmosphere, symbolic imagery, mirror, reflection, 
duality, self-discovery, cinematic composition, soft focus, dreamy color palette, 
mystical ambiance, fluid camera movement, short 3-5 second loop, close-up, 
mysterious lighting, the reflection slowly changing, creating an uncanny feeling
```

## Функция преобразования сна в промпт

```typescript
function createVideoPrompt(dream: {
  title: string;
  content: string;
  symbols?: string[] | null;
}): string {
  const symbols = Array.isArray(dream.symbols) ? dream.symbols : [];
  
  // Базовое описание
  let prompt = `Cinematic dream visualization: ${dream.content}`;
  
  // Добавляем символы
  if (symbols.length > 0) {
    prompt += `, symbolic imagery, ${symbols.join(', ')}`;
  }
  
  // Стилистические модификаторы для снов
  const styleModifiers = [
    'surreal atmosphere',
    'cinematic composition',
    'soft focus',
    'dreamy color palette',
    'mystical ambiance',
    'fluid camera movement',
    'short 3-5 second loop',
    'ethereal lighting'
  ];
  
  prompt += `, ${styleModifiers.join(', ')}`;
  
  // Ограничение длины (большинство API принимают до 400 символов)
  if (prompt.length > 400) {
    // Берем первые 200 символов описания + модификаторы
    const contentPreview = dream.content.substring(0, 200);
    prompt = `Cinematic dream visualization: ${contentPreview}..., ${styleModifiers.join(', ')}`;
  }
  
  return prompt;
}
```

## Оптимизация промптов для разных моделей

### Runway Gen-3 (до 320 символов):
```typescript
function optimizeForRunway(prompt: string): string {
  // Runway предпочитает короткие, конкретные промпты
  return prompt
    .replace(/short 3-5 second loop/g, '4 second video')
    .replace(/cinematic dream visualization:/g, '')
    .substring(0, 320);
}
```

### Luma Dream Machine (до 500 символов):
```typescript
function optimizeForLuma(prompt: string): string {
  // Luma хорошо работает с детальными описаниями
  return prompt.substring(0, 500);
}
```

### Stable Video Diffusion (до 400 символов):
```typescript
function optimizeForSVD(prompt: string): string {
  // SVD предпочитает технические термины
  return prompt
    .replace(/cinematic composition/g, 'cinematic framing')
    .substring(0, 400);
}
```

## Пример полного запроса к API

### Runway Gen-3:

```typescript
const dream = {
  title: "Кит в воде",
  content: "Кит плавал в воде, он был большим и красным, как будто бы он хотел с ним поговорить",
  symbols: ["Кит", "Вода", "Красный цвет"]
};

const prompt = createVideoPrompt(dream);
const optimizedPrompt = optimizeForRunway(prompt);

const response = await fetch('https://api.runwayml.com/v1/text-to-video', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${RUNWAY_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: optimizedPrompt,
    duration: 4,
    aspect_ratio: '9:16', // Вертикальный для TikTok
    fps: 24,
  }),
});

const data = await response.json();
// data.video_url - URL готового видео
// data.status - 'processing' или 'completed'
```

## Результат

После генерации вы получите:
- **Видео URL**: Ссылка на сгенерированное видео
- **Длительность**: 4-5 секунд
- **Формат**: 9:16 (вертикальный, идеально для TikTok)
- **Стиль**: Сюрреалистичный, кинематографический, мистический

Видео можно:
1. Сохранить в базу данных (поле `videoUrl`)
2. Показать в ленте "Тиктока снов"
3. Использовать для анализа и терапии
4. Поделиться с клиентом для обсуждения

