import { redirect } from "next/navigation";
import FileVault from "@/components/file-vault";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  return <FileVault />;
}
