import styles from "./About.module.scss";

export function About() {
  return (
    <section id="about" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>Who we are</p>
          <h2 className={styles.title}>Operators first — not slide decks and handoffs</h2>
        </div>

        <p className={styles.lead}>
          We&apos;re a services company built around marketing execution. Our team blends media planning, creative
          direction, affiliate operations, and analytics so clients get one accountable partner instead of a patchwork
          of vendors. Whether you&apos;re launching in a new market or tightening spend on what already works, we stay
          close to the work.
        </p>

        <div className={styles.cards}>
          <article className={styles.card}>
            <span className={styles.cardLabel}>Vision</span>
            <p className={styles.cardText}>
              To set the standard for trustworthy, transparent marketing services — where clients, partners, and our
              team all win from work that is measurable and fairly run.
            </p>
          </article>
          <article className={styles.card}>
            <span className={styles.cardLabel}>Mission</span>
            <p className={styles.cardText}>
              To help brands and publishers grow through expert-led campaign services, practical technology, and
              reporting people can actually use to make decisions.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
