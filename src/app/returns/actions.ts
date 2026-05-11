"use server";

import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";


export async function processSalesReturn(saleId: string, refundAmount: number, reason: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      saleitem: true,
      salesreturn: true // fetch existing returns for double-return guard
    }
  });

  if (!sale) throw new Error("Sale not found");

  // Guard: prevent over-refunding
  const alreadyRefunded = sale.salesreturn.reduce((sum, r) => sum + r.refundAmount, 0);
  const maxAllowedRefund = sale.totalAmount - alreadyRefunded;
  if (refundAmount <= 0) throw new Error("Refund amount must be greater than zero.");
  if (refundAmount > maxAllowedRefund + 0.01) {
    throw new Error(
      `Refund amount (₹${refundAmount.toFixed(2)}) exceeds the remaining returnable balance (₹${maxAllowedRefund.toFixed(2)}).`
    );
  }

  // Calculate refund ratio for proportional stock restoration
  const refundRatio = sale.totalAmount > 0 ? refundAmount / sale.totalAmount : 0;

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

    // 2. Restore stock proportionally based on refund ratio
    for (const item of sale.saleitem) {
      const restoreQty = Math.round(item.quantity * refundRatio);
      if (restoreQty <= 0) continue;

      await tx.batch.update({
        where: { id: item.batchId },
        data: { currentStock: { increment: restoreQty } }
      });

      await tx.stockadjustment.create({
        data: {
          id: randomUUID(),
          batchId: item.batchId,
          type: "Addition",
          reason: `Sales Return (INV: ${sale.invoiceNumber})`,
          quantity: restoreQty,
        }
      });
    }

    // 3. Accounting: Reverse using the correct payment ledger (matches original sale)
    const activeFY = await tx.financialyear.findFirst({ where: { isActive: true } });
    if (activeFY) {
      const salesLedger = await tx.ledger.findFirst({
        where: { name: "Sales Account", financialYearId: activeFY.id }
      });

      // Match the payment ledger to the original sale's payment mode
      let paymentLedgerName = "Cash";
      if (sale.paymentMode === "UPI") paymentLedgerName = "UPI";
      if (sale.paymentMode === "CARD") paymentLedgerName = "Bank Accounts";

      let paymentLedger = await tx.ledger.findFirst({
        where: { name: paymentLedgerName, financialYearId: activeFY.id }
      });
      // Fallback to Cash if specific ledger not found
      if (!paymentLedger) {
        paymentLedger = await tx.ledger.findFirst({
          where: { name: "Cash", financialYearId: activeFY.id }
        });
      }

      if (paymentLedger && salesLedger) {
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
                { id: randomUUID(), ledgerId: paymentLedger.id, debit: 0, credit: refundAmount },
              ]
            }
          }
        });
        // Update balances
        await tx.ledger.update({ where: { id: salesLedger.id }, data: { currentBalance: { decrement: refundAmount } } });
        await tx.ledger.update({ where: { id: paymentLedger.id }, data: { currentBalance: { decrement: refundAmount } } });
      }
    }
  });

  revalidatePath('/returns');
  revalidatePath('/inventory');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
}
