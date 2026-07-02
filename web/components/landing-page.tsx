"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Analytics01Icon,
  ArrowDown01Icon,
  InstallingUpdates01Icon,
  Link01Icon,
  Megaphone01Icon,
  MobileProgramming01Icon,
  Rocket01Icon,
  Shield01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/huge-icon";
import styles from "./landing-page.module.scss";

const INTRO_PHOTOS = [
  {
    src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=900&q=80",
    alt: "Growth team reviewing campaign performance together",
    className: styles.introPhotoMain,
  },
  {
    src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80",
    alt: "Analytics dashboard with install and conversion charts",
    className: styles.introPhotoSecondary,
  },
  {
    src: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=600&q=80",
    alt: "Mobile apps on a desk showing install attribution flow",
    className: styles.introPhotoTertiary,
  },
] as const;

const FEATURES = [
  {
    title: "Install attribution",
    description:
      "Know which campaign drove each install. Match clicks to first opens with tracking links, deep links, and Play Install Referrer.",
    icon: InstallingUpdates01Icon,
    image:
      "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Person holding a phone after installing an app from a campaign",
  },
  {
    title: "Campaign links",
    description:
      "OneLink-style URLs record touchpoints before redirecting to App Store, Play Store, or your web landing page.",
    icon: Link01Icon,
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Marketing team reviewing campaign performance on a laptop",
  },
  {
    title: "Privacy by design",
    description:
      "Customer data stays hashed and opaque. Device matching runs in a separate store you control — not sold to third parties.",
    icon: Shield01Icon,
    image:
      "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Secure data protection concept with lock and shield imagery",
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Create a project",
    text: "Generate an API key and drop in the Web, iOS, or Android SDK.",
    image:
      "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Developer integrating an SDK into application code",
  },
  {
    n: "02",
    title: "Share campaign links",
    text: "Use /v1/l/{slug} URLs in ads, email, and social — clicks are recorded server-side.",
    image:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Team collaborating on multi-channel campaign launches",
  },
  {
    n: "03",
    title: "Measure installs",
    text: "First open fires an install event; attribution resolves to media source and campaign.",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Dashboard showing attributed installs and campaign breakdown",
  },
] as const;

export function LandingPage() {
  return (
    <div className={styles.landing}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.glowSecondary} aria-hidden />

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.logo}>
            <HugeIcon icon={Shield01Icon} size={22} className={styles.logoIcon} />
            SecureTarget
          </Link>
          <nav className={styles.headerNav}>
            <a href="#features" className={styles.headerLink}>
              Features
            </a>
            <a href="#how-it-works" className={styles.headerLink}>
              How it works
            </a>
            <Link href="/login" className={styles.headerLink}>
              Sign in
            </Link>
            <Link href="/register" className={styles.btnHeader}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <section className={`${styles.fold} ${styles.heroFold}`}>
          <div className={styles.foldInner}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>
                  <HugeIcon icon={MobileProgramming01Icon} size={16} className={styles.eyebrowIcon} />
                  Privacy-first mobile measurement
                </p>
                <h1 className={styles.heroTitle}>
                  Know where every install <span className={styles.heroAccent}>comes from</span>
                </h1>
                <p className={styles.heroLead}>
                  SecureTarget is your own attribution layer — campaign links, install matching, and a dashboard
                  for organic vs paid — without handing user data to an external MMP.
                </p>
                <div className={styles.heroActions}>
                  <Link href="/register" className={styles.btnPrimary}>
                    <HugeIcon icon={Rocket01Icon} size={18} />
                    Start free
                  </Link>
                  <Link href="/login" className={styles.btnSecondary}>
                    Sign in
                  </Link>
                </div>
              </div>

              <div className={styles.heroVisual} aria-hidden>
                <div className={styles.flowCard}>
                  <div className={styles.flowRow}>
                    <HugeIcon icon={Megaphone01Icon} size={18} className={styles.flowIcon} />
                    <span className={styles.flowLabel}>Ad click</span>
                    <span className={styles.flowMeta}>meta · summer_sale</span>
                  </div>
                  <div className={styles.flowConnector} />
                  <div className={styles.flowRow}>
                    <HugeIcon icon={InstallingUpdates01Icon} size={18} className={styles.flowIcon} />
                    <span className={styles.flowLabel}>App install</span>
                    <span className={styles.flowMeta}>first open</span>
                  </div>
                  <div className={styles.flowConnector} />
                  <div className={`${styles.flowRow} ${styles.flowRowHighlight}`}>
                    <HugeIcon icon={Analytics01Icon} size={18} className={styles.flowIconActive} />
                    <span className={styles.flowLabel}>Attributed</span>
                    <span className={styles.flowBadge}>98% confidence</span>
                  </div>
                </div>
              </div>
            </div>
            <a href="#features" className={styles.scrollHint} aria-label="Scroll to features">
              <HugeIcon icon={ArrowDown01Icon} size={20} className={styles.scrollHintIcon} />
            </a>
          </div>
        </section>

        <section id="features" className={`${styles.fold} ${styles.introFold}`}>
          <div className={styles.foldInner}>
            <div className={styles.introGrid}>
              <div className={styles.introCopy}>
                <p className={styles.foldLabel}>Features</p>
                <h2 className={styles.sectionTitle}>
                  Built for growth teams
                  <br />
                  who care about data
                </h2>
                <p className={styles.introLead}>
                  From first click to attributed install — see the full funnel in a dashboard you own, with
                  measurement that respects user privacy.
                </p>
              </div>
              <div className={styles.introGallery} aria-hidden>
                {INTRO_PHOTOS.map((photo) => (
                  <div key={photo.src} className={photo.className}>
                    <Image
                      src={photo.src}
                      alt={photo.alt}
                      fill
                      sizes="(max-width: 900px) 90vw, 28rem"
                      className={styles.photoImg}
                    />
                  </div>
                ))}
              </div>
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
                    <Image
                      src={f.image}
                      alt={f.imageAlt}
                      fill
                      sizes="(max-width: 900px) 90vw, 36rem"
                      className={styles.photoImg}
                    />
                  </div>
                </div>
              </article>
            </div>
          </section>
        ))}

        <section id="how-it-works" className={`${styles.fold} ${styles.stepsFold}`}>
          <div className={styles.foldInner}>
            <p className={styles.foldLabel}>How it works</p>
            <h2 className={styles.sectionTitle}>Three steps to attributed installs</h2>
            <ol className={styles.stepList}>
              {STEPS.map((step, i) => (
                <li key={step.n} className={styles.stepItem} style={{ animationDelay: `${0.12 + i * 0.1}s` }}>
                  <div className={styles.stepPhoto}>
                    <Image
                      src={step.image}
                      alt={step.imageAlt}
                      fill
                      sizes="(max-width: 640px) 100vw, 12rem"
                      className={styles.photoImg}
                    />
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

        <section className={`${styles.fold} ${styles.ctaFold}`}>
          <div className={styles.foldInner}>
            <div className={styles.cta}>
              <HugeIcon icon={Rocket01Icon} size={40} className={styles.ctaIcon} />
              <h2 className={styles.ctaTitle}>Ready to own your attribution?</h2>
              <p className={styles.ctaLead}>Create a project, issue an API key, and ship the SDK in minutes.</p>
              <Link href="/register" className={styles.btnPrimary}>
                Create account
              </Link>
            </div>
            <footer className={styles.footer}>
              <div className={styles.footerTop}>
                <span className={styles.footerBrand}>
                  <HugeIcon icon={Shield01Icon} size={18} />
                  SecureTarget
                </span>
                <nav className={styles.footerNav} aria-label="Legal">
                  <Link href="/privacy" className={styles.footerLink}>
                    Privacy Policy
                  </Link>
                  <Link href="/terms" className={styles.footerLink}>
                    Terms &amp; Conditions
                  </Link>
                </nav>
              </div>
              <span className={styles.footerCopy}>Privacy-first install & campaign attribution</span>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
