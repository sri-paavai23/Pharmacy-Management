const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  try {
    const r = await p.$queryRawUnsafe('SELECT VERSION() as version');
    console.log('Version:', r);
    try {
      const prods = await p.$queryRawUnsafe('SELECT id, name FROM product WHERE embedding IS NOT NULL LIMIT 1');
      const prod = prods[0];
      if (!prod) {
        console.log('No products with embeddings found!');
      } else {
        console.log('Testing distance for:', prod.name);
        const testVec = "[" + new Array(384).fill(0.1).join(",") + "]";
        const d = await p.$queryRawUnsafe(`SELECT id, name, VEC_Distance_Cosine(embedding, VEC_FromText('${testVec}')) as distance FROM product WHERE id = '${prod.id}'`);
        console.log('Distance Result:', d);
      }
    } catch (e) {
      console.error('Vector query error:', e.message);
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await p.$disconnect();
  }
}
main();
