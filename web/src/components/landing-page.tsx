import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Analytics01Icon,
  ArrowDown01Icon,
  ComputerIcon,
  GameController01Icon,
  InstallingUpdates01Icon,
  Link01Icon,
  Megaphone01Icon,
  Rocket01Icon,
  Shield01Icon,
  SmartPhone01Icon,
  Tv01Icon,
  WebDesign01Icon,
} from "@hugeicons/core-free-icons";
import { api, ApiError } from "@/api/client";
import { HugeIcon } from "@/components/huge-icon";
import { PhoneCountryField } from "@/components/phone-country-field";
import {
  formatPhoneE164,
  validateWaitlistForm,
  type WaitlistFieldErrors,
  type WaitlistFormValues,
} from "@/lib/waitlist-form";
import { getDefaultCountryOption, type CountryDialOption } from "@/lib/country-dial-options";
import styles from "./landing-page.module.scss";

const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SHEETS_SCRIPT_URL?.trim();

const EMPTY_WAITLIST: WaitlistFormValues = {
  name: "",
  email: "",
  nationalNumber: "",
  organization: "",
  message: "",
};

const CHANNELS = [
  { label: "Apps", icon: SmartPhone01Icon },
  { label: "Web", icon: WebDesign01Icon },
  { label: "CTV", icon: Tv01Icon },
  { label: "PC", icon: ComputerIcon },
  { label: "Console", icon: GameController01Icon },
] as const;

const FEATURES = [
  {
    title: "Mobile-grade measurement",
    description:
      "Attribute installs and conversions with the same rigor on apps and web — campaign links, deep links, and install referrer built in.",
    icon: InstallingUpdates01Icon,
    image:
      "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Person using a phone after converting from a digital campaign",
  },
  {
    title: "Every digital touchpoint",
    description:
      "Unify signals across apps, web, CTV, PC, console, and beyond — so every click, impression, and open lands in one measurement layer.",
    icon: Link01Icon,
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Team reviewing omnichannel campaign performance on a laptop",
  },
  {
    title: "AI-ready infrastructure",
    description:
      "Clean, structured event data you control — hashed where it should be, ready for models, pipelines, and decisions that compound growth.",
    icon: Shield01Icon,
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Analytics workspace with charts and structured measurement data",
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Connect EventIQN",
    text: "Create a project, issue an API key, and ship the Web, iOS, or Android SDK.",
    image:
      "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Developer integrating EventIQN SDK into application code",
  },
  {
    n: "02",
    title: "Capture every signal",
    text: "Run campaign links and ingest events across apps, web, and expanding touchpoints.",
    image:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Team launching campaigns across multiple digital channels",
  },
  {
    n: "03",
    title: "Decide and grow",
    text: "See attribution, organic vs paid, and funnel outcomes — fuel for smarter, faster growth.",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Dashboard showing attributed growth across digital channels",
  },
] as const;

export function LandingPage() {
  const [waitlistSent, setWaitlistSent] = useState(false);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [values, setValues] = useState<WaitlistFormValues>(EMPTY_WAITLIST);
  const [fieldErrors, setFieldErrors] = useState<WaitlistFieldErrors>({});
  const [country, setCountry] = useState<CountryDialOption>(getDefaultCountryOption);

  function updateField<K extends keyof WaitlistFormValues>(key: K, value: WaitlistFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function onWaitlistSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWaitlistError(null);
    const errors = validateWaitlistForm(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const digits = values.nationalNumber.replace(/\D/g, "");
    const phone = digits ? formatPhoneE164(country.dial, values.nationalNumber) : "";
    const payload = {
      name: values.name.trim(),
      email: values.email.trim(),
      phone,
      organization: values.organization.trim(),
      message: values.message.trim(),
    };

    setWaitlistSubmitting(true);
    try {
      await api.submitWaitlist(payload);
      if (SCRIPT_URL) {
        try {
          await fetch(SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ sheet: "EventIQNWaitlist", ...payload }),
          });
        } catch {
          // Sheets is best-effort mirror; API is source of truth for admin.
        }
      }
      setWaitlistSent(true);
      setValues(EMPTY_WAITLIST);
      setCountry(getDefaultCountryOption());
      setFieldErrors({});
    } catch (err) {
      setWaitlistError(
        err instanceof ApiError ? err.message : "Could not submit. Please try again or email hello@trusttargets.com.",
      );
    } finally {
      setWaitlistSubmitting(false);
    }
  }

  return (
    <div className={styles.landing}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.glowSecondary} aria-hidden />

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.logo}>
            <HugeIcon icon={Shield01Icon} size={22} className={styles.logoIcon} />
            EventIQN
          </Link>
          <nav className={styles.headerNav}>
            <a href="#signals" className={styles.headerLink}>
              Signals
            </a>
            <a href="#how-it-works" className={styles.headerLink}>
              How it works
            </a>
            <Link to="/login" className={styles.headerLink}>
              Sign in
            </Link>
            <a href="#waitlist" className={styles.btnHeader}>
              Start tracking
            </a>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <section className={`${styles.fold} ${styles.heroFold}`}>
          <div className={styles.foldInner}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <p className={styles.brandMark}>EventIQN</p>
                <h1 className={styles.heroTitle}>
                  Deliver the right <span className={styles.heroAccent}>signals</span>
                </h1>
                <p className={styles.heroLead}>
                  AI-ready infrastructure and mobile-grade measurement across every digital touchpoint—from apps
                  and web to CTV, PC, console, and beyond.
                </p>
                <div className={styles.heroActions}>
                  <a href="#waitlist" className={styles.btnPrimary}>
                    <HugeIcon icon={Rocket01Icon} size={18} />
                    Start tracking
                  </a>
                  <Link to="/login" className={styles.btnSecondary}>
                    Sign in
                  </Link>
                </div>
              </div>

              <div className={styles.heroVisual} aria-hidden>
                <div className={styles.flowCard}>
                  <div className={`${styles.flowRow} ${styles.flowRowHighlight}`}>
                    <HugeIcon icon={Analytics01Icon} size={18} className={styles.flowIconActive} />
                    <div className={styles.flowText}>
                      <span className={styles.flowLabel}>Attributed</span>
                      <span className={styles.flowBadge}>98% confidence</span>
                    </div>
                  </div>
                  <div className={styles.flowConnector} />
                  <div className={styles.flowRow}>
                    <HugeIcon icon={InstallingUpdates01Icon} size={18} className={styles.flowIcon} />
                    <div className={styles.flowText}>
                      <span className={styles.flowLabel}>App install</span>
                      <span className={styles.flowMeta}>first open</span>
                    </div>
                  </div>
                  <div className={styles.flowConnector} />
                  <div className={styles.flowRow}>
                    <HugeIcon icon={Megaphone01Icon} size={18} className={styles.flowIcon} />
                    <div className={styles.flowText}>
                      <span className={styles.flowLabel}>Ad click</span>
                      <span className={styles.flowMeta}>meta · summer_sale</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ul className={styles.channelStrip} aria-label="Supported touchpoints">
              {CHANNELS.map((channel) => (
                <li key={channel.label} className={styles.channelItem}>
                  <HugeIcon icon={channel.icon} size={16} className={styles.channelIcon} />
                  {channel.label}
                </li>
              ))}
              <li className={`${styles.channelItem} ${styles.channelItemMuted}`}>+ more</li>
            </ul>

            <a href="#signals" className={styles.scrollHint} aria-label="Scroll to signals">
              <HugeIcon icon={ArrowDown01Icon} size={20} className={styles.scrollHintIcon} />
            </a>
          </div>
        </section>

        <section id="signals" className={`${styles.fold} ${styles.introFold}`}>
          <div className={styles.foldInner}>
            <div className={styles.statementBlock}>
              <p className={styles.foldLabel}>Growth infrastructure</p>
              <h2 className={styles.statementTitle}>
                Fuel smarter decisions and faster growth
              </h2>
              <p className={styles.statementLead}>
                with AI-ready data infrastructure and mobile-grade measurement across apps, web, CTV, PC, console,
                and more.
              </p>
            </div>
          </div>
        </section>

        {FEATURES.map((f, i) => (
          <section
            key={f.title}
            className={`${styles.fold} ${styles.featureFold} ${i % 2 === 1 ? styles.featureFoldAlt : ""}`}
          >
            <div className={styles.foldInner}>
              <article className={styles.featureBlock} style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
                <div className={styles.featureGrid}>
                  <div className={styles.featureCopy}>
                    <span className={styles.featureIndex}>{String(i + 1).padStart(2, "0")}</span>
                    <div className={styles.featureIconWrap}>
                      <HugeIcon icon={f.icon} size={32} className={styles.featureIconSvg} />
                    </div>
                    <h3 className={styles.featureTitle}>{f.title}</h3>
                    <p className={styles.featureText}>{f.description}</p>
                  </div>
                  <div className={styles.featurePhoto}>
                    <img src={f.image} alt={f.imageAlt} className={styles.photoImg} loading="lazy" />
                  </div>
                </div>
              </article>
            </div>
          </section>
        ))}

        <section id="how-it-works" className={`${styles.fold} ${styles.stepsFold}`}>
          <div className={styles.foldInner}>
            <p className={styles.foldLabel}>How it works</p>
            <h2 className={styles.sectionTitle}>From signal to decision</h2>
            <ol className={styles.stepList}>
              {STEPS.map((step, i) => (
                <li key={step.n} className={styles.stepItem} style={{ animationDelay: `${0.12 + i * 0.1}s` }}>
                  <div className={styles.stepPhoto}>
                    <img src={step.image} alt={step.imageAlt} className={styles.photoImg} loading="lazy" />
                    <span className={styles.stepPhotoBadge}>{step.n}</span>
                  </div>
                  <div className={styles.stepBody}>
                    <span className={styles.stepNum}>{step.n}</span>
                    <h3 className={styles.stepTitle}>{step.title}</h3>
                    <p className={styles.stepText}>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="waitlist" className={`${styles.fold} ${styles.ctaFold}`}>
          <div className={styles.foldInner}>
            <div className={styles.cta}>
              <HugeIcon icon={Rocket01Icon} size={40} className={styles.ctaIcon} />
              <h2 className={styles.ctaTitle}>Request early access</h2>
              <p className={styles.ctaLead}>
                Public signup is invite-only. Tell us about your org and we&apos;ll get you set up to start tracking.
              </p>
              <div className={styles.waitlistCard}>
                {waitlistSent ? (
                  <p className={styles.waitlistSuccess}>Thanks — you&apos;re on the list.</p>
                ) : (
                  <form className={styles.waitlistForm} onSubmit={onWaitlistSubmit} noValidate>
                    {waitlistError ? <p className={styles.waitlistError}>{waitlistError}</p> : null}
                    <label className={styles.waitlistField}>
                      <span>Name</span>
                      <input
                        name="name"
                        autoComplete="name"
                        value={values.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        aria-invalid={Boolean(fieldErrors.name)}
                      />
                      {fieldErrors.name ? <span className={styles.fieldError}>{fieldErrors.name}</span> : null}
                    </label>
                    <label className={styles.waitlistField}>
                      <span>Work email</span>
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={values.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        aria-invalid={Boolean(fieldErrors.email)}
                      />
                      {fieldErrors.email ? <span className={styles.fieldError}>{fieldErrors.email}</span> : null}
                    </label>
                    <PhoneCountryField
                      country={country}
                      nationalNumber={values.nationalNumber}
                      onCountryChange={setCountry}
                      onNationalNumberChange={(v) => updateField("nationalNumber", v)}
                      disabled={waitlistSubmitting}
                      error={fieldErrors.nationalNumber}
                    />
                    <label className={styles.waitlistField}>
                      <span>Organization</span>
                      <input
                        name="organization"
                        autoComplete="organization"
                        value={values.organization}
                        onChange={(e) => updateField("organization", e.target.value)}
                        aria-invalid={Boolean(fieldErrors.organization)}
                      />
                      {fieldErrors.organization ? (
                        <span className={styles.fieldError}>{fieldErrors.organization}</span>
                      ) : null}
                    </label>
                    <label className={styles.waitlistField}>
                      <span>Message</span>
                      <textarea
                        name="message"
                        rows={3}
                        placeholder="What are you looking to measure?"
                        value={values.message}
                        onChange={(e) => updateField("message", e.target.value)}
                      />
                    </label>
                    <button type="submit" className={styles.btnPrimary} disabled={waitlistSubmitting}>
                      {waitlistSubmitting ? "Submitting…" : "Start tracking"}
                    </button>
                  </form>
                )}
              </div>
            </div>
            <footer className={styles.footer}>
              <div className={styles.footerTop}>
                <span className={styles.footerBrand}>
                  <HugeIcon icon={Shield01Icon} size={18} />
                  EventIQN
                </span>
                <nav className={styles.footerNav} aria-label="Legal">
                  <Link to="/privacy" className={styles.footerLink}>
                    Privacy Policy
                  </Link>
                  <Link to="/terms" className={styles.footerLink}>
                    Terms &amp; Conditions
                  </Link>
                </nav>
              </div>
              <span className={styles.footerCopy}>
                AI-ready infrastructure · mobile-grade measurement
              </span>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
