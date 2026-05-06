const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const products = await prisma.$queryRawUnsafe('SELECT id, name, embedding FROM product');
  console.log('Raw products:', products.map(p => ({ 
    id: p.id, 
    name: p.name, 
    embeddingType: typeof p.embedding,
    hasEmbedding: p.embedding !== null 
  })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
