const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // MariaDB 11.4+ (Vector-aware) — we can use VEC_AsText if needed,
  // but LENGTH() works to check if the binary data is present.
  const rows = await p.$queryRawUnsafe(`
    SELECT 
      id,
      name,
      manufacturer,
      category,
      CASE WHEN embedding IS NULL THEN 'NO EMBEDDING' ELSE 'HAS EMBEDDING' END AS embedding_status,
      CASE WHEN embedding IS NOT NULL 
           THEN CONCAT('binary(', LENGTH(embedding), ' bytes)')
           ELSE 'NULL' 
      END AS embedding_size
    FROM product
    ORDER BY name
  `);

  console.log('\n=========== PRODUCT TABLE: NAME + EMBEDDING STATUS ===========\n');
  for (const r of rows) {
    const status = r.embedding_status === 'HAS EMBEDDING'
      ? `✅ ${r.embedding_status} — ${r.embedding_size}`
      : `❌ ${r.embedding_status}`;
    console.log(`  ${r.name.padEnd(30)} | ${r.manufacturer.padEnd(20)} | ${status}`);
  }

  const summary = await p.$queryRawUnsafe(`
    SELECT 
      COUNT(*) as total_products,
      SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) as with_embedding,
      SUM(CASE WHEN embedding IS NULL THEN 1 ELSE 0 END) as without_embedding
    FROM product
  `);
  const s = summary[0];
  console.log('\n=========== SUMMARY ===========');
  console.log('  Total products   :', Number(s.total_products));
  console.log('  With embedding ✅:', Number(s.with_embedding), '  <- voice search WORKS');
  console.log('  Without embedding❌:', Number(s.without_embedding), '<- only fuzzy name match');
  console.log('================================\n');

  if (Number(s.without_embedding) > 0) {
    console.log('⚠ Run the purchase inward for missing products to generate their embeddings.');
    console.log('  Or call: POST /api/generate-embeddings to backfill all at once.\n');
  }
}

main()
  .catch(e => console.error('ERROR:', e.message))
  .finally(() => p.$disconnect());
