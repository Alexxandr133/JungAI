const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const cols = await p.$queryRawUnsafe("PRAGMA table_info('Dream')");
    console.log('Dream columns:', cols.map((c) => c.name).join(', '));
    const sample = await p.$queryRawUnsafe(
      'SELECT id, symbols, symbolsStatus, symbolsExtractedAt FROM Dream LIMIT 5'
    );
    console.log('Sample:', JSON.stringify(sample, null, 2));
    const counts = await p.$queryRawUnsafe(
      'SELECT symbolsStatus, COUNT(*) as c FROM Dream GROUP BY symbolsStatus'
    );
    console.log('Status counts:', counts);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await p.$disconnect();
  }
})();
