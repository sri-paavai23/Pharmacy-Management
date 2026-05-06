"use server";

import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getEmbedding } from "@/lib/voice-utils";
import { randomUUID } from "crypto";


export async function adjustStock(batchId: string, quantity: number, type: "Addition" | "Reduction", reason: string) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  
  if (!batch) throw new Error("Batch not found");

  const newStock = type === "Addition" ? batch.currentStock + quantity : batch.currentStock - quantity;

  if (newStock < 0) {
    throw new Error("Resulting stock cannot be less than 0");
  }

  await prisma.$transaction([
    prisma.stockadjustment.create({
      data: {
        id: randomUUID(),
        batchId,
        type,
        reason,
        quantity,
      }
    }),
    prisma.batch.update({
      where: { id: batchId },
      data: { currentStock: newStock }
    })
  ]);

  revalidatePath('/inventory');
  revalidatePath('/dashboard');
}

export async function processPurchaseInvoice(data: {
  vendorId: string;
  financialYearId: string;
  invoiceNumber: string;
  totalAmount: number;
  roundOff: number;
  items: Array<{
    productId?: string;
    name?: string;
    manufacturer?: string;
    category?: string;
    hsnCode?: string;
    taxRate?: number;
    isPrescriptionRequired?: boolean;
    scheduleH1?: boolean;
    packSize?: number;
    batchNumber: string;
    expiryDate: Date | string;
    mrp: number;
    purchasePrice: number;
    sellingPrice: number;
    currentStock: number;
    locationRack: string;
  }>;
  invoiceDate?: string | Date; // Added optional invoice date
}) {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {

    // 1. Validate FY and find core ledgers
    const purchaseGroup = await tx.accountgroup.findFirst({ where: { name: "Purchase Accounts" } });
    const taxGroup = await tx.accountgroup.findFirst({ where: { name: "Duties & Taxes" } });
    const creditorGroup = await tx.accountgroup.findFirst({ where: { name: "Sundry Creditors" } });
    const expenseGroup = await tx.accountgroup.findFirst({ where: { name: "Indirect Expenses" } });

    if (!data.financialYearId) {
      throw new Error("Financial Year ID is missing. Please select a Financial Year.");
    }

    if (!purchaseGroup || !taxGroup || !creditorGroup || !expenseGroup) {
      throw new Error("Core accounting masters not found. Please run seed script.");
    }

    let purchaseLedger = await tx.ledger.findFirst({ where: { name: "Purchase Account", financialYearId: data.financialYearId } });
    if (!purchaseLedger) {
       purchaseLedger = await tx.ledger.create({ 
         data: { 
           id: randomUUID(),
           name: "Purchase Account", 
           groupId: purchaseGroup.id, 
           financialYearId: data.financialYearId, 
           openingBalance: 0, 
           balanceType: "Dr",
           currentBalance: 0
         } 
       });
    }

    let taxLedger = await tx.ledger.findFirst({ where: { name: "Input GST 12%", financialYearId: data.financialYearId } });
    if (!taxLedger) {
       taxLedger = await tx.ledger.create({ 
         data: { 
           id: randomUUID(),
           name: "Input GST 12%", 
           groupId: taxGroup.id, 
           financialYearId: data.financialYearId, 
           openingBalance: 0, 
           balanceType: "Dr",
           currentBalance: 0
         } 
       });
    }

    let roundOffLedger = await tx.ledger.findFirst({ where: { name: "Round Off", financialYearId: data.financialYearId } });
    if (!roundOffLedger) {
      roundOffLedger = await tx.ledger.create({ 
        data: { 
          id: randomUUID(),
          name: "Round Off", 
          groupId: expenseGroup.id, 
          financialYearId: data.financialYearId, 
          openingBalance: 0, 
          balanceType: "Dr",
          currentBalance: 0
        } 
      });
    }

    // Vendor Ledger
    const vendor = await tx.vendor.findUnique({ where: { id: data.vendorId } });
    if (!vendor) throw new Error("Vendor not found");
    
    let vendorLedger = await tx.ledger.findFirst({ where: { name: vendor.companyName, financialYearId: data.financialYearId } });
    if (!vendorLedger) {
       vendorLedger = await tx.ledger.create({ 
         data: { 
           id: randomUUID(),
           name: vendor.companyName, 
           groupId: creditorGroup.id, 
           financialYearId: data.financialYearId, 
           openingBalance: 0, 
           balanceType: "Cr",
           currentBalance: 0
         } 
       });
    }

    // 2. Check if invoice number already exists
    const existing = await tx.purchase.findFirst({ 
      where: { invoiceNumber: data.invoiceNumber, vendorId: data.vendorId, financialYearId: data.financialYearId } 
    });
    if (existing) {
      throw new Error(`Invoice number ${data.invoiceNumber} already exists for this vendor in this FY`);
    }

    // Calculate Tax (rough split)
    const baseValue = (data.totalAmount - data.roundOff) / 1.12;
    const taxValue = (data.totalAmount - data.roundOff) - baseValue;

    // 3. Create the purchase record
    const purchase = await tx.purchase.create({
      data: {
        id: randomUUID(),
        vendorId: data.vendorId,
        financialYearId: data.financialYearId,
        invoiceNumber: data.invoiceNumber,
        totalAmount: data.totalAmount,
        status: "Received",
        date: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
      }
    });

    // 4. Create Journal Entry
    await tx.journalentry.create({
      data: {
        id: randomUUID(),
        voucherNumber: `PUR/${vendor.companyName.slice(0,3).toUpperCase()}/${Date.now()}`,
        voucherType: "Purchase",
        date: new Date(),
        financialYearId: data.financialYearId,
        purchaseId: purchase.id,
        narration: `Purchase from ${vendor.companyName} inv #${data.invoiceNumber}${data.roundOff !== 0 ? ' [RoundOff: ' + data.roundOff + ']' : ''}`,
        journalline: {
          create: [
            { id: randomUUID(), ledgerId: purchaseLedger.id, debit: baseValue, credit: 0 },
            { id: randomUUID(), ledgerId: taxLedger.id, debit: taxValue, credit: 0 },
            { id: randomUUID(), ledgerId: roundOffLedger.id, debit: data.roundOff > 0 ? data.roundOff : 0, credit: data.roundOff < 0 ? Math.abs(data.roundOff) : 0 },
            { id: randomUUID(), ledgerId: vendorLedger.id, debit: 0, credit: data.totalAmount }
          ]
        }
      }
    });

    // Update balances
    await tx.ledger.update({ where: { id: purchaseLedger.id }, data: { currentBalance: { increment: baseValue } } });
    await tx.ledger.update({ where: { id: taxLedger.id }, data: { currentBalance: { increment: taxValue } } });
    await tx.ledger.update({ where: { id: vendorLedger.id }, data: { currentBalance: { increment: data.totalAmount } } });
    await tx.ledger.update({ where: { id: roundOffLedger.id }, data: { currentBalance: { increment: data.roundOff } } });


    // 5. Process each item
    for (const item of data.items) {
      // ── Validation ──
      if (!item.name || item.name.trim() === '') {
        throw new Error(`Row ${data.items.indexOf(item) + 1}: Product name is empty.`);
      }
      if (!item.batchNumber || item.batchNumber.trim() === '') {
        throw new Error(`Row ${data.items.indexOf(item) + 1} (${item.name}): Batch number is required.`);
      }
      if (!item.expiryDate) {
        throw new Error(`Row ${data.items.indexOf(item) + 1} (${item.name}): Expiry date is required.`);
      }
      if (item.purchasePrice <= 0) {
        throw new Error(`Row ${data.items.indexOf(item) + 1} (${item.name}): Purchase Rate must be greater than zero.`);
      }

      let productId: string | undefined = item.productId?.trim() || undefined;

      if (!productId) {
        // NEW DRUG path: create product with safe defaults for all required fields
        if (!item.name?.trim()) throw new Error(`New drug entry is missing a product name.`);
        const newProd = await tx.product.create({
          data: {
            id:                    randomUUID(),
            name:                  item.name.trim(),
            manufacturer:          item.manufacturer?.trim()  || 'Unknown',
            category:              item.category?.trim()      || 'General',
            hsnCode:               item.hsnCode?.trim()       || '30049099', // Default pharma HSN
            taxRate:               item.taxRate               ?? 12,
            isPrescriptionRequired: item.isPrescriptionRequired || false,
            scheduleH1:            item.scheduleH1            || false,
            packSize:              item.packSize               || 1
          }
        });
        productId = newProd.id;

        // Generate embedding for new product
        try {
          const embedding = await getEmbedding(item.name!);
          const vectorString = `[${embedding.join(",")}]`;
          await tx.$executeRawUnsafe(
            `UPDATE product SET embedding = VEC_FromText('${vectorString}') WHERE id = '${productId}'`
          );
        } catch (embedError) {
          console.error("Non-fatal: Failed to generate embedding for new product", embedError);
          // We don't fail the whole transaction for this
        }
      } else {
        // EXISTING PRODUCT path — verify the product actually exists in DB
        // This prevents FK violation if user typed a name but didn't pick from the datalist
        const existingProd = await tx.product.findUnique({ where: { id: productId } });
        if (!existingProd) {
          throw new Error(
            `Row "${item.name}": No inventory product found with the selected ID. ` +
            `Please select a valid product from the dropdown, or switch to "NEW DRUG" mode.`
          );
        }
        // Update packSize if changed
        await tx.product.update({
          where: { id: productId },
          data: { packSize: item.packSize || existingProd.packSize }
        });
      }


      const batch = await tx.batch.create({
        data: {
          id: randomUUID(),
          productId,
          batchNumber: item.batchNumber,
          expiryDate: new Date(item.expiryDate),
          mrp: item.mrp,
          purchasePrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,
          currentStock: item.currentStock,
          locationRack: item.locationRack,
          updatedAt: new Date(),
        }
      });

      await tx.purchaseitem.create({
        data: {
          id: randomUUID(),
          purchaseId: purchase.id,
          batchId: batch.id,
          quantity: item.currentStock,
          purchasePrice: item.purchasePrice,
        }
      });

      await tx.stockadjustment.create({
        data: {
          id: randomUUID(),
          batchId: batch.id,
          type: "Addition",
          reason: "New Purchase",
          quantity: item.currentStock,
        }
      });
    }
  }).catch(err => {
    console.error("TRANSACTION ERROR:", err);
    throw err;
  });
  revalidatePath('/inventory');
  revalidatePath('/purchases');
}

/**
 * Utility to generate embeddings for products that don't have them.
 * Can be called manually from a maintenance UI or script.
 */
export async function generateProductEmbeddings() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productsWithoutEmbeddings = await prisma.$queryRawUnsafe<any[]>(
    'SELECT id, name FROM product WHERE embedding IS NULL'
  );

  console.log(`Found ${productsWithoutEmbeddings.length} products needing embeddings.`);

  for (const product of productsWithoutEmbeddings) {
    try {
      console.log(`Generating embedding for: ${product.name}`);
      const embedding = await getEmbedding(product.name);
      const vectorString = `[${embedding.join(",")}]`;
      
      await prisma.$executeRawUnsafe(
        `UPDATE product SET embedding = VEC_FromText('${vectorString}') WHERE id = '${product.id}'`
      );
    } catch (err) {
      console.error(`Failed to generate embedding for ${product.name}:`, err);
    }
  }

  return { updated: productsWithoutEmbeddings.length };
}

export async function deletePurchaseInvoice(purchaseId: string) {
  await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({ where: { id: purchaseId }, include: { purchaseitem: true } });
    if (!purchase) throw new Error("Purchase not found");
    
    const je = await tx.journalentry.findFirst({ where: { purchaseId } });
    if (je) {
       const jls = await tx.journalline.findMany({ where: { journalEntryId: je.id } });
       for (const jl of jls) {
         const netChange = jl.credit - jl.debit;
         if (netChange > 0) {
            await tx.ledger.update({ where: { id: jl.ledgerId }, data: { currentBalance: { decrement: netChange } } });
         } else if (netChange < 0) {
            await tx.ledger.update({ where: { id: jl.ledgerId }, data: { currentBalance: { increment: Math.abs(netChange) } } });
         }
       }
       await tx.journalline.deleteMany({ where: { journalEntryId: je.id } });
       await tx.journalentry.delete({ where: { id: je.id } });
    }

    for (const pi of purchase.purchaseitem) {
       await tx.batch.update({
         where: { id: pi.batchId },
         data: { currentStock: { decrement: pi.quantity } }
       });
       await tx.stockadjustment.deleteMany({
         where: { batchId: pi.batchId, reason: "New Purchase" }
       });
       await tx.purchaseitem.delete({ where: { id: pi.id } });
    }

    await tx.purchase.delete({ where: { id: purchaseId } });
  });
  revalidatePath('/inventory');
  revalidatePath('/purchases');
}
