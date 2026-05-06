const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.product.count();
  const products = await prisma.product.findMany({ take: 10 });
  console.log('Product count:', count);
  console.log('Sample products:', products.map(p => ({ id: p.id, name: p.name, hasEmbedding: !!p.embedding })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
