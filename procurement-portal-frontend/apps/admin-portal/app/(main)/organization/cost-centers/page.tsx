import { redirect } from "next/navigation";

export default function CostCentersRedirectPage() {
  redirect("/organization/structure?tab=cost-centers");
}
