const { PrismaClient } = require('@prisma/client');
const { pipeline, env } = require('@huggingface/transformers');

env.allowLocalModels = false;

const p = new PrismaClient();
let embedder = null;

async function getEmbedding(text) {
  if (!embedder) {
    console.log('Loading embedding model...');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

async function main() {
  const missing = await p.$queryRawUnsafe(
    "SELECT id, name FROM product WHERE embedding IS NULL"
  );

  if (missing.length === 0) {
    console.log('✅ All products already have embeddings!');
    return;
  }

  console.log(`Found ${missing.length} products without embeddings:`);
  for (const prod of missing) {
    console.log(`  → Generating for: ${prod.name}`);
    try {
      const embedding = await getEmbedding(prod.name);
      const vectorString = `[${embedding.join(',')}]`;
      await p.$executeRawUnsafe(
        `UPDATE product SET embedding = VEC_FromText('${vectorString}') WHERE id = '${prod.id}'`
      );
      console.log(`  ✅ Done: ${prod.name} — ${embedding.length} dimensions`);
    } catch (err) {
      console.error(`  ❌ Failed for ${prod.name}:`, err.message);
    }
  }
  console.log('\n✅ Embedding backfill complete!');
}

main()
  .catch(e => console.error('ERROR:', e.message))
  .finally(() => p.$disconnect());
