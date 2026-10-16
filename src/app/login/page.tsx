import { redirect } from "next/navigation";
import LoginForm from "@/components/login-form";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAuthenticated()) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-6 py-12">
      <section className="w-full max-w-sm rounded-xl border border-[#E5E7EB] bg-white p-7 shadow-sm">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#3730A3]">
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 0h10.5A2.25 2.25 0 0119.5 12.75v6A2.25 2.25 0 0117.25 21H6.75a2.25 2.25 0 01-2.25-2.25v-6a2.25 2.25 0 012.25-2.25z"
            />
          </svg>
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-[#111827]">
          私人文档库
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#6B7280]">
          这是私人空间，请验证管理员密码后继续。
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
