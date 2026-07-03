import styles from "./Integrations.module.scss";

const PARTNERS = [
  "Meta",
  "Google Ads",
  "TikTok",
  "Snapchat",
  "Taboola",
  "Outbrain",
  "AppsFlyer",
  "Adjust",
] as const;

export function Integrations() {
  return (
    <section className={styles.section} aria-labelledby="integrations-title">
      <div className={styles.container}>
        <p className={styles.eyebrow}>Tooling</p>
        <h2 id="integrations-title" className={styles.title}>
          Platforms we activate every day
        </h2>
        <p className={styles.sub}>
          We integrate with the ad stacks and measurement tools your team already trusts — so service delivery stays
          fast and auditable.
        </p>
        <div className={styles.marquee} aria-hidden>
          <div className={styles.track}>
            {[...PARTNERS, ...PARTNERS].map((name, i) => (
              <span key={`${name}-${i}`} className={styles.pill}>
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
