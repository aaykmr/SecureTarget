import styles from "./Publishers.module.scss";

const BENEFITS = [
  {
    title: "Fair economics",
    text: "Direct relationships and competitive rates — no opaque middle layers eating margin.",
  },
  {
    title: "Global demand",
    text: "Campaigns across regions and verticals, matched to inventory that fits your audience.",
  },
  {
    title: "Reliable ops",
    text: "On-time validation, straightforward reporting, and people who respond when traffic shifts.",
  },
] as const;

export function Publishers() {
  return (
    <section id="publishers" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>For publishers &amp; partners</p>
          <h2 className={styles.title}>Inventory deserves a serious commercial partner</h2>
          <p className={styles.intro}>
            We bring quality demand, respect compliance, and treat publishers as long-term partners — not a line item.
          </p>
        </div>

        <div className={styles.grid}>
          {BENEFITS.map((b) => (
            <article key={b.title} className={styles.card}>
              <h3 className={styles.cardTitle}>{b.title}</h3>
              <p className={styles.cardText}>{b.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
