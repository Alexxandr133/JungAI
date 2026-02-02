import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Скрипт для удаления всех клиентов, кроме демо клиентов
 */
async function cleanupClients() {
  console.log('Начинаем очистку клиентов...');

  // Список email клиентов, которых нужно оставить
  const keepEmails = [
    'client@example.com',
    'client.vdovin.ser@demo.jung',
    'client.trofimov.val@demo.jung',
    'client.trofimov.rom@demo.jung',
    'client.trofimov.mak@demo.jung',
    'client.abdurakhmanov.rus@demo.jung',
  ];

  try {
    // Получаем всех клиентов
    const allClients = await prisma.client.findMany({
      select: { id: true, email: true, name: true }
    });

    console.log(`Найдено клиентов: ${allClients.length}`);

    // Фильтруем клиентов, которых нужно удалить
    const clientsToDelete = allClients.filter(client => 
      !keepEmails.includes(client.email || '')
    );

    console.log(`Клиентов для удаления: ${clientsToDelete.length}`);
    console.log(`Клиентов для сохранения: ${allClients.length - clientsToDelete.length}`);

    if (clientsToDelete.length === 0) {
      console.log('✅ Нет клиентов для удаления');
      return;
    }

    // Удаляем каждого клиента и связанные данные
    for (const client of clientsToDelete) {
      console.log(`Удаляем клиента: ${client.name} (${client.email})`);
      
      const clientId = client.id;

      // Удаляем все связанные данные клиента
      await prisma.dreamAmplification.deleteMany({
        where: { dream: { clientId } }
      });
      
      await prisma.dream.deleteMany({ where: { clientId } });
      await prisma.journalEntry.deleteMany({ where: { clientId } });
      await prisma.testResult.deleteMany({ where: { clientId } });
      
      // Удаляем документы и их версии
      const documents = await (prisma as any).clientDocument.findMany({ 
        where: { clientId }, 
        select: { id: true } 
      });
      for (const doc of documents) {
        await (prisma as any).documentVersion.deleteMany({ where: { documentId: doc.id } });
      }
      await (prisma as any).clientDocument.deleteMany({ where: { clientId } });
      await (prisma as any).documentVersion.deleteMany({ where: { clientId } });
      
      await prisma.clientNote.deleteMany({ where: { clientId } });
      await prisma.therapySession.deleteMany({ where: { clientId } });
      await (prisma as any).supportRequest.deleteMany({ where: { clientId } });
      await (prisma as any).clientTabs.deleteMany({ where: { clientId } });
      
      // Удаляем события, связанные с клиентом
      await prisma.event.deleteMany({ where: { clientId } });
      
      // Удаляем самого клиента
      await prisma.client.delete({ where: { id: clientId } });
      
      console.log(`  ✓ Удален клиент: ${client.name}`);
    }

    console.log('\n✅ Очистка клиентов завершена успешно!');
    console.log(`\nСохранены клиенты:`);
    keepEmails.forEach(email => {
      console.log(`  - ${email}`);
    });
    
  } catch (error: any) {
    console.error('❌ Ошибка при очистке клиентов:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем очистку
cleanupClients()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

