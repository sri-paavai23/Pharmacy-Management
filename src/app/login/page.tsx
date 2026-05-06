import { LoginClient } from "./LoginClient";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function LoginPage() {
  const auth = cookies().get("auth_user");
  if (auth) {
    redirect("/dashboard");
  }

  return <LoginClient />;
}
