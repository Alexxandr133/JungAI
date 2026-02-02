import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Неверные демо-аккаунты психологов и их клиентские аккаунты,
// которые нужно полностью удалить из системы
const WRONG_PSYCHOLOGIST_EMAILS = [
  'Trafimov.Val@demo.jung',
  'Trafimov.Rom@demo.jung',
  'Trafimov.Mak@demo.jung',
];

const WRONG_CLIENT_EMAILS = [
  'client.trafimov.val@demo.jung',
  'client.trafimov.rom@demo.jung',
  'client.trafimov.mak@demo.jung',
];

async function main() {
  console.log('🚨 Удаление неверных демо-аккаунтов (Trafimov.*)...');

  // Сначала удаляем клиентов и все связанные с ними данные (каскадно через Prisma/БД)
  const deletedClients = await prisma.client.deleteMany({
    where: {
      email: {
        in: WRONG_CLIENT_EMAILS,
      },
    },
  });
  console.log(`Удалено клиентов: ${deletedClients.count}`);

  // Затем удаляем пользователей‑психологов с неверными email
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      email: {
        in: WRONG_PSYCHOLOGIST_EMAILS,
      },
    },
  });
  console.log(`Удалено пользователей-психологов: ${deletedUsers.count}`);

  console.log('✅ Удаление неверных демо-аккаунтов завершено');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


