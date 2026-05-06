const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
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
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  sales.forEach(s => {
    const cashLine = s.journalentry?.journalline.find(l => 
      l.ledger.name === 'Cash' || l.ledger.name === 'Bank' || l.ledger.name === 'UPI'
    );
    console.log(`Invoice: ${s.invoiceNumber}`);
    console.log(`  Sale TotalAmount: ${s.totalAmount}`);
    console.log(`  Journal Debit: ${cashLine?.debit || 0}`);
    console.log(`  Source: ${s.source || 'N/A'}`);
    console.log('---');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
