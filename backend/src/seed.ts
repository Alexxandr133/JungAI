import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function upsertUserByEmail(email: string, createData: any, updateData: any = {}) {
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: updateData,
    });
  }
  return prisma.user.create({ data: { email, ...createData } });
}

async function main() {
  const password = 'demo';
  const hashed = bcrypt.hashSync(password, 10);

  console.log('Создание демо аккаунтов...');

  // 1. Создаем демо психолога
  const demoPsychologist = await upsertUserByEmail('psy@example.com', {
    password: hashed,
    role: 'psychologist',
    isVerified: false
  });

  // 2. Создаем User с ролью client для входа
  const demoClientUser = await upsertUserByEmail('client@example.com', {
    password: hashed,
    role: 'client',
    isVerified: false
  });

  // 3. Создаем Client сущность и привязываем к психологу
  let demoClient = await prisma.client.findFirst({
    where: { 
      email: 'client@example.com',
      psychologistId: demoPsychologist.id
    }
  });
  
  if (!demoClient) {
    demoClient = await prisma.client.create({
      data: {
        name: 'Демо Клиент',
        email: 'client@example.com',
        phone: '+7 900 000-00-00',
        psychologistId: demoPsychologist.id,
      },
    });
  }

  // 4. Создаем демо исследователя
  const demoResearcher = await upsertUserByEmail('res@example.com', {
    password: hashed,
    role: 'researcher',
    isVerified: false
  });

  // 5. Создаем демо админа
  const demoAdmin = await upsertUserByEmail('admin@example.com', {
    password: hashed,
    role: 'admin',
    isVerified: true
  });

  // 6. Создаем 5 дополнительных психологов (не верифицированных)
  const additionalPsychologists = [
    { email: 'Vdovin.Ser@demo.jung', name: 'Вдовин Сергей' },
    { email: 'Trofimov.Val@demo.jung', name: 'Трофимов Валерий' },
    { email: 'Trofimov.Rom@demo.jung', name: 'Трофимов Роман' },
    { email: 'Trofimov.Mak@demo.jung', name: 'Трофимов Максим' },
    { email: 'Abdurakhmanov.Rus@demo.jung', name: 'Абдурахманов Руслан' },
  ];

  const clientAccounts = [];
  
  for (const psy of additionalPsychologists) {
    const psychologist = await upsertUserByEmail(
      psy.email,
      {
        password: hashed,
        role: 'psychologist',
        isVerified: true
      },
      {
        isVerified: true
      }
    );

    // Получаем короткий префикс из email психолога (например, vdovin.ser из Vdovin.Ser@demo.jung)
    const psyPrefix = psy.email.split('@')[0].toLowerCase();
    
    // Создаем одного демо клиента для каждого психолога
    const clientEmail = `client.${psyPrefix}@demo.jung`;
    
    // Создаем User аккаунт для клиента (для входа)
    await upsertUserByEmail(clientEmail, {
      password: hashed,
      role: 'client',
      isVerified: false
    });
    
    const existingClient = await prisma.client.findFirst({
      where: {
        email: clientEmail,
        psychologistId: psychologist.id
      }
    });
    
    if (!existingClient) {
      await prisma.client.create({
        data: {
          name: `Демо Клиент (${psy.name})`,
          email: clientEmail,
          phone: null,
          psychologistId: psychologist.id,
        },
      });
    }
    
    clientAccounts.push({ email: clientEmail, psychologistName: psy.name });
  }

  console.log('\n✅ Демо аккаунты успешно созданы!\n');
  console.log('📋 Данные для входа:\n');
  console.log('Основные демо аккаунты:');
  console.log('  Психолог: psy@example.com / demo');
  console.log('  Клиент: client@example.com / demo');
  console.log('  Исследователь: res@example.com / demo');
  console.log('  Админ: admin@example.com / demo\n');
  console.log('Дополнительные психологи (не верифицированные):');
  additionalPsychologists.forEach((psy, index) => {
    console.log(`  ${index + 1}. ${psy.name}: ${psy.email} / demo`);
  });
  console.log('\nДемо клиенты для входа:');
  clientAccounts.forEach((client, index) => {
    console.log(`  ${index + 1}. ${client.psychologistName} → Клиент: ${client.email} / demo`);
  });
  console.log('\n💡 Все пароли: demo');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
