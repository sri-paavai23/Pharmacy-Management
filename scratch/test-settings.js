const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    console.log('Attempting to get or create settings...');
    let settings = await prisma.businessSettings.findUnique({ where: { id: "1" } });
    if (!settings) {
       console.log('Settings not found, creating...');
       settings = await prisma.businessSettings.create({
         data: {
           id: "1",
           pharmacyName: "Vellammal Pharmacy",
           dlNumber: "DL-123456",
           gstin: "33AAAAA0000A1Z5",
           contactInfo: "Salem, Tamil Nadu",
           ownerDetails: "Owner"
           // updatedAt is missing!
         }
       });
    }
    console.log('Settings:', settings);
  } catch (err) {
    console.error('ERROR:', err.message);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
