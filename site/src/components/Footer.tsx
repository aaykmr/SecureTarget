import { BrandLogo } from "./BrandLogo";
import styles from "./Footer.module.scss";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <BrandLogo wordmarkClassName={styles.brandWordmark} />
        </div>
        <nav className={styles.nav} aria-label="Footer">
          <a href="#about">About</a>
          <a href="#services">Services</a>
          <a href="#advertisers">Brands</a>
          <a href="#publishers">Partners</a>
          <a href="#products">Products</a>
          <a href="#contact">Contact</a>
        </nav>
        <p className={styles.copy}>
          &copy; {year} TrustTargets Tech Private Limited. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
