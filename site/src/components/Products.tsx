import styles from "./Products.module.scss";

const PRODUCTS = [
  {
    name: "BlockBlitz",
    tagline: "Mobile game",
    description:
      "A fast-paced block puzzle built for mobile — designed for quick sessions, sharp reflexes, and replayable fun.",
  },
  {
    name: "EventIQN",
    tagline: "MMP tool",
    description:
      "Mobile measurement made practical — attribution, campaign insights, and partner reporting in one place.",
  },
] as const;

export function Products() {
  return (
    <section id="products" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>Products</p>
          <h2 className={styles.title}>Coming soon</h2>
          <p className={styles.intro}>
            We&apos;re building products alongside our services — tools and
            experiences that reflect how we think about growth, measurement, and
            engagement.
          </p>
        </div>

        <div className={styles.grid}>
          {PRODUCTS.map((product) => (
            <article key={product.name} className={styles.card}>
              <span className={styles.badge}>Coming soon</span>
              <h3 className={styles.cardTitle}>{product.name}</h3>
              <p className={styles.tagline}>{product.tagline}</p>
              <p className={styles.description}>{product.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
