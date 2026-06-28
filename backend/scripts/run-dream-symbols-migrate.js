const { migrateDreamSymbolsToAi, processPendingDreamSymbolsBatch } = require('../dist/jobs/dreamSymbolExtraction');

(async () => {
  const migrated = await migrateDreamSymbolsToAi();
  console.log('Migrated to pending:', migrated);
  for (let i = 0; i < 5; i++) {
    const n = await processPendingDreamSymbolsBatch(5);
    console.log('Batch', i + 1, 'processed:', n);
    if (n === 0) break;
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
