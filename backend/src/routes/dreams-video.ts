/**
 * Теоретический пример: Генерация видео из снов клиентов
 * 
 * Этот файл демонстрирует, как можно интегрировать генерацию видео
 * из текстовых описаний снов для создания "Тиктока снов"
 */

import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { config } from '../config';

const router = Router();

/**
 * Преобразует описание сна в визуальный промпт для генерации видео
 * 
 * @param dream - Объект сна с title, content, symbols
 * @returns Оптимизированный промпт для text-to-video модели
 */
function createVideoPrompt(dream: { title: string; content: string; symbols?: string[] | null }) {
  const symbols = Array.isArray(dream.symbols) ? dream.symbols : [];
  
  // Базовый промпт с учетом символов
  let prompt = `Cinematic dream visualization: ${dream.content}`;
  
  // Добавляем визуальные дескрипторы на основе символов
  const visualStyle = symbols.length > 0 
    ? `, surreal atmosphere, symbolic imagery, ${symbols.join(', ')}`
    : ', surreal dreamlike atmosphere, ethereal lighting';
  
  // Добавляем стилистические указания для снов
  const styleModifiers = [
    'cinematic composition',
    'soft focus',
    'dreamy color palette',
    'mystical ambiance',
    'fluid camera movement',
    'short 3-5 second loop'
  ];
  
  prompt += `${visualStyle}, ${styleModifiers.join(', ')}`;
  
  // Ограничиваем длину промпта (большинство моделей принимают до 320-500 символов)
  if (prompt.length > 400) {
    prompt = prompt.substring(0, 397) + '...';
  }
  
  return prompt;
}

/**
 * Пример интеграции с Runway Gen-3 API
 * 
 * Runway Gen-3 генерирует 4-секундные видео из текстовых промптов
 */
async function generateVideoWithRunway(prompt: string): Promise<{ videoUrl: string; status: string }> {
  // ВАЖНО: Это теоретический пример. Нужен реальный API ключ от Runway
  const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY || '';
  const RUNWAY_API_URL = 'https://api.runwayml.com/v1/image-to-video';
  
  if (!RUNWAY_API_KEY) {
    throw new Error('RUNWAY_API_KEY не настроен');
  }
  
  // Runway Gen-3 работает через image-to-video или text-to-video
  // Для text-to-video нужен другой endpoint
  const response = await fetch('https://api.runwayml.com/v1/text-to-video', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RUNWAY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: prompt,
      duration: 4, // 4 секунды
      aspect_ratio: '16:9', // или '9:16' для вертикального (TikTok формат)
      fps: 24,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Runway API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  
  // Runway возвращает task_id, нужно опрашивать статус
  return {
    videoUrl: data.video_url || '',
    status: data.status || 'processing',
  };
}

/**
 * Пример интеграции с Luma Dream Machine
 * 
 * Luma Dream Machine - бесплатная альтернатива, генерирует видео из текста
 */
async function generateVideoWithLuma(prompt: string): Promise<{ videoUrl: string; status: string }> {
  const LUMA_API_KEY = process.env.LUMA_API_KEY || '';
  
  if (!LUMA_API_KEY) {
    throw new Error('LUMA_API_KEY не настроен');
  }
  
  // Luma API endpoint
  const response = await fetch('https://api.lumalabs.ai/v1/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LUMA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: prompt,
      aspect_ratio: '9:16', // Вертикальный формат для TikTok
      duration: 5, // 5 секунд
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Luma API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  
  return {
    videoUrl: data.video_url || '',
    status: data.status || 'processing',
  };
}

/**
 * Пример интеграции с Stable Video Diffusion через Replicate
 * 
 * Replicate предоставляет доступ к различным моделям через единый API
 */
async function generateVideoWithReplicate(prompt: string): Promise<{ videoUrl: string; status: string }> {
  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';
  
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN не настроен');
  }
  
  // Запускаем модель Stable Video Diffusion
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd6afdf9a3bc25d8f8d7b3f1a9825b781b2',
      input: {
        prompt: prompt,
        duration: 4,
        aspect_ratio: '9:16',
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  
  // Replicate возвращает prediction с URL для проверки статуса
  return {
    videoUrl: data.urls?.get || '',
    status: data.status || 'starting',
  };
}

/**
 * Универсальная функция генерации видео
 * Выбирает провайдера на основе конфигурации
 */
async function generateDreamVideo(
  dream: { title: string; content: string; symbols?: string[] | null },
  provider: 'runway' | 'luma' | 'replicate' = 'replicate'
): Promise<{ videoUrl: string; status: string; taskId?: string }> {
  const prompt = createVideoPrompt(dream);
  
  console.log('Generating video with prompt:', prompt);
  
  switch (provider) {
    case 'runway':
      return await generateVideoWithRunway(prompt);
    case 'luma':
      return await generateVideoWithLuma(prompt);
    case 'replicate':
    default:
      return await generateVideoWithReplicate(prompt);
  }
}

/**
 * POST /api/dreams/:id/generate-video
 * 
 * Генерирует видео из сна клиента
 * 
 * Body: { provider?: 'runway' | 'luma' | 'replicate' }
 */
router.post('/dreams/:id/generate-video', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { provider = 'replicate' } = req.body ?? {};
    
    // Получаем сон из базы данных
    const dream = await prisma.dream.findUnique({
      where: { id },
    });
    
    if (!dream) {
      return res.status(404).json({ error: 'Dream not found' });
    }
    
    // Проверяем права доступа (только владелец сна или психолог)
    if (dream.userId && dream.userId !== req.user!.id && req.user!.role !== 'psychologist' && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Генерируем видео
    const result = await generateDreamVideo(
      {
        title: dream.title,
        content: dream.content,
        symbols: dream.symbols as string[] | null,
      },
      provider
    );
    
    // Сохраняем URL видео в базу данных
    // ВАЖНО: Нужно добавить поле videoUrl в модель Dream в schema.prisma
    // await prisma.dream.update({
    //   where: { id },
    //   data: { videoUrl: result.videoUrl }
    // });
    
    res.json({
      success: true,
      videoUrl: result.videoUrl,
      status: result.status,
      taskId: result.taskId,
      message: result.status === 'processing' 
        ? 'Видео генерируется. Проверьте статус через несколько секунд.'
        : 'Видео готово!'
    });
  } catch (error: any) {
    console.error('Error generating video:', error);
    res.status(500).json({
      error: 'Failed to generate video',
      message: error.message,
    });
  }
});

/**
 * GET /api/dreams/:id/video-status
 * 
 * Проверяет статус генерации видео (для асинхронных API)
 */
router.get('/dreams/:id/video-status', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { taskId } = req.query;
    
    if (!taskId) {
      return res.status(400).json({ error: 'taskId is required' });
    }
    
    // Проверяем статус задачи в API провайдера
    // Это зависит от конкретного провайдера
    
    res.json({
      status: 'completed', // или 'processing', 'failed'
      videoUrl: '', // URL видео когда готово
    });
  } catch (error: any) {
    console.error('Error checking video status:', error);
    res.status(500).json({
      error: 'Failed to check video status',
      message: error.message,
    });
  }
});

/**
 * GET /api/dreams/feed
 * 
 * Возвращает ленту снов с видео (для "Тиктока снов")
 */
router.get('/dreams/feed', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    
    // Получаем сны с видео
    const dreams = await prisma.dream.findMany({
      where: {
        // videoUrl: { not: null } // Когда добавим поле videoUrl
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
      select: {
        id: true,
        title: true,
        content: true,
        symbols: true,
        createdAt: true,
        // videoUrl: true, // Когда добавим поле
      },
    });
    
    res.json({
      items: dreams,
      total: dreams.length,
    });
  } catch (error: any) {
    console.error('Error fetching dreams feed:', error);
    res.status(500).json({
      error: 'Failed to fetch dreams feed',
      message: error.message,
    });
  }
});

export default router;

