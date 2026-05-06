const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting database repair: Syncing Sale totals with Journal entries...");

  const sales = await prisma.sale.findMany({
    include: {
      journalentry: {
        include: {
          journalline: {
            include: {
              ledger: true
            }
          }
        }
      }
    }
  });

  let fixedCount = 0;

  for (const s of sales) {
    if (!s.journalentry) continue;

    // Find the debit line (Cash/Bank/UPI)
    const cashLine = s.journalentry.journalline.find(l => 
      (l.ledger.name === 'Cash' || l.ledger.name === 'Bank' || l.ledger.name === 'UPI' || l.ledger.name === 'Bank Accounts') && l.debit > 0
    );

    if (cashLine && Math.abs(cashLine.debit - s.totalAmount) > 0.01) {
      console.log(`🔧 Repairing Invoice ${s.invoiceNumber}: ${s.totalAmount} -> ${cashLine.debit}`);
      
      // Calculate what the roundOff should be
      // (Assuming the items total is the original s.totalAmount)
      const newRoundOff = cashLine.debit - s.totalAmount;

      await prisma.sale.update({
        where: { id: s.id },
        data: {
          totalAmount: cashLine.debit,
          roundOff: newRoundOff,
          // If source is missing, guess it's POS
          source: s.source || "POS"
        }
      });
      fixedCount++;
    }
  }

  console.log(`✅ Repair complete. Fixed ${fixedCount} records.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
