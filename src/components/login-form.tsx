"use client";

import { FormEvent, useState } from "react";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !result.success) {
        setError(result.error ?? "登录失败");
        return;
      }

      window.location.replace("/");
    } catch {
      setError("暂时无法连接服务器");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-medium text-[#374151]"
        >
          管理员密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-[#111827] outline-none transition focus:border-[#3730A3] focus:ring-2 focus:ring-[#3730A3]/10"
          placeholder="输入密码"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-[#3730A3] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#312E81] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "正在登录…" : "进入文档库"}
      </button>
    </form>
  );
}
