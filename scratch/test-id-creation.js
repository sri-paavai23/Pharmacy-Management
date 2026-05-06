const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    console.log('Attempting to create customer without ID...');
    const result = await prisma.customer.create({
      data: {
        name: 'Test Customer',
        phone: '1234567890'
      }
    });
    console.log('Success:', result);
  } catch (err) {
    console.error('ERROR:', err.message);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
