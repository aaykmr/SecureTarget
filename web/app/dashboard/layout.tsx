import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { SignOutButton } from "@/components/sign-out-button";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black">
      <DashboardSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <SignOutButton />
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
