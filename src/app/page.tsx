import { redirect } from "next/navigation";

// Root sends users into the app; the (app) layout enforces auth and bounces
// unauthenticated visitors to /login.
export default function HomePage() {
  redirect("/dashboard");
}
