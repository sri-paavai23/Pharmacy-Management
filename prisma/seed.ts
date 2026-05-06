import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('--- Resetting Database ---')

  // order matters due to foreign key constraints
  const tables = [
    'journalline', 'journalentry', 'saleitem', 'salesreturn', 'sale',
    'purchaseitem', 'purchase', 'stockadjustment', 'subscription',
    'customer', 'vendor', 'ledger', 'accountgroup', 'financialyear',
    'batch', 'product', 'doctor', 'user', 'businesssettings'
  ];

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
  for (const table of tables) {
    if ((prisma as any)[table]) {
      await (prisma as any)[table].deleteMany();
      console.log(`  - Cleared ${table}`);
    }
  }
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');

  // 1. Create Financial Year (with explicit ID)
  const fyId = randomUUID();
  const fy = await prisma.financialyear.create({
    data: {
      id: fyId,
      name: "2026-2027",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      isActive: true
    }
  });

  // 2. Create Account Groups (each with explicit UUID)
  const groupData = [
    { id: randomUUID(), name: "Cash-in-hand",      nature: "Asset" },
    { id: randomUUID(), name: "Bank Accounts",     nature: "Asset" },
    { id: randomUUID(), name: "Sales Accounts",    nature: "Income" },
    { id: randomUUID(), name: "Purchase Accounts", nature: "Expense" },
    { id: randomUUID(), name: "Duties & Taxes",    nature: "Liability" },
    { id: randomUUID(), name: "Sundry Debtors",    nature: "Asset" },
    { id: randomUUID(), name: "Sundry Creditors",  nature: "Liability" },
    { id: randomUUID(), name: "Indirect Expenses", nature: "Expense" },
  ];

  // createMany cannot be used here since ids differ per row — use individual creates
  for (const g of groupData) {
    await prisma.accountgroup.create({ data: g });
  }

  // Helper: look up the id we just assigned
  const getGroupId = (name: string) => groupData.find(g => g.name === name)!.id;

  // 3. Create Core Ledgers (each with explicit UUID + currentBalance)
  const ledgers = [
    { id: randomUUID(), name: "Cash",            groupId: getGroupId("Cash-in-hand"),      openingBalance: 5000, currentBalance: 5000, balanceType: "Dr" },
    { id: randomUUID(), name: "Sales Account",   groupId: getGroupId("Sales Accounts"),    openingBalance: 0,    currentBalance: 0,    balanceType: "Cr" },
    { id: randomUUID(), name: "Output GST 12%", groupId: getGroupId("Duties & Taxes"),    openingBalance: 0,    currentBalance: 0,    balanceType: "Cr" },
    { id: randomUUID(), name: "Round Off",       groupId: getGroupId("Indirect Expenses"), openingBalance: 0,    currentBalance: 0,    balanceType: "Dr" },
  ];

  for (const l of ledgers) {
    await prisma.ledger.create({ data: { ...l, financialYearId: fy.id } });
  }

  // 4. Create sample product + batch
  // In pharmacy: same product can have many batches; batchNumber is unique per product per inward.
  // The `id` on both product and batch must be explicit UUIDs.
  const productId = randomUUID();
  const batchId   = randomUUID();

  await prisma.product.create({
    data: {
      id:           productId,
      name:         'Dolo 650',
      manufacturer: 'Micro Labs',
      category:     'Tablet',
      hsnCode:      '30049099',
      taxRate:      12.0,
      batch: {
        create: [{
          id:            batchId,
          batchNumber:   'DL234A',
          expiryDate:    new Date('2027-12-31'),
          mrp:           30.50,
          purchasePrice: 20.00,
          sellingPrice:  25.00,
          currentStock:  100,
          locationRack:  'A1',
          updatedAt:     new Date(),
        }]
      }
    }
  });

  // 5. Customer, Vendor, User — all with explicit IDs
  await prisma.customer.create({
    data: { id: randomUUID(), name: 'Ramasamy', phone: '9876543210', isSeniorCitizen: true }
  });

  await prisma.vendor.create({
    data: {
      id:            randomUUID(),
      companyName:   "Salem Pharma Distributors",
      contactPerson: "Kumar",
      phone:         "9123456780",
      gstin:         "33AAAAA0000A1Z5"
    }
  });

  await prisma.user.create({
    data: { id: randomUUID(), name: "Admin", pinCode: "1234", role: "ADMIN" }
  });

  console.log('✅ Seed Complete. All records have proper UUIDs. FK constraints satisfied.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
