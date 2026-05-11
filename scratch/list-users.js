const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  try {
    const users = await p.user.findMany({
      select: {
        name: true,
        pinCode: true,
        role: true,
        isActive: true
      }
    });
    console.log('Users in database:');
    console.table(users);
  } catch (e) {
    console.error('Error fetching users:', e);
  } finally {
    await p.$disconnect();
  }
}

main();
