"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

// Vendor Actions
export async function addVendor(data: { companyName: string; contactPerson: string; phone: string; gstin: string }) {
  await prisma.vendor.create({ data: { id: randomUUID(), ...data } });
  revalidatePath('/settings');
  revalidatePath('/purchases');
}

export async function deleteVendor(id: string) {
  await prisma.vendor.delete({ where: { id } });
  revalidatePath('/settings');
}

// Doctor Actions
export async function addDoctor(data: { name: string; registrationNumber: string; phone?: string }) {
  await prisma.doctor.create({ data: { id: randomUUID(), ...data } });
  revalidatePath('/settings');
  revalidatePath('/pos');
}

export async function deleteDoctor(id: string) {
  await prisma.doctor.delete({ where: { id } });
  revalidatePath('/settings');
}

// User Actions
export async function addUser(data: { name: string; pinCode: string; role: string }) {
  await prisma.user.create({ data: { id: randomUUID(), ...data } });
  revalidatePath('/settings');
}

export async function deleteUser(id: string) {
  await prisma.user.delete({ where: { id } });
  revalidatePath('/settings');
}



// Financial Year Actions
export async function addFinancialYear(data: { name: string; startDate: string; endDate: string }) {
  await prisma.financialyear.create({
    data: {
      id: randomUUID(),
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      isActive: false
    }
  });
  revalidatePath('/settings');
}

export async function toggleFinancialYearStatus(id: string, field: 'isActive' | 'isClosed', value: boolean) {
  if (field === 'isActive' && value === true) {
     // Deactivate all others first
     await prisma.financialyear.updateMany({ data: { isActive: false } });
  }
  await prisma.financialyear.update({
    where: { id },
    data: { [field]: value }
  });
  revalidatePath('/settings');
}

