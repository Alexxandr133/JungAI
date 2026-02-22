const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fillChatRooms() {
  try {
    console.log('Starting to fill chat rooms...');
    
    // Получить все комнаты без psychologistId и clientId
    const rooms = await prisma.chatRoom.findMany({
      where: {
        OR: [
          { psychologistId: null },
          { clientId: null }
        ]
      }
    });

    console.log(`Found ${rooms.length} rooms to fill`);

    let updated = 0;
    let deleted = 0;

    for (const room of rooms) {
      // Попытаться найти клиента по имени комнаты
      if (room.name) {
        const client = await prisma.client.findFirst({
          where: {
            name: room.name
          }
        });

        if (client) {
          await prisma.chatRoom.update({
            where: { id: room.id },
            data: {
              psychologistId: client.psychologistId,
              clientId: client.id
            }
          });
          updated++;
          console.log(`✓ Updated room "${room.name}" (${room.id}) with client ${client.id} and psychologist ${client.psychologistId}`);
        } else {
          // Если клиент не найден, удалить комнату (она не нужна)
          await prisma.chatRoom.delete({
            where: { id: room.id }
          });
          deleted++;
          console.log(`✗ Deleted orphaned room "${room.name}" (${room.id}) - client not found`);
        }
      } else {
        // Если нет имени, удалить комнату
        await prisma.chatRoom.delete({
          where: { id: room.id }
        });
        deleted++;
        console.log(`✗ Deleted room ${room.id} - no name`);
      }
    }

    console.log(`\nDone! Updated: ${updated}, Deleted: ${deleted}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fillChatRooms();

