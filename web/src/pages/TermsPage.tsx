import { Link } from "react-router-dom";
import { LegalDocumentLayout } from "@/components/legal-document-layout";

export function TermsPage() {
  return (
    <LegalDocumentLayout title="Terms & Conditions" updated="30 June 2026">
      <section>
        <h2>1. Agreement</h2>
        <p>
          These Terms &amp; Conditions (&quot;Terms&quot;) govern your access to and use of the SecureTarget website,
          dashboard, APIs, SDKs, and related services (collectively, the &quot;Service&quot;). By creating an account,
          accessing the Service, or using our software, you agree to these Terms. If you do not agree, do not use the
          Service.
        </p>
      </section>

      <section>
        <h2>2. Eligibility and accounts</h2>
        <p>
          You must be at least 18 years old and able to form a binding contract to use the Service. You are responsible
          for maintaining the confidentiality of your login credentials and for all activity under your account. Notify
          us promptly of any unauthorized access.
        </p>
      </section>

      <section>
        <h2>3. Permitted use</h2>
        <p>You may use SecureTarget only for lawful purposes and in accordance with these Terms. You agree not to:</p>
        <ul>
          <li>Use the Service to collect or process data in violation of applicable privacy or marketing laws;</li>
          <li>Reverse engineer, scrape, or attempt to extract source code except where permitted by law;</li>
          <li>Interfere with or disrupt the Service, circumvent rate limits, or abuse API keys;</li>
          <li>Upload malware, fraudulent traffic, or content that infringes third-party rights;</li>
          <li>Resell or sublicense the Service without our prior written consent.</li>
        </ul>
      </section>

      <section>
        <h2>4. API keys and integrations</h2>
        <p>
          API keys are issued for your projects and must be kept confidential. You are responsible for SDK integration,
          event payloads sent to our ingest endpoints, and compliance with store policies (including Apple App Store and
          Google Play requirements). We may suspend or revoke keys that pose a security risk or violate these Terms.
        </p>
      </section>

      <section>
        <h2>5. Subscriptions and billing</h2>
        <p>
          Certain features may require a paid subscription. Fees, billing cycles, and renewal terms are presented at
          checkout or in your dashboard. Payments are processed by third-party providers. Failure to pay may result in
          suspension of API access and key revocation until your account is brought current, as described in our product
          documentation.
        </p>
      </section>

      <section>
        <h2>6. Intellectual property</h2>
        <p>
          SecureTarget and its licensors retain all rights in the Service, including software, documentation, branding,
          and dashboards. You retain ownership of your app data and content you submit. You grant us a limited license
          to host, process, and display your data solely to provide and improve the Service.
        </p>
      </section>

      <section>
        <h2>7. Privacy</h2>
        <p>
          Our collection and use of personal information is described in our{" "}
          <Link to="/privacy">Privacy Policy</Link>, which is incorporated into these Terms by reference.
        </p>
      </section>

      <section>
        <h2>8. Disclaimers</h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
          WHETHER EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          Attribution results depend on device settings, platform policies, and data you provide; we do not guarantee
          perfect match rates or uninterrupted availability.
        </p>
      </section>

      <section>
        <h2>9. Limitation of liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, SECURETARGET AND ITS AFFILIATES WILL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL,
          ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE IS LIMITED TO
          THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM, OR ONE HUNDRED US
          DOLLARS (USD $100), WHICHEVER IS GREATER.
        </p>
      </section>

      <section>
        <h2>10. Termination</h2>
        <p>
          You may stop using the Service at any time. We may suspend or terminate access if you breach these Terms,
          create security or legal risk, or if we discontinue the Service. Upon termination, your right to use the
          Service ends; provisions that by their nature should survive will remain in effect.
        </p>
      </section>

      <section>
        <h2>11. Changes</h2>
        <p>
          We may modify these Terms from time to time. Updated Terms will be posted on this page with a revised
          &quot;Last updated&quot; date. Continued use of the Service after changes become effective constitutes
          acceptance of the revised Terms.
        </p>
      </section>

      <section>
        <h2>12. Governing law and contact</h2>
        <p>
          These Terms are governed by the laws applicable in the jurisdiction where SecureTarget operates, without regard
          to conflict-of-law principles. Questions about these Terms may be sent to{" "}
          <a href="mailto:legal@securetarget.app">legal@securetarget.app</a>.
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
