import { Router } from 'express';
import { requireAuth, requireRole, requireVerification, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { mergeDreamKeywords } from '../utils/dreamKeywords';
import { config } from '../config';
import { OpenAI } from 'openai';

const router = Router();

// Инициализация клиента OpenAI для HuggingFace Router API
// Используем router.huggingface.co для OpenAI-совместимого API
const hfClient = config.hfToken ? new OpenAI({
  baseURL: 'https://router.huggingface.co/v1',
  apiKey: config.hfToken,
}) : null;

router.post('/ai/dream/analyze', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { content, symbols, dreamId } = req.body ?? {};
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Автоматическое извлечение символов из текста, если не предоставлены
    let extractedSymbols: string[] = symbols || [];
    
    if (!extractedSymbols || extractedSymbols.length === 0) {
      // Простое извлечение символов (ключевые слова)
      // В будущем можно использовать NER модель
      const commonSymbols = ['вода', 'лес', 'змея', 'дракон', 'огонь', 'земля', 'воздух', 'дом', 'дорога', 'мост', 'дверь', 'окно', 'лестница', 'гора', 'море', 'река', 'дерево', 'цветок', 'животное', 'птица', 'рыба', 'кошка', 'собака', 'лошадь', 'волк', 'медведь', 'орел', 'змея', 'рыба'];
      const contentLower = content.toLowerCase();
      extractedSymbols = commonSymbols.filter(symbol => contentLower.includes(symbol));
      
      // Также ищем слова, которые могут быть символами (существительные)
      const words = content.toLowerCase().match(/\b[а-яё]{4,}\b/g) || [];
      extractedSymbols = [...new Set([...extractedSymbols, ...words.slice(0, 10)])];
    }

    // Подсчет частоты символов
    const freq: Record<string, number> = {};
    for (const s of extractedSymbols) {
      freq[s] = (freq[s] ?? 0) + 1;
    }

    // Базовый анализ эмоций (можно улучшить с помощью AI)
    const emotions: string[] = [];
    const contentLower = content.toLowerCase();
    if (contentLower.includes('страх') || contentLower.includes('бояться') || contentLower.includes('испуг')) emotions.push('страх');
    if (contentLower.includes('радость') || contentLower.includes('счастлив') || contentLower.includes('веселье')) emotions.push('радость');
    if (contentLower.includes('грусть') || contentLower.includes('печаль') || contentLower.includes('тоска')) emotions.push('грусть');
    if (contentLower.includes('злость') || contentLower.includes('гнев') || contentLower.includes('ярость')) emotions.push('злость');
    if (emotions.length === 0) emotions.push('нейтрально');

    // Базовый анализ архетипов (можно улучшить)
    const archetypes: string[] = [];
    if (contentLower.includes('тень') || contentLower.includes('темн') || contentLower.includes('черн')) archetypes.push('тень');
    if (contentLower.includes('мать') || contentLower.includes('женщин') || contentLower.includes('материнск')) archetypes.push('мать');
    if (contentLower.includes('отец') || contentLower.includes('мужчин') || contentLower.includes('отцовск')) archetypes.push('отец');
    if (contentLower.includes('ребенок') || contentLower.includes('детск')) archetypes.push('ребенок');
    if (contentLower.includes('мудр') || contentLower.includes('старец') || contentLower.includes('учитель')) archetypes.push('мудрец');
    if (archetypes.length === 0) archetypes.push('неопределено');

    // Рекомендации на основе символов
    const recommendations: string[] = [];
    if (extractedSymbols.some(s => ['вода', 'море', 'река'].includes(s))) {
      recommendations.push('работа с эмоциональной сферой');
    }
    if (extractedSymbols.some(s => ['лес', 'дерево', 'природа'].includes(s))) {
      recommendations.push('связь с бессознательным');
    }
    if (extractedSymbols.some(s => ['змея', 'дракон'].includes(s))) {
      recommendations.push('работа с трансформацией');
    }
    if (emotions.includes('страх')) {
      recommendations.push('исследование источников страха');
    }
    if (recommendations.length === 0) {
      recommendations.push('практика активного воображения');
      recommendations.push('ведение дневника эмоций');
    }

    // Если есть dreamId, сохраняем символы: эвристики анализа + извлечение из текста сна
    if (dreamId) {
      try {
        const existing = await (prisma as any).dream.findUnique({
          where: { id: dreamId },
          select: { title: true }
        });
        const title = existing?.title != null ? String(existing.title) : '';
        const merged = mergeDreamKeywords(title, String(content), extractedSymbols);
        await (prisma as any).dream.update({
          where: { id: dreamId },
          data: { symbols: merged }
        });
      } catch (e) {
        // Игнорируем ошибки обновления
      }
    }

    // Предложение амплификаций на основе символов
    const suggestedAmplifications: any[] = [];
    if (extractedSymbols.length > 0) {
      const topSymbols = Object.entries(freq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([symbol]) => symbol);

      for (const symbol of topSymbols) {
        const amps = await (prisma as any).amplification.findMany({
          where: {
            OR: [
              { symbol: { contains: symbol, mode: 'insensitive' } },
              { title: { contains: symbol, mode: 'insensitive' } }
            ],
            isPublic: true
          },
          take: 1
        });
        if (amps.length > 0) {
          suggestedAmplifications.push(amps[0]);
        }
      }
    }

    res.json({
      frequency: freq,
      emotions,
      archetypes,
      recommendations,
      extractedSymbols,
      suggestedAmplifications: suggestedAmplifications.map(a => ({
        id: a.id,
        symbol: a.symbol,
        title: a.title
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to analyze dream' });
  }
});

router.get('/ai/dream/similar', requireAuth, (_req, res) => {
  res.json({ similar: [] });
});

router.post('/ai/hypotheses', requireAuth, (_req, res) => {
  res.json({ hypotheses: ['символ воды ↔ эмоц. регуляция', 'повтор тени ↔ неосознаваемые конфликты'] });
});

// Чат ассистента психолога
router.post('/ai/psychologist/chat', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    if (!hfClient) {
      return res.status(500).json({ error: 'HuggingFace API не настроен. Установите HF_TOKEN в переменных окружения.' });
    }

    const { message, conversationHistory = [], clientModeEnabled = true } = req.body ?? {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Сообщение обязательно' });
    }

    // Если режим работы с клиентами выключен, работаем в обобщенном режиме
    if (!clientModeEnabled) {
      const systemPrompt = `Ты — ассистент психолога, специализирующийся на юнгианском анализе и работе со сновидениями. Твоя задача — помогать психологу с общими вопросами по психологии, аналитической психологии, работе с клиентами, интерпретации снов и архетипам.

Ты работаешь в обобщенном режиме и не имеешь доступа к данным конкретных клиентов. Отвечай на общие вопросы по:
- Юнгианской психологии и аналитической психологии
- Архетипам и символам
- Интерпретации сновидений
- Техникам работы с клиентами
- Амплификациям и работе с символами
- Общим принципам психотерапии

Отвечай на русском языке, профессионально, но доступно. Используй знания юнгианской психологии, архетипов, символики и работы со сновидениями.`;

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map((msg: any) => ({
          role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: msg.content
        })),
        { role: 'user', content: message }
      ];

      let assistantMessage = 'Извините, не удалось получить ответ.';

      try {
        const chatCompletion = await hfClient.chat.completions.create({
          model: 'deepseek-ai/DeepSeek-V3:novita',
          messages: messages as any,
          temperature: 0.7,
          max_tokens: 2048,
        }, {
          timeout: 120000,
        });

        assistantMessage = chatCompletion.choices[0]?.message?.content || assistantMessage;
      } catch (error: any) {
        console.error('HuggingFace Router API error:', error);
        let errorMessage = 'Ошибка при обращении к ИИ';
        if (error.message?.includes('timeout')) {
          errorMessage = 'Превышено время ожидания ответа от ИИ. Попробуйте еще раз.';
        } else if (error.status === 503) {
          errorMessage = 'Модель загружается. Подождите несколько секунд и попробуйте снова.';
        } else if (error.status === 401) {
          errorMessage = 'Неверный HuggingFace токен. Проверьте HF_TOKEN в .env файле.';
        } else if (error.message) {
          errorMessage = `Ошибка: ${error.message}`;
        }
        throw new Error(errorMessage);
      }

      return res.json({
        message: assistantMessage,
        conversationHistory: [
          ...conversationHistory,
          { role: 'user', content: message },
          { role: 'assistant', content: assistantMessage }
        ]
      });
    }

    // Получаем клиентов психолога с полной информацией (только если режим работы с клиентами включен)
    const clients = await prisma.client.findMany({
      where: { psychologistId: req.user!.id },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });

    // Получаем все заметки о клиентах (рабочая область)
    const clientIds = clients.map(c => c.id);
    const allNotes = clientIds.length > 0 
      ? await prisma.clientNote.findMany({
          where: { clientId: { in: clientIds } },
          orderBy: { createdAt: 'desc' },
          take: 50, // Последние 50 заметок
          select: {
            id: true,
            clientId: true,
            content: true,
            createdAt: true,
            authorId: true
          }
        })
      : [];

    // Получаем все сессии терапии
    const allSessions = clientIds.length > 0
      ? await prisma.therapySession.findMany({
          where: { clientId: { in: clientIds } },
          orderBy: { date: 'desc' },
          take: 30, // Последние 30 сессий
          select: {
            id: true,
            clientId: true,
            date: true,
            summary: true,
            videoUrl: true,
            createdAt: true
          }
        })
      : [];

    // Получаем все документы рабочей области (Ведение клиента, запрос, анамнез, ценности/кредо и т.д.)
    const allDocuments: Array<{
      id: string;
      clientId: string;
      tabName: string;
      content: string;
      updatedAt: Date;
    }> = clientIds.length > 0
      ? await (prisma as any).clientDocument.findMany({
          where: { 
            clientId: { in: clientIds },
            psychologistId: req.user!.id
          },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            clientId: true,
            tabName: true,
            content: true,
            updatedAt: true
          }
        })
      : [];

    // Получаем сны клиентов по clientId (правильный способ)
    // Также получаем сны, записанные психологом напрямую (если есть)
    // clientIds уже объявлен выше на строке 165
    
    // Проверяем, указан ли конкретный клиент в запросе
    const requestedClientId = req.body?.clientId as string | undefined;
    const targetClientIds = requestedClientId && clientIds.includes(requestedClientId) 
      ? [requestedClientId] // Если указан конкретный клиент и он принадлежит психологу
      : clientIds; // Иначе все клиенты психолога
    
    const whereConditions: any[] = [];
    
    // Сны клиентов по clientId
    if (targetClientIds.length > 0) {
      whereConditions.push({ clientId: { in: targetClientIds } });
    }
    
    // Сны, записанные психологом напрямую (если психолог сам записывал сны)
    whereConditions.push({ userId: req.user!.id });
    
    const allDreams = await prisma.dream.findMany({
      where: {
        OR: whereConditions.length > 0 ? whereConditions : [{ userId: req.user!.id }]
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Последние 100 снов
      include: {
        client: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Формируем контекст о снах для промпта
    let dreamsContext = '';
    if (allDreams.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayDreams = allDreams.filter(d => {
        const dreamDate = new Date(d.createdAt);
        dreamDate.setHours(0, 0, 0, 0);
        return dreamDate.getTime() === today.getTime();
      });

      dreamsContext = `\n\nДоступные данные о снах пациентов:\n`;
      dreamsContext += `Всего снов в базе: ${allDreams.length}\n`;
      dreamsContext += `Снов за сегодня: ${todayDreams.length}\n\n`;
      
      if (todayDreams.length > 0) {
        dreamsContext += `Сны за сегодня:\n`;
        todayDreams.forEach((dream, idx) => {
          const clientName = dream.client?.name || 'Неизвестный клиент';
          dreamsContext += `${idx + 1}. "${dream.title}" (Клиент: ${clientName}, ${new Date(dream.createdAt).toLocaleString('ru-RU')})\n`;
          // Показываем полный контент сна, без обрезания
          dreamsContext += `   Содержание: ${dream.content}\n`;
          if (Array.isArray(dream.symbols) && dream.symbols.length > 0) {
            dreamsContext += `   Символы: ${(dream.symbols as string[]).join(', ')}\n`;
          }
          dreamsContext += '\n';
        });
      }

      // Добавляем последние сны (не сегодняшние)
      const recentDreams = allDreams.filter(d => {
        const dreamDate = new Date(d.createdAt);
        dreamDate.setHours(0, 0, 0, 0);
        return dreamDate.getTime() !== today.getTime();
      }).slice(0, 10);

      if (recentDreams.length > 0) {
        dreamsContext += `Последние сны (не сегодня):\n`;
        recentDreams.forEach((dream, idx) => {
          const clientName = dream.client?.name || 'Неизвестный клиент';
          dreamsContext += `${idx + 1}. "${dream.title}" (Клиент: ${clientName}, ${new Date(dream.createdAt).toLocaleString('ru-RU')})\n`;
          // Показываем полный контент сна для последних снов тоже
          dreamsContext += `   Содержание: ${dream.content}\n`;
          if (Array.isArray(dream.symbols) && dream.symbols.length > 0) {
            dreamsContext += `   Символы: ${(dream.symbols as string[]).join(', ')}\n`;
          }
          dreamsContext += '\n';
        });
      }
    } else {
      dreamsContext = '\n\nВ базе данных пока нет записей снов.';
    }

    // Формируем контекст о клиентах
    let clientsContext = '';
    if (clients.length > 0) {
      clientsContext = `\n\nБаза данных клиентов:\n`;
      clientsContext += `Всего клиентов: ${clients.length}\n\n`;
      
      clients.forEach((client, idx) => {
        clientsContext += `Клиент ${idx + 1}: ${client.name}\n`;
        clientsContext += `  ID: ${client.id}\n`;
        if (client.email) clientsContext += `  Email: ${client.email}\n`;
        if (client.phone) clientsContext += `  Телефон: ${client.phone}\n`;
        clientsContext += `  Дата добавления: ${new Date(client.createdAt).toLocaleString('ru-RU')}\n`;
        
        // Добавляем заметки о клиенте
        const clientNotes = allNotes.filter(n => n.clientId === client.id);
        if (clientNotes.length > 0) {
          clientsContext += `  Заметок о клиенте: ${clientNotes.length}\n`;
          clientNotes.slice(0, 5).forEach((note, noteIdx) => {
            clientsContext += `    Заметка ${noteIdx + 1} (${new Date(note.createdAt).toLocaleString('ru-RU')}): ${note.content.substring(0, 150)}${note.content.length > 150 ? '...' : ''}\n`;
          });
        }
        
        // Добавляем сессии клиента
        const clientSessions = allSessions.filter(s => s.clientId === client.id);
        if (clientSessions.length > 0) {
          clientsContext += `  Сессий терапии: ${clientSessions.length}\n`;
          clientSessions.slice(0, 3).forEach((session, sessIdx) => {
            clientsContext += `    Сессия ${sessIdx + 1} (${new Date(session.date).toLocaleString('ru-RU')}):\n`;
            if (session.summary) {
              clientsContext += `      Резюме: ${session.summary.substring(0, 100)}${session.summary.length > 100 ? '...' : ''}\n`;
            }
          });
        }
        clientsContext += '\n';
      });
    } else {
      clientsContext = '\n\nВ базе данных пока нет клиентов.';
    }

    // Формируем контекст рабочей области (последние заметки и сессии)
    let workAreaContext = '';
    if (allNotes.length > 0 || allSessions.length > 0) {
      workAreaContext = `\n\nРабочая область (последние записи):\n`;
      
      if (allNotes.length > 0) {
        workAreaContext += `Последние заметки о клиентах (${allNotes.length}):\n`;
        allNotes.slice(0, 10).forEach((note, idx) => {
          const client = clients.find(c => c.id === note.clientId);
          workAreaContext += `${idx + 1}. Клиент: ${client?.name || 'Неизвестен'} (${new Date(note.createdAt).toLocaleString('ru-RU')})\n`;
          workAreaContext += `   ${note.content.substring(0, 200)}${note.content.length > 200 ? '...' : ''}\n\n`;
        });
      }
      
      if (allSessions.length > 0) {
        workAreaContext += `Последние сессии терапии (${allSessions.length}):\n`;
        allSessions.slice(0, 10).forEach((session, idx) => {
          const client = clients.find(c => c.id === session.clientId);
          workAreaContext += `${idx + 1}. Клиент: ${client?.name || 'Неизвестен'}, Дата: ${new Date(session.date).toLocaleString('ru-RU')}\n`;
          if (session.summary) {
            workAreaContext += `   Резюме: ${session.summary.substring(0, 200)}${session.summary.length > 200 ? '...' : ''}\n`;
          }
          workAreaContext += '\n';
        });
      }
    }

    // Получаем список всех вкладок для каждого клиента (включая кастомные)
    const allClientTabs: Record<string, string[]> = {};
    for (const client of clients) {
      try {
        const clientTabs = await (prisma as any).clientTabs.findUnique({
          where: { clientId: client.id }
        });
        if (clientTabs && Array.isArray(clientTabs.tabs)) {
          allClientTabs[client.id] = clientTabs.tabs;
        }
      } catch (error) {
        // Игнорируем ошибки, используем только документы
      }
    }

    // Формируем контекст документов рабочей области
    let documentsContext = '';
    if (allDocuments.length > 0 || Object.keys(allClientTabs).length > 0) {
      documentsContext = `\n\nДокументы рабочей области (записи о пациентах):\n`;
      documentsContext += `Примечание: Вкладки могут быть стандартными (Ведение клиента, запрос, анамнез, ценности/кредо, раздражители, сны, записи, Дневник клиента, Синхронии) или кастомными, созданными психологом.\n`;
      
      // Группируем документы по клиентам
      clients.forEach(client => {
        const clientDocs = allDocuments.filter(d => d.clientId === client.id);
        const clientTabsList = allClientTabs[client.id] || [];
        
        if (clientDocs.length > 0 || clientTabsList.length > 0) {
          documentsContext += `\nКлиент: ${client.name}\n`;
          
          // Если есть список вкладок, используем его порядок, иначе используем порядок документов
          const tabsToShow = clientTabsList.length > 0 ? clientTabsList : clientDocs.map(d => d.tabName);
          
          tabsToShow.forEach((tabName) => {
            const doc = clientDocs.find(d => d.tabName === tabName);
            
            if (doc) {
              // Извлекаем текстовое содержимое из HTML (убираем теги)
              const textContent = doc.content
                .replace(/<[^>]*>/g, ' ') // Убираем HTML теги
                .replace(/\s+/g, ' ') // Убираем лишние пробелы
                .trim();
              
              documentsContext += `  ${doc.tabName} (обновлено: ${new Date(doc.updatedAt).toLocaleString('ru-RU')}):\n`;
              if (textContent) {
                documentsContext += `    ${textContent.substring(0, 500)}${textContent.length > 500 ? '...' : ''}\n`;
              } else {
                documentsContext += `    [Документ пуст]\n`;
              }
              documentsContext += '\n';
            } else if (clientTabsList.includes(tabName)) {
              // Вкладка существует, но документ еще не создан
              documentsContext += `  ${tabName}: [Вкладка создана, но документ еще не заполнен]\n\n`;
            }
          });
        }
      });
    } else {
      documentsContext = '\n\nВ рабочей области пока нет сохраненных документов о пациентах.';
    }

    // Формируем system prompt
    const systemPrompt = `Ты — ассистент психолога, специализирующийся на юнгианском анализе и работе со сновидениями. Твоя задача — помогать психологу с амплификациями, анализом символов, выявлением архетипических паттернов и интерпретацией снов пациентов.

Ты имеешь доступ к:
1. Базе данных снов пациентов
2. Базе данных клиентов психолога
3. Рабочей области: заметкам о клиентах и сессиям терапии
4. Документам рабочей области: записям о пациентах. Стандартные вкладки: ведение клиента, запрос, анамнез, ценности/кредо, раздражители, сны, записи, Дневник клиента, Синхронии. Также могут быть кастомные вкладки, созданные психологом для конкретного клиента.

Можешь отвечать на вопросы о клиентах, их снах, заметках, сессиях, документах рабочей области, анализировать паттерны, предлагать интерпретации и амплификации.

Отвечай на русском языке, профессионально, но доступно. Используй знания юнгианской психологии, архетипов, символики и работы со сновидениями.`;

    const userPrompt = `${dreamsContext}${clientsContext}${workAreaContext}${documentsContext}

Вопрос психолога: ${message}`;

    // Формируем историю сообщений для DeepSeek-R1
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: msg.content
      })),
      { role: 'user', content: userPrompt }
    ];

    console.log('Sending request to HuggingFace Router API...', { 
      model: 'deepseek-ai/DeepSeek-V3:novita',
      messagesCount: messages.length,
      hasHfToken: !!config.hfToken
    });

    let assistantMessage = 'Извините, не удалось получить ответ.';

    try {
      // Используем HuggingFace Router API (OpenAI-совместимый)
      console.log('Using HuggingFace Router API...');
      const chatCompletion = await hfClient.chat.completions.create({
        model: 'deepseek-ai/DeepSeek-V3:novita',
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 2048,
      }, {
        timeout: 120000, // 2 минуты таймаут
      });

      assistantMessage = chatCompletion.choices[0]?.message?.content || assistantMessage;
      
      // Убираем возможные "think" блоки, если модель их генерирует
      // DeepSeek-V3 может генерировать reasoning, но обычно это не проблема
      // Если нужно, можно добавить фильтрацию здесь
      
      console.log('HuggingFace Router API response received successfully');
    } catch (error: any) {
      console.error('HuggingFace Router API error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        code: error.code,
        response: error.response?.data || error.response
      });
      
      let errorMessage = 'Ошибка при обращении к ИИ';
      if (error.message?.includes('timeout')) {
        errorMessage = 'Превышено время ожидания ответа от ИИ. Попробуйте еще раз.';
      } else if (error.status === 503) {
        errorMessage = 'Модель загружается. Подождите несколько секунд и попробуйте снова.';
      } else if (error.status === 401) {
        errorMessage = 'Неверный HuggingFace токен. Проверьте HF_TOKEN в .env файле.';
      } else if (error.message) {
        errorMessage = `Ошибка: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    }

    res.json({
      message: assistantMessage,
      conversationHistory: [
        ...conversationHistory,
        { role: 'user', content: message },
        { role: 'assistant', content: assistantMessage }
      ]
    });
  } catch (error: any) {
    console.error('AI chat error:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      response: error.response?.data || error.response,
      stack: error.stack
    });
    
    // Более детальная обработка ошибок
    let errorMessage = 'Ошибка при обращении к ИИ';
    if (error.message?.includes('timeout')) {
      errorMessage = 'Превышено время ожидания ответа от ИИ. Попробуйте еще раз.';
    } else if (error.status === 503) {
      errorMessage = 'Модель загружается. Подождите несколько секунд и попробуйте снова.';
    } else if (error.status === 401) {
      errorMessage = 'Неверный HuggingFace токен. Проверьте HF_TOKEN в .env файле.';
    } else if (error.message) {
      errorMessage = `Ошибка: ${error.message}`;
    }
    
    res.status(error.status || 500).json({ 
      error: errorMessage, 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Чат ассистента исследователя
router.post('/ai/researcher/chat', requireAuth, requireRole(['researcher', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    if (!hfClient) {
      return res.status(500).json({ error: 'HuggingFace API не настроен. Установите HF_TOKEN в переменных окружения.' });
    }

    const { message, conversationHistory = [] } = req.body ?? {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Сообщение обязательно' });
    }

    // Получаем все сны для исследователя
    const allDreams = await prisma.dream.findMany({
      where: {},
      orderBy: { createdAt: 'desc' },
      take: 100, // Последние 100 снов
      select: {
        id: true,
        title: true,
        content: true,
        symbols: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Формируем контекст снов
    let dreamsContext = '';
    if (allDreams.length > 0) {
      dreamsContext = `\n\nБаза данных снов (последние ${allDreams.length}):\n`;
      allDreams.slice(0, 20).forEach((dream, idx) => {
        const symbols = Array.isArray(dream.symbols) ? dream.symbols.join(', ') : (typeof dream.symbols === 'object' && dream.symbols !== null ? Object.keys(dream.symbols).join(', ') : '');
        dreamsContext += `${idx + 1}. "${dream.title || 'Без названия'}" (${dream.client?.name || 'Неизвестный клиент'}) - ${dream.content?.substring(0, 200)}... Символы: ${symbols || 'нет'}\n`;
      });
    } else {
      dreamsContext = '\n\nВ базе данных пока нет снов.';
    }

    // Формируем system prompt
    const systemPrompt = `Ты — ассистент исследователя, специализирующийся на аналитической психологии, юнгианском анализе и исследовании сновидений. Твоя задача — помогать исследователю с анализом данных, выявлением паттернов, интерпретацией снов, исследованием архетипов и символики.

Ты имеешь доступ к:
1. Базе данных снов (все сны в системе)
2. Данным исследований
3. Публикациям и материалам

Можешь отвечать на вопросы о снах, анализировать паттерны, предлагать интерпретации, помогать с исследованиями и анализом данных.

Отвечай на русском языке, профессионально, но доступно. Используй знания юнгианской психологии, архетипов, символики и работы со сновидениями.`;

    const userPrompt = `${dreamsContext}

Вопрос исследователя: ${message}`;

    // Формируем историю сообщений для DeepSeek-R1
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: msg.content
      })),
      { role: 'user', content: userPrompt }
    ];

    console.log('Sending request to HuggingFace Router API for researcher...', { 
      model: 'deepseek-ai/DeepSeek-V3:novita',
      messagesCount: messages.length,
      hasHfToken: !!config.hfToken
    });

    let assistantMessage = 'Извините, не удалось получить ответ.';

    try {
      // Используем HuggingFace Router API (OpenAI-совместимый)
      console.log('Using HuggingFace Router API...');
      const chatCompletion = await hfClient.chat.completions.create({
        model: 'deepseek-ai/DeepSeek-V3:novita',
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 2048,
      }, {
        timeout: 120000, // 2 минуты таймаут
      });

      assistantMessage = chatCompletion.choices[0]?.message?.content || assistantMessage;
      
      // Убираем возможные "think" блоки, если модель их генерирует
      // DeepSeek-V3 может генерировать reasoning, но обычно это не проблема
      // Если нужно, можно добавить фильтрацию здесь
      
      console.log('HuggingFace Router API response received successfully');
    } catch (error: any) {
      console.error('HuggingFace Router API error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        code: error.code,
        response: error.response?.data || error.response
      });
      
      let errorMessage = 'Ошибка при обращении к ИИ';
      if (error.message?.includes('timeout')) {
        errorMessage = 'Превышено время ожидания ответа от ИИ. Попробуйте еще раз.';
      } else if (error.status === 503) {
        errorMessage = 'Модель загружается. Подождите несколько секунд и попробуйте снова.';
      } else if (error.status === 401) {
        errorMessage = 'Неверный HuggingFace токен. Проверьте HF_TOKEN в .env файле.';
      } else if (error.message) {
        errorMessage = `Ошибка: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    }

    res.json({
      message: assistantMessage,
      conversationHistory: [
        ...conversationHistory,
        { role: 'user', content: message },
        { role: 'assistant', content: assistantMessage }
      ]
    });
  } catch (error: any) {
    console.error('AI chat error:', error);
    
    let errorMessage = 'Ошибка при обращении к ИИ';
    if (error.message?.includes('timeout')) {
      errorMessage = 'Превышено время ожидания ответа от ИИ. Попробуйте еще раз.';
    } else if (error.status === 503) {
      errorMessage = 'Модель загружается. Подождите несколько секунд и попробуйте снова.';
    } else if (error.status === 401) {
      errorMessage = 'Неверный HuggingFace токен. Проверьте HF_TOKEN в .env файле.';
    } else if (error.message) {
      errorMessage = `Ошибка: ${error.message}`;
    }
    
    res.status(error.status || 500).json({ 
      error: errorMessage, 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Чат ассистента клиента (с ограничениями - только мягкая рефлексия)
router.post('/ai/client/chat', requireAuth, requireRole(['client', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    if (!hfClient) {
      return res.status(500).json({ error: 'HuggingFace API не настроен. Установите HF_TOKEN в переменных окружения.' });
    }

    const { message, conversationHistory = [] } = req.body ?? {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Сообщение обязательно' });
    }

    // Находим клиента по email
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email },
      select: { id: true, name: true }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Получаем сны клиента
    const clientDreams = await prisma.dream.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
      take: 20, // Последние 20 снов
      select: {
        id: true,
        title: true,
        content: true,
        symbols: true,
        createdAt: true
      }
    });

    // Получаем записи дневника клиента
    const journalEntries = await prisma.journalEntry.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
      take: 10, // Последние 10 записей
      select: {
        id: true,
        content: true,
        createdAt: true
      }
    });

    // Формируем контекст о снах
    let dreamsContext = '';
    if (clientDreams.length > 0) {
      dreamsContext = `\n\nВаши последние сны (${clientDreams.length}):\n`;
      clientDreams.slice(0, 5).forEach((dream, idx) => {
        dreamsContext += `${idx + 1}. "${dream.title || 'Без названия'}" (${new Date(dream.createdAt).toLocaleDateString('ru-RU')})\n`;
        if (dream.content) {
          dreamsContext += `   ${dream.content.substring(0, 200)}${dream.content.length > 200 ? '...' : ''}\n`;
        }
        if (Array.isArray(dream.symbols) && dream.symbols.length > 0) {
          dreamsContext += `   Символы: ${dream.symbols.join(', ')}\n`;
        }
        dreamsContext += '\n';
      });
    } else {
      dreamsContext = '\n\nУ вас пока нет записанных снов.';
    }

    // Формируем контекст о записях дневника
    let journalContext = '';
    if (journalEntries.length > 0) {
      journalContext = `\n\nВаши последние записи в дневнике (${journalEntries.length}):\n`;
      journalEntries.slice(0, 3).forEach((entry, idx) => {
        journalContext += `${idx + 1}. ${new Date(entry.createdAt).toLocaleDateString('ru-RU')}:\n`;
        journalContext += `   ${entry.content.substring(0, 150)}${entry.content.length > 150 ? '...' : ''}\n\n`;
      });
    } else {
      journalContext = '\n\nУ вас пока нет записей в дневнике.';
    }

    // Формируем system prompt с ограничениями для клиента
    const systemPrompt = `Ты — помощник для клиента, работающего с психологом. Твоя задача — поддерживать мягкую рефлексию, помогать с формулировкой вопросов и запросов, но НЕ давать интерпретации, диагнозы или глубокий анализ.

ВАЖНЫЕ ОГРАНИЧЕНИЯ:
- НЕ интерпретируй сны и не давай "значения" символам
- НЕ стави диагнозы и не давай медицинские/психологические заключения
- НЕ анализируй глубоко психологические паттерны
- Можешь помогать с формулировкой вопросов к психологу
- Можешь поддерживать рефлексию через открытые вопросы
- Можешь предлагать записать мысли в дневник
- Можешь помогать структурировать запросы к психологу

Ты имеешь доступ к:
1. Снам клиента (только для контекста, не для интерпретации)
2. Записям дневника клиента (только для контекста)

Отвечай на русском языке, дружелюбно, поддерживающе, но помни об ограничениях. Направляй клиента к его психологу для глубокой работы.`;

    const userPrompt = `${dreamsContext}${journalContext}

Вопрос клиента: ${message}`;

    // Формируем историю сообщений
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: msg.content
      })),
      { role: 'user', content: userPrompt }
    ];

    console.log('Sending request to HuggingFace Router API for client...', { 
      model: 'deepseek-ai/DeepSeek-V3:novita',
      messagesCount: messages.length,
      hasHfToken: !!config.hfToken,
      clientId: client.id
    });

    let assistantMessage = 'Извините, не удалось получить ответ.';

    try {
      // Используем HuggingFace Router API (OpenAI-совместимый)
      console.log('Using HuggingFace Router API for client...');
      const chatCompletion = await hfClient.chat.completions.create({
        model: 'deepseek-ai/DeepSeek-V3:novita',
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 2048,
      }, {
        timeout: 120000, // 2 минуты таймаут
      });

      assistantMessage = chatCompletion.choices[0]?.message?.content || assistantMessage;
      
      console.log('HuggingFace Router API response received successfully for client');
    } catch (error: any) {
      console.error('HuggingFace Router API error for client:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        code: error.code,
        response: error.response?.data || error.response
      });
      
      let errorMessage = 'Ошибка при обращении к ИИ';
      if (error.message?.includes('timeout')) {
        errorMessage = 'Превышено время ожидания ответа от ИИ. Попробуйте еще раз.';
      } else if (error.status === 503) {
        errorMessage = 'Модель загружается. Подождите несколько секунд и попробуйте снова.';
      } else if (error.status === 401) {
        errorMessage = 'Неверный HuggingFace токен. Проверьте HF_TOKEN в .env файле.';
      } else if (error.message) {
        errorMessage = `Ошибка: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    }

    res.json({
      message: assistantMessage,
      conversationHistory: [
        ...conversationHistory,
        { role: 'user', content: message },
        { role: 'assistant', content: assistantMessage }
      ]
    });
  } catch (error: any) {
    console.error('AI chat error for client:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      response: error.response?.data || error.response,
      stack: error.stack
    });
    
    // Более детальная обработка ошибок
    let errorMessage = 'Ошибка при обращении к ИИ';
    if (error.message?.includes('timeout')) {
      errorMessage = 'Превышено время ожидания ответа от ИИ. Попробуйте еще раз.';
    } else if (error.status === 503) {
      errorMessage = 'Модель загружается. Подождите несколько секунд и попробуйте снова.';
    } else if (error.status === 401) {
      errorMessage = 'Неверный HuggingFace токен. Проверьте HF_TOKEN в .env файле.';
    } else if (error.message) {
      errorMessage = `Ошибка: ${error.message}`;
    }
    
    res.status(error.status || 500).json({ 
      error: errorMessage, 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Получить все AI чаты психолога
router.get('/ai/psychologist/chats', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const chats = await prisma.aIChat.findMany({
      where: { psychologistId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    const folders = await prisma.aIChatFolder.findMany({
      where: { psychologistId: req.user!.id },
      orderBy: { createdAt: 'asc' }
    });

    const shortcuts = await prisma.aIChatShortcut.findMany({
      where: { psychologistId: req.user!.id },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      chats: chats.map(chat => ({
        id: chat.id,
        title: chat.title,
        messages: chat.messages,
        folderId: chat.folderId,
        clientId: chat.clientId,
        createdAt: chat.createdAt.toISOString(),
        updatedAt: chat.updatedAt.toISOString()
      })),
      folders: folders.map(folder => ({
        id: folder.id,
        name: folder.name,
        createdAt: folder.createdAt.toISOString()
      })),
      shortcuts: shortcuts.map(shortcut => ({
        id: shortcut.id,
        label: shortcut.label,
        emoji: shortcut.emoji,
        prompt: shortcut.prompt,
        createdAt: shortcut.createdAt.toISOString()
      }))
    });
  } catch (error: any) {
    console.error('Failed to load AI chats:', error);
    res.status(500).json({ error: error.message || 'Failed to load chats' });
  }
});

// Сохранить AI чат
router.post('/ai/psychologist/chats', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { id, title, messages, folderId, clientId } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages must be an array' });
    }

    const chatData = {
      psychologistId: req.user!.id,
      title,
      messages: messages as any,
      folderId: folderId || null,
      clientId: clientId || null
    };

    let chat;
    if (id) {
      // Проверяем, существует ли чат
      const existingChat = await prisma.aIChat.findFirst({
        where: { id, psychologistId: req.user!.id }
      });
      
      if (existingChat) {
        // Обновить существующий чат
        chat = await prisma.aIChat.update({
          where: { id },
          data: chatData,
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        });
      } else {
        // Создать новый чат (если ID был передан, но чата нет в БД)
        chat = await prisma.aIChat.create({
          data: chatData,
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        });
      }
    } else {
      // Создать новый чат
      chat = await prisma.aIChat.create({
        data: chatData,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });
    }

    res.json({
      id: chat.id,
      title: chat.title,
      messages: chat.messages,
      folderId: chat.folderId,
      clientId: chat.clientId,
      createdAt: chat.createdAt.toISOString(),
      updatedAt: chat.updatedAt.toISOString()
    });
  } catch (error: any) {
    console.error('Failed to save AI chat:', error);
    res.status(500).json({ error: error.message || 'Failed to save chat' });
  }
});

// Удалить AI чат
router.delete('/ai/psychologist/chats/:id', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;

    const chat = await prisma.aIChat.findFirst({
      where: { id, psychologistId: req.user!.id }
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    await prisma.aIChat.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete AI chat:', error);
    res.status(500).json({ error: error.message || 'Failed to delete chat' });
  }
});

// Создать/обновить папку
router.post('/ai/psychologist/folders', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { id, name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name is required' });
    }

    let folder;
    if (id) {
      folder = await prisma.aIChatFolder.update({
        where: { id },
        data: { name }
      });
    } else {
      folder = await prisma.aIChatFolder.create({
        data: {
          psychologistId: req.user!.id,
          name
        }
      });
    }

    res.json({
      id: folder.id,
      name: folder.name,
      createdAt: folder.createdAt.toISOString()
    });
  } catch (error: any) {
    console.error('Failed to save folder:', error);
    res.status(500).json({ error: error.message || 'Failed to save folder' });
  }
});

// Удалить папку
router.delete('/ai/psychologist/folders/:id', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;

    const folder = await prisma.aIChatFolder.findFirst({
      where: { id, psychologistId: req.user!.id }
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    await prisma.aIChatFolder.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete folder:', error);
    res.status(500).json({ error: error.message || 'Failed to delete folder' });
  }
});

// Создать/обновить шорткат
router.post('/ai/psychologist/shortcuts', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { id, label, emoji, prompt } = req.body;

    if (!label || typeof label !== 'string' || !prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Label and prompt are required' });
    }

    let shortcut;
    if (id) {
      shortcut = await prisma.aIChatShortcut.update({
        where: { id },
        data: { label, emoji: emoji || '📝', prompt }
      });
    } else {
      shortcut = await prisma.aIChatShortcut.create({
        data: {
          psychologistId: req.user!.id,
          label,
          emoji: emoji || '📝',
          prompt
        }
      });
    }

    res.json({
      id: shortcut.id,
      label: shortcut.label,
      emoji: shortcut.emoji,
      prompt: shortcut.prompt,
      createdAt: shortcut.createdAt.toISOString()
    });
  } catch (error: any) {
    console.error('Failed to save shortcut:', error);
    res.status(500).json({ error: error.message || 'Failed to save shortcut' });
  }
});

// Удалить шорткат
router.delete('/ai/psychologist/shortcuts/:id', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;

    const shortcut = await prisma.aIChatShortcut.findFirst({
      where: { id, psychologistId: req.user!.id }
    });

    if (!shortcut) {
      return res.status(404).json({ error: 'Shortcut not found' });
    }

    await prisma.aIChatShortcut.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete shortcut:', error);
    res.status(500).json({ error: error.message || 'Failed to delete shortcut' });
  }
});

export default router;
