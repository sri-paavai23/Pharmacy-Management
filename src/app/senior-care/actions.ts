"use server";

import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";


export async function generateDeliveryInvoice(subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { customer: true }
  });

  if (!subscription) throw new Error("Subscription not found");

  let medicines: Array<{ productId: string, quantity: number }>;
  try {
    medicines = JSON.parse(subscription.medicines);
  } catch {
    throw new Error("Invalid medicines data format in subscription");
  }

  const invoiceNumber = `SC-${Date.now().toString().slice(-6)}`;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    let totalAmount = 0;
    let totalTax = 0;
    let totalProfit = 0;
    const saleItems = [];

    // Process each medicine
    for (const med of medicines) {
      const product = await tx.product.findUnique({
        where: { id: med.productId },
        include: {
          batch: {
            where: { currentStock: { gt: 0 } },
            orderBy: { expiryDate: 'asc' }
          }
        }
      });

      if (!product || product.batch.length === 0) {
        throw new Error(`Item ${product?.name || med.productId} is out of stock`);
      }

      // Simple FIFO stock deduction
      let remainingQty = med.quantity;
      
      for (const batch of product.batch) {
        if (remainingQty <= 0) break;

        const deductQty = Math.min(batch.currentStock, remainingQty);
        remainingQty -= deductQty;
        
        const itemTotal = batch.mrp * deductQty;
        const taxVal = itemTotal - (itemTotal / (1 + (product.taxRate / 100)));
        const profit = (batch.mrp - batch.purchasePrice) * deductQty;

        totalAmount += itemTotal;
        totalTax += taxVal;
        totalProfit += profit;

        saleItems.push({
          batchId: batch.id,
          quantity: deductQty,
          unitPrice: batch.mrp,
          unitPurchasePrice: batch.purchasePrice,
        });

        // Update stock
        await tx.batch.update({
          where: { id: batch.id },
          data: { currentStock: { decrement: deductQty } }
        });
      }

      if (remainingQty > 0) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
    }

    // Rounding
    const roundedTotal = Math.round(totalAmount);
    const roundOff = roundedTotal - totalAmount;

    // Create Sale
    // Find active FY
    const activeFY = await tx.financialyear.findFirst({ where: { isActive: true } });
    if (!activeFY) throw new Error("No active financial year found");

    const sale = await tx.sale.create({
      data: {
        id: randomUUID(),
        invoiceNumber,
        customerId: subscription.customerId,
        totalAmount: roundedTotal,
        totalTax,
        totalProfit: totalProfit + roundOff,
        roundOff,
        source: "SENIOR_CARE",
        paymentMode: "CASH", 
        financialYearId: activeFY.id,
        saleitem: {
          create: saleItems.map(i => ({ id: randomUUID(), ...i }))
        }
      }
    });

    // Accounting - Journal Entry
    const findLedger = async (name: string) => {
      const l = await tx.ledger.findFirst({ where: { name, financialYearId: activeFY.id } });
      if (!l) throw new Error(`Ledger ${name} not found`);
      return l;
    };

    const cashLedger = await findLedger("Cash");
    const salesLedger = await findLedger("Sales Account");

    const journalEntry = await tx.journalentry.create({
      data: {
        id: randomUUID(),
        voucherNumber: `VOC/SAL/${sale.invoiceNumber}`,
        voucherType: "Sales",
        financialYearId: activeFY.id,
        narration: `Senior Care Delivery - ${invoiceNumber}`,
        saleId: sale.id,
        journalline: {
          create: [
            { id: randomUUID(), ledgerId: cashLedger.id, debit: roundedTotal, credit: 0 },
            { id: randomUUID(), ledgerId: salesLedger.id, debit: 0, credit: totalAmount - totalTax },
          ]
        }
      }
    });

    if (totalTax > 0) {
      const taxLedger = await findLedger("Output GST 12%");
      await tx.journalline.create({
        data: { id: randomUUID(), journalEntryId: journalEntry.id, ledgerId: taxLedger.id, debit: 0, credit: totalTax }
      });
      await tx.ledger.update({ where: { id: taxLedger.id }, data: { currentBalance: { increment: totalTax } } });
    }

    if (roundOff !== 0) {
      const roundLedger = await findLedger("Round Off");
      const isDebit = roundOff < 0;
      await tx.journalline.create({
        data: {
          id: randomUUID(),
          journalEntryId: journalEntry.id,
          ledgerId: roundLedger.id,
          debit: isDebit ? Math.abs(roundOff) : 0,
          credit: isDebit ? 0 : roundOff
        }
      });
      await tx.ledger.update({ 
        where: { id: roundLedger.id }, 
        data: { currentBalance: { increment: isDebit ? Math.abs(roundOff) : -roundOff } } 
      });
    }

    await tx.ledger.update({ where: { id: cashLedger.id }, data: { currentBalance: { increment: roundedTotal } } });
    await tx.ledger.update({ where: { id: salesLedger.id }, data: { currentBalance: { increment: totalAmount - totalTax } } });

    // Update subscription next delivery date
    const nextDate = new Date(subscription.nextDeliveryDate);
    nextDate.setDate(nextDate.getDate() + subscription.frequencyDays);

    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        nextDeliveryDate: nextDate,
        deliveryStatus: "Dispatched"
      }
    });
  });

  revalidatePath('/senior-care');
  revalidatePath('/pos');
  revalidatePath('/dashboard');
  revalidatePath('/inventory');
}

export async function advanceDeliveryStatus(subscriptionId: string, currentStatus: string) {
  const newStatus = currentStatus === "Pending" ? "Dispatched" : currentStatus === "Dispatched" ? "Delivered" : "Pending";
  
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { deliveryStatus: newStatus }
  });
  revalidatePath('/senior-care');
}
