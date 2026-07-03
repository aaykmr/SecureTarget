import styles from "./Services.module.scss";

const SERVICE_TAGS = [
  "Performance marketing",
  "Affiliate programs",
  "Influencer & social",
  "Go-to-market launches",
] as const;

export function Services() {
  return (
    <section id="services" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.layout}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>What we do</p>
            <h2 className={styles.title}>Full-funnel marketing services, end to end</h2>
            <p className={styles.body}>
              We don&apos;t sell a black-box platform and walk away. TrustTargets embeds with your team to plan
              campaigns, manage partners, produce assets, and read performance — then adjust week over week.
            </p>
            <p className={styles.body}>
              From paid social and display to affiliate and influencer, our services are scoped to your goals: awareness,
              acquisition, or revenue — with the rigor to prove what moved the needle.
            </p>
          </div>

          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Why teams choose us</h3>
            <p className={styles.panelBody}>
              You get senior attention on every account, formats that fit mobile and web, and a single team that speaks
              both brand language and partner economics. We obsess over creative that converts and relationships that
              last beyond a single flight.
            </p>
            <ul className={styles.tags}>
              {SERVICE_TAGS.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
