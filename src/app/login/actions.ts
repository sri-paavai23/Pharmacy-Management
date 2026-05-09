"use server";

import prisma from "@/lib/db";
import { cookies } from "next/headers";

export async function loginWithPin(pin: string) {
  const user = await prisma.user.findFirst({
    where: { pinCode: pin, isActive: true }
  });

  if (!user) {
    throw new Error("Invalid PIN or account disabled");
  }

  // Set auth cookie
  ;(await cookies()).set("auth_user", JSON.stringify({
    id: user.id,
    name: user.name,
    role: user.role
  }), {
    maxAge: 60 * 60 * 12, // 12 hours
    path: "/"
  });

  return { success: true, role: user.role };
}

export async function logout() {
  ;(await cookies()).delete("auth_user");
}
