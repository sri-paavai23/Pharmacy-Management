"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getBusinessSettings() {
  let settings = await prisma.businesssettings.findUnique({
    where: { id: "1" }
  });

  if (!settings) {
    settings = await prisma.businesssettings.create({
      data: {
        id: "1",
        pharmacyName: "Vellammal Pharmacy",
        dlNumber: "DL-123456",
        gstin: "33AAAAA0000A1Z5",
        contactInfo: "Salem, Tamil Nadu. Ph: 9876543210",
        ownerDetails: "Pharmacy Owner",
        updatedAt: new Date(),
      }
    });
  }
  return settings;
}

export async function updateBusinessSettings(data: {
  pharmacyName: string;
  dlNumber: string;
  gstin: string;
  contactInfo: string;
  ownerDetails: string;
}) {
  await prisma.businesssettings.update({
    where: { id: "1" },
    data: { ...data, updatedAt: new Date() }
  });
  revalidatePath("/");
}
