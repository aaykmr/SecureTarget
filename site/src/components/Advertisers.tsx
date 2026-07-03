import styles from "./Advertisers.module.scss";

const STEPS = [
  {
    title: "Discover",
    items: [
      "Audience and channel mapping aligned to your KPIs",
      "Dedicated account leads — not a ticket queue",
      "Media plans shaped by category experience",
    ],
  },
  {
    title: "Run",
    items: [
      "Campaign setup, trafficking, and partner coordination",
      "Weekly performance readouts with clear next steps",
      "Creative testing tied to funnel stage",
    ],
  },
  {
    title: "Improve",
    items: [
      "Post-campaign analysis with actionable takeaways",
      "Budget shifts toward what's working",
      "Roadmaps to scale across regions and formats",
    ],
  },
] as const;

export function Advertisers() {
  return (
    <section id="advertisers" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>For brands &amp; agencies</p>
          <h2 className={styles.title}>How we work with advertisers</h2>
          <p className={styles.intro}>
            We act as an extension of your marketing team — owning execution while you keep strategic control.
          </p>
        </div>

        <div className={styles.grid}>
          {STEPS.map((step, i) => (
            <article key={step.title} className={styles.card}>
              <span className={styles.stepNum}>{String(i + 1).padStart(2, "0")}</span>
              <h3 className={styles.cardTitle}>{step.title}</h3>
              <ul className={styles.list}>
                {step.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
