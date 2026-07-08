import { useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { About } from "./components/About";
import { Services } from "./components/Services";
import { Advertisers } from "./components/Advertisers";
import { Publishers } from "./components/Publishers";
import { Products } from "./components/Products";
import { Contact } from "./components/Contact";
import { Footer } from "./components/Footer";
import { CookieConsent } from "./components/CookieConsent";
import { initAnalytics, initEngagementTracking } from "./lib/analytics";
import { getAnalyticsConsent } from "./lib/cookie-consent";

export default function App() {
  useEffect(() => {
    if (getAnalyticsConsent()) {
      initAnalytics();
      initEngagementTracking();
    }
  }, []);

  function onConsentApplied(analytics: boolean) {
    if (analytics) {
      initEngagementTracking();
    }
  }

  return (
    <>
      <CookieConsent onConsentApplied={onConsentApplied} />
      <Navbar />
      <main>
        <Hero />
        <About />
        <Services />
        <Advertisers />
        <Publishers />
        <Products />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
