import { FormEvent, useState } from "react";
import styles from "./Contact.module.scss";

const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SHEETS_SCRIPT_URL?.trim();

export function Contact() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!SCRIPT_URL) {
      setError(
        "Form is not configured yet. Email hello@trusttargets.com instead.",
      );
      return;
    }

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value.trim(),
      email: (
        form.elements.namedItem("email") as HTMLInputElement
      ).value.trim(),
      phone: (
        form.elements.namedItem("phone") as HTMLInputElement
      ).value.trim(),
      message: (
        form.elements.namedItem("message") as HTMLTextAreaElement
      ).value.trim(),
    };

    setSubmitting(true);

    try {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(data),
      });

      const result = (await response.json()) as { ok?: boolean };
      if (!response.ok || !result.ok) {
        throw new Error("Submission failed");
      }

      setSent(true);
      form.reset();
    } catch {
      setError(
        "Could not send your message. Please email hello@trusttargets.com.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="contact" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.layout}>
          <div className={styles.info}>
            <p className={styles.eyebrow}>Let&apos;s talk</p>
            <h2 className={styles.title}>Tell us what you&apos;re building</h2>
            <p className={styles.lead}>
              Whether you need campaign support, affiliate scale, or a publisher
              partnership — reach out and we&apos;ll connect you with the right
              person on our team.
            </p>

            <div className={styles.block}>
              <span className={styles.blockLabel}>General inquiries</span>
              <a href="mailto:hello@trusttargets.com" className={styles.link}>
                hello@trusttargets.com
              </a>
            </div>

            <div className={styles.block}>
              <span className={styles.blockLabel}>Corporate office</span>
              <p className={styles.text}>Gurgaon, India</p>
            </div>
          </div>

          <form className={styles.form} onSubmit={onSubmit}>
            <h3 className={styles.formTitle}>Send a message</h3>
            {sent ? (
              <p className={styles.success}>
                Message received — we&apos;ll reply within one business day.
              </p>
            ) : (
              <>
                {error ? <p className={styles.error}>{error}</p> : null}
                <label className={styles.field}>
                  <span>Full name *</span>
                  <input
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Your name"
                    disabled={submitting}
                  />
                </label>
                <label className={styles.field}>
                  <span>Work email *</span>
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    disabled={submitting}
                  />
                </label>
                <label className={styles.field}>
                  <span>Phone *</span>
                  <input
                    name="phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="+1 …"
                    disabled={submitting}
                  />
                </label>
                <label className={styles.field}>
                  <span>How can we help? *</span>
                  <textarea
                    name="message"
                    rows={4}
                    required
                    placeholder="Briefly describe your goals, markets, or partnership interest."
                    disabled={submitting}
                  />
                </label>
                <button
                  type="submit"
                  className={styles.submit}
                  disabled={submitting}
                >
                  {submitting ? "Sending…" : "Submit"}
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
