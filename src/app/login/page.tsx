import { redirect } from "next/navigation";

export default async function LoginPage() {
  // PIN login system removed — always redirect to dashboard
  redirect("/dashboard");
}
