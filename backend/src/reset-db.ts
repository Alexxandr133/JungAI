import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Скрипт для очистки базы данных перед продакшеном
 * Удаляет все данные, кроме структуры таблиц
 */
async function resetDatabase() {
  console.log('Начинаем очистку базы данных...');

  try {
    // Удаляем данные в правильном порядке (с учетом внешних ключей)
    
    console.log('Удаляем связи снов и амплификаций...');
    await prisma.dreamAmplification.deleteMany({});
    
    console.log('Удаляем амплификации...');
    await (prisma as any).amplification.deleteMany({});
    
    console.log('Удаляем сны...');
    await prisma.dream.deleteMany({});
    
    console.log('Удаляем записи дневника...');
    await prisma.journalEntry.deleteMany({});
    
    console.log('Удаляем результаты тестов...');
    await prisma.testResult.deleteMany({});
    
    console.log('Удаляем версии документов...');
    await (prisma as any).documentVersion.deleteMany({});
    
    console.log('Удаляем документы клиентов...');
    await (prisma as any).clientDocument.deleteMany({});
    
    console.log('Удаляем вкладки клиентов...');
    await (prisma as any).clientTabs.deleteMany({});
    
    console.log('Удаляем заметки о клиентах...');
    await prisma.clientNote.deleteMany({});
    
    console.log('Удаляем сессии терапии...');
    await prisma.therapySession.deleteMany({});
    
    console.log('Удаляем запросы в техподдержку...');
    await (prisma as any).supportRequest.deleteMany({});
    
    console.log('Удаляем голосовые комнаты...');
    await (prisma as any).voiceRoom.deleteMany({});
    
    console.log('Удаляем события...');
    await prisma.event.deleteMany({});
    
    console.log('Удаляем задачи...');
    await prisma.task.deleteMany({});
    
    console.log('Удаляем сообщения чата...');
    await (prisma as any).chatMessage.deleteMany({});
    
    console.log('Удаляем комнаты чата...');
    await (prisma as any).chatRoom.deleteMany({});
    
    console.log('Удаляем файловые вложения...');
    await (prisma as any).fileAttachment.deleteMany({});
    
    console.log('Удаляем уведомления...');
    await prisma.notification.deleteMany({});
    
    console.log('Удаляем материалы...');
    await prisma.material.deleteMany({});
    
    console.log('Удаляем отзывы о снах...');
    await (prisma as any).dreamFeedback.deleteMany({});
    
    console.log('Удаляем паранормальные случаи...');
    await (prisma as any).paranormalCase.deleteMany({});
    
    console.log('Удаляем клиентов...');
    await prisma.client.deleteMany({});
    
    console.log('Удаляем запросы на верификацию...');
    await (prisma as any).verificationRequest.deleteMany({});
    
    console.log('Удаляем профили...');
    await (prisma as any).profile.deleteMany({});
    
    console.log('Удаляем пользователей...');
    await prisma.user.deleteMany({});
    
    console.log('✅ База данных успешно очищена!');
    console.log('\nПримечание: Тестовые аккаунты можно создать вручную через регистрацию или используя seed скрипт.');
    
  } catch (error) {
    console.error('❌ Ошибка при очистке базы данных:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем очистку
resetDatabase()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });


