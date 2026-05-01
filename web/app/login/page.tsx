import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="flex max-w-lg flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Sign in</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Access your SecureTarget dashboard and API keys.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <LoginForm />
      </Suspense>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No account?{" "}
        <Link href="/register" className="font-medium text-zinc-900 underline dark:text-zinc-100">
          Register
        </Link>
      </p>
    </div>
  );
}
