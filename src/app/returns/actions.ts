"use server";

import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";


export async function processSalesReturn(saleId: string, refundAmount: number, reason: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { saleitem: true }
  });

  if (!sale) throw new Error("Sale not found");

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Create SalesReturn record
    await tx.salesreturn.create({
      data: {
        id: randomUUID(),
        originalSaleId: saleId,
        refundAmount,
        reason,
        date: new Date(),
      }
    });

    // 2. Add items back to stock
    for (const item of sale.saleitem) {
      await tx.batch.update({
        where: { id: item.batchId },
        data: { currentStock: { increment: item.quantity } }
      });

      // Log stock adjustment
      await tx.stockadjustment.create({
        data: {
          id: randomUUID(),
          batchId: item.batchId,
          type: "Addition",
          reason: `Sales Return (INV: ${sale.invoiceNumber})`,
          quantity: item.quantity,
        }
      });
    }

    // 3. Accounting: Reverse the sale (debit Sales, credit Cash)
    const activeFY = await tx.financialyear.findFirst({ where: { isActive: true } });
    if (activeFY) {
      const cashLedger = await tx.ledger.findFirst({ where: { name: "Cash", financialYearId: activeFY.id } });
      const salesLedger = await tx.ledger.findFirst({ where: { name: "Sales Account", financialYearId: activeFY.id } });
      
      if (cashLedger && salesLedger) {
        await tx.journalentry.create({
          data: {
            id: randomUUID(),
            voucherNumber: `VOC/RET/${Date.now()}`,
            voucherType: "Sales Return",
            financialYearId: activeFY.id,
            narration: `Return for INV ${sale.invoiceNumber}: ${reason}`,
            journalline: {
              create: [
                { id: randomUUID(), ledgerId: salesLedger.id, debit: refundAmount, credit: 0 },
                { id: randomUUID(), ledgerId: cashLedger.id, debit: 0, credit: refundAmount },
              ]
            }
          }
        });
        // Update balances
        await tx.ledger.update({ where: { id: salesLedger.id }, data: { currentBalance: { decrement: refundAmount } } });
        await tx.ledger.update({ where: { id: cashLedger.id }, data: { currentBalance: { decrement: refundAmount } } });
      }
    }
  });

  revalidatePath('/returns');
  revalidatePath('/inventory');
  revalidatePath('/dashboard');
}
