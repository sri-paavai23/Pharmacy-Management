import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function Home() {
  const auth = cookies().get("auth_user");
  if (!auth) {
    redirect("/login");
  } else {
    redirect("/dashboard");
  }
}

