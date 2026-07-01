import Link from "next/link";
import { Shield01Icon } from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/huge-icon";
import styles from "./legal-document-layout.module.scss";

export function LegalDocumentLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          <HugeIcon icon={Shield01Icon} size={20} className={styles.logoIcon} />
          SecureTarget
        </Link>
        <Link href="/" className={styles.backLink}>
          Back to home
        </Link>
      </header>

      <main className={styles.main}>
        <article className={styles.article}>
          <header className={styles.docHeader}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.updated}>Last updated: {updated}</p>
          </header>
          <div className={styles.body}>{children}</div>
        </article>
      </main>

      <footer className={styles.footer}>
        <nav className={styles.footerNav} aria-label="Legal">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms &amp; Conditions</Link>
        </nav>
        <p className={styles.footerCopy}>&copy; {new Date().getFullYear()} SecureTarget. All rights reserved.</p>
      </footer>
    </div>
  );
}
