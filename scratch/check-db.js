const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const groups = await prisma.accountgroup.count();
  console.log('Groups:', groups);
}
main().finally(() => prisma.$disconnect());
