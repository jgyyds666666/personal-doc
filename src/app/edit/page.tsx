import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileEditor } from "@/components/editor/file-editor";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "编辑文件",
};

export default async function EditPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string | string[] }>;
}) {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const params = await searchParams;
  const storageKey = typeof params.key === "string" ? params.key : "";
  if (!storageKey) {
    redirect("/");
  }

  return <FileEditor storageKey={storageKey} />;
}
