"use server";

import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";


interface SalePayload {
  customerId?: string;
  doctorId?: string; 
  financialYearId: string;
  newCustomer?: { name: string; phone: string };
  newDoctor?: { name: string; registrationNumber: string };
  items: {
    batchId: string;
    quantity: number;
    unitPrice: number;
    unitPurchasePrice: number;
  }[];
  totalAmount: number;
  totalTax: number;
  roundOff: number;
  paymentMode: string; // "CASH", "UPI", "CARD"
  source?: string; // "POS", "COUNTER", "SENIOR_CARE"
}


export async function processSale(data: SalePayload) {
  let totalProfit = 0;
  for (const item of data.items) {
    totalProfit += (item.unitPrice - item.unitPurchasePrice) * item.quantity;
  }
  // Include manual adjustment (roundOff) in the profit
  totalProfit += data.roundOff;

  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {

    // 0. Validate Financial Year exists — prevents FK violation from stale cookies
    const fy = await tx.financialyear.findUnique({ where: { id: data.financialYearId } });
    if (!fy) {
      throw new Error(
        `Financial Year not found (ID: ${data.financialYearId}). ` +
        `Your session may be using a stale period. Please refresh the page and re-select the Financial Year from the header.`
      );
    }

    // 1. Validation & Stock Check
    let requiresDoctor = false;
    for (const item of data.items) {
      const batchWithProduct = await tx.batch.findUnique({
        where: { id: item.batchId },
        select: { 
          currentStock: true, 
          batchNumber: true,
          product: { select: { scheduleH1: true } } 
        }
      });
      
      if (!batchWithProduct || batchWithProduct.currentStock < item.quantity) {
        throw new Error(`Insufficient stock for batch ${batchWithProduct?.batchNumber || item.batchId}`);
      }

      if (batchWithProduct.product?.scheduleH1) {
        requiresDoctor = true;
      }
    }

    if (requiresDoctor && !data.doctorId && !data.newDoctor?.name) {
      throw new Error("Schedule H1 drug detected. A prescribing doctor is mandatory for this sale.");
    }

    // 2. Handle new customer creation
    let activeCustomerId = data.customerId || null;
    if (data.newCustomer?.name) {
      const created = await tx.customer.create({
        data: { id: randomUUID(), name: data.newCustomer.name, phone: data.newCustomer.phone }
      });
      activeCustomerId = created.id;
    }

    // 3. Handle new doctor creation
    let activeDoctorId = data.doctorId || null;
    if (data.newDoctor?.name) {
       const created = await tx.doctor.create({
          data: { id: randomUUID(), name: data.newDoctor.name, registrationNumber: data.newDoctor.registrationNumber }
       });
       activeDoctorId = created.id;
    }

    // 4. Create the Sale
    const sale = await tx.sale.create({
      data: {
        id: randomUUID(),
        invoiceNumber,
        customerId: activeCustomerId,
        doctorId: activeDoctorId,
        totalAmount: data.totalAmount + data.roundOff, // Grand Total including adjustment
        totalTax: data.totalTax,
        totalProfit,
        roundOff: data.roundOff,
        source: data.source || "POS",
        paymentMode: data.paymentMode,
        financialYearId: data.financialYearId,
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

    // 5. Update stock levels
    for (const item of data.items) {
      await tx.batch.update({
        where: { id: item.batchId },
        data: { currentStock: { decrement: item.quantity } }
      });

      await tx.stockadjustment.create({
        data: {
          id: randomUUID(),
          batchId: item.batchId,
          type: "Reduction",
          reason: `Sale ${invoiceNumber}`,
          quantity: item.quantity,
        }
      });
    }

    // 6. AUTOMATED ACCOUNTING (Journal Entry)
    // Find required ledgers for the current financial year
    const findLedger = async (name: string) => {
       const ledger = await tx.ledger.findFirst({
          where: { name, financialYearId: data.financialYearId }
       });
       if (!ledger) throw new Error(`Ledger '${name}' not found for Financial Year. Initialize via Settings.`);
       return ledger;
    };

    // Select the appropriate payment ledger based on mode
    let debitLedgerName = "Cash";
    if (data.paymentMode === "UPI") debitLedgerName = "UPI"; // Or "Bank"
    if (data.paymentMode === "CARD") debitLedgerName = "Bank Accounts"; // Typical for card

    let debitLedger;
    try {
      debitLedger = await findLedger(debitLedgerName);
    } catch {
      // Fallback to Cash if specific ledger not found
      debitLedger = await findLedger("Cash");
    }

    const salesLedger = await findLedger("Sales Account");


    const journalEntry = await tx.journalentry.create({
      data: {
        id: randomUUID(),
        voucherNumber: `VOC/SAL/${sale.invoiceNumber}`,
        voucherType: "Sales",
        financialYearId: data.financialYearId,
        narration: `${data.source || "POS"} Sale - ${invoiceNumber}`,
        saleId: sale.id,
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
       const isDebit = data.roundOff < 0; // Negative roundOff means we reduced the bill (Dr Round Off)
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

  revalidatePath('/dashboard');
  revalidatePath('/inventory');
  revalidatePath('/pos');
  revalidatePath('/reports');
  revalidatePath('/counter-sale');
}

