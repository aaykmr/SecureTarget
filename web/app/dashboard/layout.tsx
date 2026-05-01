import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            SecureTarget
          </Link>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Dashboard</span>
        </div>
        <SignOutButton />
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}
