"use server";

import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

interface UpdateSalePayload {
  saleId: string;
  items: {
    batchId: string;
    quantity: number;
    unitPrice: number;
    unitPurchasePrice: number;
  }[];
  totalAmount: number;
  totalTax: number;
  roundOff: number;
}

export async function updateSale(data: UpdateSalePayload) {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Fetch the original sale and its items
    const originalSale = await tx.sale.findUnique({
      where: { id: data.saleId },
      include: { saleitem: true }
    });

    if (!originalSale) throw new Error("Sale not found.");

    // 1. Revert previous stock deductions and stock adjustments
    for (const item of originalSale.saleitem) {
      await tx.batch.update({
        where: { id: item.batchId },
        data: { currentStock: { increment: item.quantity } }
      });
      // Delete stock adjustments related to this sale
      await tx.stockadjustment.deleteMany({
        where: {
          batchId: item.batchId,
          reason: `Sale ${originalSale.invoiceNumber}`
        }
      });
    }

    // 2. Revert previous journal entries
    const journalEntries = await tx.journalentry.findMany({
      where: { saleId: originalSale.id }
    });

    for (const je of journalEntries) {
      const lines = await tx.journalline.findMany({ where: { journalEntryId: je.id } });
      for (const line of lines) {
        // Reverse ledger balances — subtract what was previously added
        const netChange = line.credit - line.debit;
        if (netChange > 0) {
          // Original entry credited this ledger — reverse by decrementing
          await tx.ledger.update({
            where: { id: line.ledgerId },
            data: { currentBalance: { decrement: netChange } }
          });
        } else if (netChange < 0) {
          // Original entry debited this ledger — reverse by incrementing
          await tx.ledger.update({
            where: { id: line.ledgerId },
            data: { currentBalance: { increment: Math.abs(netChange) } }
          });
        }
      }
      // Delete the journal lines and the entry
      await tx.journalline.deleteMany({ where: { journalEntryId: je.id } });
      await tx.journalentry.delete({ where: { id: je.id } });
    }

    // 3. Delete old sale items
    await tx.saleitem.deleteMany({ where: { saleId: originalSale.id } });

    // 4. Create new sale items and update sale totals
    let totalProfit = 0;
    for (const item of data.items) {
      totalProfit += (item.unitPrice - item.unitPurchasePrice) * item.quantity;
    }

    await tx.sale.update({
      where: { id: originalSale.id },
      data: {
        totalAmount: data.totalAmount + data.roundOff, // Grand total
        totalTax: data.totalTax,
        totalProfit: totalProfit + data.roundOff,
        roundOff: data.roundOff,
        saleitem: {
          create: data.items.map(item => ({
            id: randomUUID(),
            batchId: item.batchId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitPurchasePrice: item.unitPurchasePrice,
          }))
        }
      }
    });

    // 5. Apply new stock deductions and stock adjustments
    for (const item of data.items) {
      const batchWithProduct = await tx.batch.findUnique({
        where: { id: item.batchId },
        select: { currentStock: true, batchNumber: true }
      });

      if (!batchWithProduct || batchWithProduct.currentStock < item.quantity) {
        throw new Error(`Insufficient stock for batch ${batchWithProduct?.batchNumber || item.batchId}`);
      }

      await tx.batch.update({
        where: { id: item.batchId },
        data: { currentStock: { decrement: item.quantity } }
      });

      await tx.stockadjustment.create({
        data: {
          id: randomUUID(),
          batchId: item.batchId,
          type: "Reduction",
          reason: `Sale ${originalSale.invoiceNumber}`,
          quantity: item.quantity,
        }
      });
    }

    // 6. Create new accounting journal entry
    const findLedger = async (name: string) => {
      const ledger = await tx.ledger.findFirst({
         where: { name, financialYearId: originalSale.financialYearId }
      });
      if (!ledger) throw new Error(`Ledger '${name}' not found for Financial Year.`);
      return ledger;
    };

    let debitLedgerName = "Cash";
    if (originalSale.paymentMode === "UPI") debitLedgerName = "UPI";
    if (originalSale.paymentMode === "CARD") debitLedgerName = "Bank Accounts";

    let debitLedger;
    try {
      debitLedger = await findLedger(debitLedgerName);
    } catch {
      debitLedger = await findLedger("Cash");
    }

    const salesLedger = await findLedger("Sales Account");

    const journalEntry = await tx.journalentry.create({
      data: {
        id: randomUUID(),
        voucherNumber: `VOC/SAL/${originalSale.invoiceNumber}`,
        voucherType: "Sales",
        financialYearId: originalSale.financialYearId,
        narration: `POS Sale Update - ${originalSale.invoiceNumber}`,
        saleId: originalSale.id,
        journalline: {
          create: [
            { id: randomUUID(), ledgerId: debitLedger.id, debit: data.totalAmount + data.roundOff, credit: 0 },
            { id: randomUUID(), ledgerId: salesLedger.id, debit: 0, credit: data.totalAmount - data.totalTax },
          ]
        }
      }
    });

    if (data.totalTax > 0) {
       const taxLedger = await findLedger("Output GST 12%");
       await tx.journalline.create({
          data: {
             id: randomUUID(),
             journalEntryId: journalEntry.id,
             ledgerId: taxLedger.id,
             debit: 0,
             credit: data.totalTax
          }
       });
       await tx.ledger.update({ where: { id: taxLedger.id }, data: { currentBalance: { increment: data.totalTax } } });
    }

    if (data.roundOff !== 0) {
       const roundLedger = await findLedger("Round Off");
       const isDebit = data.roundOff < 0;
       await tx.journalline.create({
          data: {
             id: randomUUID(),
             journalEntryId: journalEntry.id,
             ledgerId: roundLedger.id,
             debit: isDebit ? Math.abs(data.roundOff) : 0,
             credit: isDebit ? 0 : data.roundOff
          }
       });
       await tx.ledger.update({ 
          where: { id: roundLedger.id }, 
          data: { currentBalance: { increment: isDebit ? Math.abs(data.roundOff) : -data.roundOff } }
       });
    }

    await tx.ledger.update({
       where: { id: debitLedger.id },
       data: { currentBalance: { increment: data.totalAmount + data.roundOff } }
    });
    
    await tx.ledger.update({
       where: { id: salesLedger.id },
       data: { currentBalance: { increment: data.totalAmount - data.totalTax } }
    });

  });

  revalidatePath('/history');
  revalidatePath('/dashboard');
  revalidatePath('/inventory');
}
