import { FormEvent, useState } from "react";
import * as yup from "yup";
import {
  trackContactError,
  trackContactSubmit,
  trackContactSuccess,
} from "../lib/analytics";
import {
  contactFormSchema,
  formatPhoneE164,
  type ContactFormValues,
} from "../lib/contact-form-schema";
import {
  getDefaultCountryOption,
  type CountryDialOption,
} from "../lib/country-dial-options";
import { PhoneCountryField } from "./PhoneCountryField";
import styles from "./Contact.module.scss";

const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SHEETS_SCRIPT_URL?.trim();

const EMPTY_FORM: ContactFormValues = {
  name: "",
  email: "",
  nationalNumber: "",
  message: "",
};

type FieldErrors = Partial<Record<keyof ContactFormValues, string>>;

export function Contact() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<ContactFormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [country, setCountry] = useState<CountryDialOption>(getDefaultCountryOption);

  function updateField<K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function resetForm() {
    setValues(EMPTY_FORM);
    setFieldErrors({});
    setCountry(getDefaultCountryOption());
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    let validated: ContactFormValues;
    try {
      validated = await contactFormSchema.validate(values, { abortEarly: false });
    } catch (err) {
      if (err instanceof yup.ValidationError) {
        const next: FieldErrors = {};
        for (const issue of err.inner) {
          const key = issue.path as keyof ContactFormValues | undefined;
          if (key && !next[key]) {
            next[key] = issue.message;
          }
        }
        setFieldErrors(next);
      }
      return;
    }

    if (!SCRIPT_URL) {
      trackContactError("not_configured");
      setError(
        "Form is not configured yet. Email hello@trusttargets.com instead.",
      );
      return;
    }

    const data = {
      name: validated.name,
      email: validated.email,
      phone: formatPhoneE164(country.dial, validated.nationalNumber),
      message: validated.message,
    };

    trackContactSubmit();
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

      trackContactSuccess();
      setSent(true);
      resetForm();
    } catch {
      trackContactError("request_failed");
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

          <form className={styles.form} onSubmit={onSubmit} noValidate>
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
                    value={values.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    autoComplete="name"
                    placeholder="Your name"
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.name)}
                  />
                  {fieldErrors.name ? (
                    <span className={styles.fieldError}>{fieldErrors.name}</span>
                  ) : null}
                </label>
                <label className={styles.field}>
                  <span>Work email *</span>
                  <input
                    name="email"
                    type="email"
                    value={values.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    autoComplete="email"
                    placeholder="you@company.com"
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.email)}
                  />
                  {fieldErrors.email ? (
                    <span className={styles.fieldError}>{fieldErrors.email}</span>
                  ) : null}
                </label>
                <PhoneCountryField
                  country={country}
                  nationalNumber={values.nationalNumber}
                  onCountryChange={setCountry}
                  onNationalNumberChange={(value) => updateField("nationalNumber", value)}
                  disabled={submitting}
                  error={fieldErrors.nationalNumber}
                />
                <label className={styles.field}>
                  <span>How can we help? *</span>
                  <textarea
                    name="message"
                    rows={4}
                    value={values.message}
                    onChange={(e) => updateField("message", e.target.value)}
                    placeholder="Briefly describe your goals, markets, or partnership interest."
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.message)}
                  />
                  {fieldErrors.message ? (
                    <span className={styles.fieldError}>{fieldErrors.message}</span>
                  ) : null}
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
