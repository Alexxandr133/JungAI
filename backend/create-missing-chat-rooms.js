const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createMissingChatRooms() {
  try {
    console.log('Starting to create missing chat rooms...');
    
    // Получить всех клиентов
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        psychologistId: true
      }
    });

    console.log(`Found ${clients.length} clients`);

    let created = 0;
    let skipped = 0;

    for (const client of clients) {
      // Проверить, есть ли уже комната для этого клиента
      const existingRoom = await prisma.chatRoom.findUnique({
        where: { clientId: client.id }
      });

      if (existingRoom) {
        // Если комната есть, но не заполнена - заполнить
        if (!existingRoom.psychologistId || !existingRoom.clientId) {
          await prisma.chatRoom.update({
            where: { id: existingRoom.id },
            data: {
              psychologistId: client.psychologistId,
              clientId: client.id,
              name: client.name
            }
          });
          console.log(`✓ Updated room for client "${client.name}" (${client.id})`);
          created++;
        } else {
          skipped++;
          console.log(`- Skipped client "${client.name}" - room already exists`);
        }
      } else {
        // Создать новую комнату
        try {
          await prisma.chatRoom.create({
            data: {
              psychologistId: client.psychologistId,
              clientId: client.id,
              name: client.name
            }
          });
          created++;
          console.log(`✓ Created room for client "${client.name}" (${client.id}) with psychologist ${client.psychologistId}`);
        } catch (error: any) {
          if (error.code === 'P2002') {
            // Уникальное ограничение нарушено - комната уже существует с другим clientId
            console.log(`⚠ Room already exists for client "${client.name}" (${client.id})`);
            skipped++;
          } else {
            throw error;
          }
        }
      }
    }

    console.log(`\nDone! Created/Updated: ${created}, Skipped: ${skipped}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createMissingChatRooms();

