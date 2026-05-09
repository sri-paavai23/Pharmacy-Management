import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const auth = (await cookies()).get("auth_user");
  if (!auth) {
    redirect("/login");
  } else {
    redirect("/dashboard");
  }
}

