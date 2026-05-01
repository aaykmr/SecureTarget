import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">SecureTarget</h1>
      <p className="max-w-md text-center text-sm text-zinc-600 dark:text-zinc-400">
        Dashboard for projects and API keys. Run the ingest backend separately to receive SDK events.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          Register
        </Link>
      </div>
    </div>
  );
}
