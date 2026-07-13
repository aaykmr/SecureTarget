import { LegalDocumentLayout } from "@/components/legal-document-layout";

export function PrivacyPage() {
  return (
    <LegalDocumentLayout title="Privacy Policy" updated="30 June 2026">
      <section>
        <h2>1. Introduction</h2>
        <p>
          EventIQN (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides privacy-first install and campaign
          attribution software, including a dashboard, ingest API, and client SDKs. This Privacy Policy explains what
          information we process when you use our website, dashboard, and attribution services, and the choices
          available to you.
        </p>
      </section>

      <section>
        <h2>2. Information we collect</h2>
        <p>Depending on how you use EventIQN, we may process:</p>
        <ul>
          <li>
            <strong>Account information</strong> — name, email address, and authentication credentials when you
            register or sign in.
          </li>
          <li>
            <strong>Project and API data</strong> — project names, API keys (stored in hashed form), campaign
            configuration, tracking links, and dashboard activity.
          </li>
          <li>
            <strong>Attribution and event data</strong> — events sent by your apps through our SDKs or API, such as
            installs, sessions, conversions, campaign parameters, and hashed session tokens.
          </li>
          <li>
            <strong>Device matching data</strong> — limited technical signals used for install attribution (for example
            advertising identifiers, install referrer, IP address at session bootstrap, and deep-link parameters) stored
            in a separate device database operated for matching purposes.
          </li>
          <li>
            <strong>Billing information</strong> — if you subscribe through our payment provider, payment status and
            subscription metadata (payment card details are handled by the payment processor, not stored by us).
          </li>
          <li>
            <strong>Website usage</strong> — standard server logs and cookies required for authentication and security.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. How we use information</h2>
        <p>We use collected information to:</p>
        <ul>
          <li>Provide, operate, and improve the EventIQN platform;</li>
          <li>Authenticate users and secure accounts;</li>
          <li>Match ad clicks to installs and report attribution outcomes to your dashboard;</li>
          <li>Process subscriptions and enforce plan limits where applicable;</li>
          <li>Respond to support requests and comply with legal obligations.</li>
        </ul>
        <p>
          We do not sell personal information. Our product is designed so customer attribution databases store hashed
          tokens and campaign outcomes rather than raw end-user identifiers where possible.
        </p>
      </section>

      <section>
        <h2>4. Your responsibilities as a customer</h2>
        <p>
          If you integrate EventIQN into your apps, you are responsible for providing appropriate privacy notices
          to your end users, obtaining any required consents, and configuring the SDK to collect only data permitted
          under your policies and applicable law. Do not send unnecessary personally identifiable information in event
          payloads.
        </p>
      </section>

      <section>
        <h2>5. Data retention</h2>
        <p>
          We retain account and attribution data for as long as your account is active or as needed to provide the
          service. You may request deletion of your account data by contacting us. Aggregated or de-identified data may
          be retained for analytics and service improvement.
        </p>
      </section>

      <section>
        <h2>6. Security</h2>
        <p>
          We implement technical and organizational measures designed to protect information, including hashed storage
          of API keys and session tokens, access controls on the dashboard, and separation of device matching data from
          customer attribution records. No method of transmission or storage is completely secure.
        </p>
      </section>

      <section>
        <h2>7. International transfers</h2>
        <p>
          If you access EventIQN from outside the country where our infrastructure is hosted, your information may
          be transferred to and processed in other jurisdictions. We take steps to ensure appropriate safeguards where
          required by law.
        </p>
      </section>

      <section>
        <h2>8. Your rights</h2>
        <p>
          Depending on your location, you may have rights to access, correct, delete, or restrict processing of your
          personal information, or to object to certain processing. To exercise these rights, contact us using the
          details below. If you are an end user of a customer&apos;s app, please contact that app publisher first.
        </p>
      </section>

      <section>
        <h2>9. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will post the revised version on this page and update
          the &quot;Last updated&quot; date. Material changes may also be communicated through the dashboard or by
          email where appropriate.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>
          Questions about this Privacy Policy or our data practices can be sent to{" "}
          <a href="mailto:privacy@eventiqn.trusttargets.com">privacy@eventiqn.trusttargets.com</a>.
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
