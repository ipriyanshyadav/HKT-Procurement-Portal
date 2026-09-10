import { redirect } from "next/navigation";

export default function BusinessUnitsRedirectPage() {
  redirect("/organization/structure?tab=business-units");
}
