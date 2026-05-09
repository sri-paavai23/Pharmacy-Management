import { LoginClient } from "./LoginClient";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const auth = (await cookies()).get("auth_user");
  if (auth) {
    redirect("/dashboard");
  }

  return <LoginClient />;
}
