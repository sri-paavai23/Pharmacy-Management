"use server";

// PIN login system removed — these are kept as no-ops so existing imports don't break

export async function loginWithPin(_pin: string) {
  return { success: true, role: "ADMIN" };
}

export async function logout() {
  // no-op
}
