import { RotatingText } from "./RotatingText";
import styles from "./Hero.module.scss";

const ROTATING_WORDS = ["Strategy", "Campaigns", "Partnerships", "Results"];

export function Hero() {
  return (
    <section id="home" className={styles.hero}>
      <div className={styles.gradient} aria-hidden />

      <div className={styles.inner}>
        <p className={styles.eyebrow}>Marketing services, delivered with intent</p>

        <h1 className={styles.title}>
          Growth built on
          <br />
          <RotatingText words={ROTATING_WORDS} className={styles.rotate} />
        </h1>

        <p className={styles.lead}>
          TrustTargets is a services-led marketing partner. We design, run, and refine digital and affiliate programs
          for brands that want clear ownership, honest reporting, and outcomes that show up in the numbers.
        </p>

        <div className={styles.actions}>
          <a href="#contact" className={styles.primaryBtn}>
            Start a conversation
          </a>
          <a href="#services" className={styles.secondaryBtn}>
            See what we do
          </a>
        </div>

        <div className={styles.chips} aria-label="What we focus on">
          {ROTATING_WORDS.map((word) => (
            <span key={word} className={styles.chip}>
              {word}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
