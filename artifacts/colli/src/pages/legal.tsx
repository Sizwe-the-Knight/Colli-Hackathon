import React, { useEffect } from 'react';
import { Link } from 'wouter';
import { LegalFooter } from '../components/legal-footer';
import './legal.css';

const contact = <a href="mailto:a.a.downsouth@gmail.com">a.a.downsouth@gmail.com</a>;

function Policy({ title, children }: { title: string; children: React.ReactNode }) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Colli`;
    window.scrollTo(0, 0);
    return () => { document.title = previous; };
  }, [title]);
  return <div className="legal-page">
    <header className="legal-header"><Link href="/brief" aria-label="Colli home"><img src="/colli-icon.png" alt="" />Colli</Link><Link href="/login">Sign in</Link></header>
    <main className="legal-document" id="policy">
      <p className="legal-eyebrow">Independent web beta</p>
      <h1>{title}</h1>
      <p className="legal-date">Last updated: 26 October 2026</p>
      {children}
    </main>
    <LegalFooter />
  </div>;
}

export function Privacy() {
  return <Policy title="Privacy Policy">
    <p>Colli is an independently operated hackathon web beta, run by its founder. This policy covers the Colli beta, not the AI services named in its demonstration. For privacy questions, contact {contact}.</p>
    <h2>What we collect and why</h2>
    <ul>
      <li><strong>Your account:</strong> name, email address, a one-way password hash, and account creation/update times. These let us create and protect your account. We do not store your password as readable text.</li>
      <li><strong>Your choices:</strong> selected AI providers, saved for onboarding and display preferences. Selecting a provider does not connect its account, give us access to it, or import its activity.</li>
      <li><strong>Session and security records:</strong> account identifiers, sign-in/activity/expiry times, session identifiers and revocation records, used to keep you signed in and reject invalid sessions. Login and registration limits use a hash derived from your IP address or network, with attempt counters and timing information. This hash is a security identifier, not a guarantee of anonymity.</li>
      <li><strong>Technical logs:</strong> request paths, methods, response status, timing and request identifiers help diagnose errors and abuse. The application is configured to exclude request bodies, query strings, passwords and session-cookie values from its routine request logs. Hosting and network providers also process connection information.</li>
      <li><strong>Messages you send us:</strong> your email and message contents are used to respond to support, feedback or privacy requests.</li>
    </ul>
    <h2>Cookies, preferences and demonstration data</h2>
    <p>Colli uses an essential session cookie to sign you in. On the hosted beta it is HTTPS-only and unavailable to browser scripts. Sessions are designed to expire after 24 hours of inactivity or seven days from sign-in, whichever comes first; expiry does not mean every stored security record is immediately deleted. Your theme preference is stored locally in your browser.</p>
    <p>The Brief and Dashboard display synthetic or sample metrics, not actual provider-account activity. The beta has no advertising trackers or third-party product-analytics integration. When available, “Explain with NVIDIA Nemotron” sends only bounded findings from Colli’s synthetic demonstration to Nebius Token Factory to generate an explanation. Example provider names reflect your saved choices; the raw preference list is not sent. It does not send your name, email, session information or private provider activity. There is no generation on login, page load or refresh.</p>
    <h2>Services involved</h2>
    <p>Render hosts the application and its logs; Neon stores account, preference, session and security data in PostgreSQL. Render’s Cloudflare network processes web traffic and supplies the client address used for abuse protection. These services process data to deliver and secure the beta.</p>
    <p>For optional explanations, Nebius processes the synthetic findings using NVIDIA Nemotron and receives the backend’s connection information. Colli stores hashed account/report identifiers, reservation times and accepted synthetic explanations in Neon to enforce spending limits and reuse results. These account-linked hashes are not a guarantee of anonymity. Failed attempts also count toward the allowance. Turning generation off or reaching its limit keeps the deterministic explanation available.</p>
    <p>The page loads Google Fonts, so your browser sends Google your IP address and ordinary font-request information. See <a href="https://developers.google.com/fonts/faq/privacy">Google Fonts’ privacy information</a>. Contact emails are handled through Gmail. Providers may process information outside your country; their infrastructure, support and backup arrangements apply.</p>
    <h2>Retention and your choices</h2>
    <p>Account and preference records remain stored unless removed through a reviewed request. There is no automatic account-deletion feature or single fixed retention period covering all beta data. Session expiry, security cleanup, hosting logs and any backups have different lifecycles. Backup copies and records needed for security or legal obligations may remain after active account data is removed; we cannot promise immediate erasure from every system.</p>
    <p>Email {contact} to request access, correction or account deletion, or to raise a privacy concern. We may ask for limited information to verify ownership; never send your password or API keys. Requests are handled manually, and we will explain any retention or technical limitation. Depending on applicable law, you may also have rights to restrict or object to processing, obtain a portable copy, or complain to your local data-protection authority.</p>
    <p>We use the information above to provide the beta you request, protect it against abuse and answer you. No security system is infallible. We will update this notice if the beta’s data handling changes and identify the revision date here.</p>
  </Policy>;
}

export function Terms() {
  return <Policy title="Terms of Service">
    <p>These terms cover your use of Colli, a free, independently operated hackathon web beta run by its founder. By creating an account or using the beta, you agree to these terms. If you do not agree, do not use it. Questions can be sent to {contact}.</p>
    <h2>A demonstration, not your provider account</h2>
    <p>Colli demonstrates ways to understand AI activity. Its current Brief and Dashboard use synthetic or sample data. Provider selections are preferences, not account connections. No displayed cost, subscription, trend, recommendation or sample score establishes what is happening in your own accounts. “Not assessed” means there is not enough evidence for a score.</p>
    <p>Optional NVIDIA Nemotron explanations use only the synthetic demonstration and are subject to a limited allowance. Colli uses deterministic explanations when generation is unavailable. Explanations and suggestions can be incomplete or wrong. Verify relevant source information before acting; Colli is not financial, legal or other professional advice.</p>
    <h2>Using the beta responsibly</h2>
    <p>Use an email address you control, keep your password private and tell us if you suspect account misuse. Do not submit provider passwords, API keys, confidential business information or other people’s personal data. Do not attempt to access other accounts, bypass safeguards, disrupt the service or use it unlawfully. Report security concerns privately to the contact above.</p>
    <h2>Availability and changes</h2>
    <p>The beta is provided for evaluation, with no payment or subscription required. Features may change or be withdrawn. Free hosting may cause delays or outages; availability, accuracy, continued access and preservation of data are not guaranteed. Do not rely on Colli as your only record of important information. Access may be restricted to protect users, address misuse or comply with law.</p>
    <h2>Privacy and leaving</h2>
    <p>The <Link href="/privacy">Privacy Policy</Link> explains account, session and third-party processing. You may stop using Colli at any time. For account closure or deletion, email {contact}; there is no automated deletion control. We verify ownership and explain any records that must or may remain.</p>
    <h2>Responsibility and limits</h2>
    <p>To the extent permitted by applicable law, the beta is provided “as is” and “as available”, without warranties of fitness for a particular purpose or uninterrupted, error-free operation. To that same extent, the operator is not liable for indirect or consequential losses, such as lost profits, resulting from use of or inability to use the beta.</p>
    <p>Nothing in these terms excludes liability for fraud, deliberate misconduct, or any liability that cannot legally be limited, or removes mandatory consumer or privacy rights. No particular governing jurisdiction or exclusive court is specified by these beta terms.</p>
    <h2>Updates and contact</h2>
    <p>Changes will be posted here with an updated date. Material changes will be brought to testers’ attention before they apply. Contact {contact} about these terms, privacy, account requests or problems with the beta.</p>
  </Policy>;
}
