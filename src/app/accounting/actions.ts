"use server";

import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

export async function addAccountGroup(data: { name: string; nature: string }) {
  await prisma.accountgroup.create({ data: { id: randomUUID(), ...data } });
  revalidatePath('/accounting/masters');
}

export async function addLedger(data: {
  name: string;
  groupId: string;
  financialYearId: string;
  openingBalance: number;
  balanceType: "Dr" | "Cr";
}) {
  await prisma.ledger.create({
    data: {
      id: randomUUID(),
      ...data,
      currentBalance: data.openingBalance,
    }
  });
  revalidatePath('/accounting/masters');
}

export async function createVoucher(data: {
  voucherType: string;
  date: Date | string;
  financialYearId: string;
  narration?: string;
  lines: { ledgerId: string; debit: number; credit: number }[];
}) {
  // Validate Dr = Cr
  const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = data.lines.reduce((sum, l) => sum + l.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error("Total Debits must equal Total Credits.");
  }

  const voucherNumber = `VOC/${data.voucherType.slice(0, 3).toUpperCase()}/${Date.now()}`;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {

    await tx.journalentry.create({
      data: {
        id: randomUUID(),
        voucherNumber,
        voucherType: data.voucherType,
        date: new Date(data.date),
        financialYearId: data.financialYearId,
        narration: data.narration,
        journalline: {
          create: data.lines.map(l => ({ id: randomUUID(), ...l }))
        }
      }
    });

    // Update balances
    for (const line of data.lines) {
       // Logic: Debit increases asset/expense, Credit increases liability/income.
       // CurrentBalance in DB will be a signed float for simplicity where Dr is positive? 
       // No, let's just stick to the ledger nature.
       const ledger = await tx.ledger.findUnique({ where: { id: line.ledgerId } });
       if (!ledger) throw new Error("Ledger not found");

       const adj = ledger.balanceType === "Dr" ? (line.debit - line.credit) : (line.credit - line.debit);

       await tx.ledger.update({
          where: { id: line.ledgerId },
          data: { currentBalance: { increment: adj } }
       });
    }

  });

  revalidatePath('/counter-sale');
  revalidatePath('/reports');
}
