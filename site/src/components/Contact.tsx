import { FormEvent, useState } from "react";
import styles from "./Contact.module.scss";

export function Contact() {
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(true);
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
              <span className={styles.blockLabel}>Head office</span>
              <p className={styles.text}>Dehradun, India</p>
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
                <label className={styles.field}>
                  <span>Full name *</span>
                  <input
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Your name"
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
                  />
                </label>
                <label className={styles.field}>
                  <span>How can we help? *</span>
                  <textarea
                    name="message"
                    rows={4}
                    required
                    placeholder="Briefly describe your goals, markets, or partnership interest."
                  />
                </label>
                <button type="submit" className={styles.submit}>
                  Submit
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
