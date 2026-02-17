import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
          <p className="text-slate-500 mt-2">Last updated: 17 February 2026</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 prose prose-slate max-w-none">
          
          <h2>1. Who We Are</h2>
          <p>MyCoachDeveloper is operated by Joe Morrissey, a UK based sole trader.</p>
          <p>For the purposes of UK data protection law, MyCoachDeveloper acts as the Data Controller in relation to personal data collected through the platform.</p>
          <p>If you have any questions about this policy, you can contact:</p>
          <p>Email: <a href="mailto:hello@mycoachdeveloper.com">hello@mycoachdeveloper.com</a></p>

          <h2>2. What This Policy Covers</h2>
          <p>This Privacy Policy explains:</p>
          <ul>
            <li>What personal data we collect</li>
            <li>How we use it</li>
            <li>Who we share it with</li>
            <li>How long we retain it</li>
            <li>Your legal rights</li>
            <li>How we protect your information</li>
          </ul>

          <h2>3. The Data We Collect</h2>
          <p>Depending on how you use the platform, we may collect:</p>
          
          <h3>Account Information</h3>
          <ul>
            <li>Full name</li>
            <li>Email address</li>
            <li>Password (encrypted)</li>
            <li>Club or organisation name</li>
            <li>Role within club</li>
          </ul>

          <h3>Coaching & Development Data</h3>
          <ul>
            <li>Session plans</li>
            <li>Observational notes</li>
            <li>Reflections</li>
            <li>Performance feedback</li>
            <li>AI generated outputs</li>
            <li>Development tracking data</li>
          </ul>

          <h3>Payment Information</h3>
          <p>Payments are processed securely by Stripe. We do not store full card details. We may store:</p>
          <ul>
            <li>Billing name</li>
            <li>Billing email</li>
            <li>Transaction history</li>
            <li>Subscription status</li>
          </ul>

          <h3>Technical Data</h3>
          <ul>
            <li>IP address</li>
            <li>Browser type</li>
            <li>Device information</li>
            <li>Usage data</li>
            <li>Cookies</li>
          </ul>

          <h2>4. Who Owns the Data</h2>
          <p>Where a coach is registered under a club or organisation account:</p>
          <ul>
            <li>The club or organisation is the owner of coaching and development data created within that account.</li>
            <li>Individual coaches have the right to access their own data.</li>
            <li>The club controls administrative access and account termination.</li>
          </ul>
          <p>For individual subscriptions not linked to a club, the individual user owns their data.</p>

          <h2>5. How We Use Your Data</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and operate the platform</li>
            <li>Manage user accounts</li>
            <li>Deliver AI generated coaching support</li>
            <li>Process payments</li>
            <li>Maintain security</li>
            <li>Improve functionality</li>
            <li>Respond to support requests</li>
          </ul>
          <p>We rely on the following legal bases under UK GDPR:</p>
          <ul>
            <li>Contractual necessity</li>
            <li>Legitimate interests</li>
            <li>Legal obligation</li>
          </ul>

          <h2>6. AI Processing</h2>
          <p>MyCoachDeveloper uses third party AI service providers, including OpenAI or similar providers, to generate coaching insights and outputs.</p>
          <p>When users input session data or methodology information:</p>
          <ul>
            <li>That data may be securely transmitted to our AI provider for processing</li>
            <li>We do not permit AI providers to use this data for public model training</li>
            <li>AI processing occurs under contractual safeguards</li>
          </ul>
          <p>Users should not input highly sensitive personal data unrelated to coaching activity.</p>

          <h2>7. Payment Processing</h2>
          <p>All payments are processed by Stripe. Stripe acts as an independent data controller for payment processing. We recommend reviewing Stripe's Privacy Policy for further details.</p>
          <p>We do not store full payment card information.</p>

          <h2>8. Data Storage & Security</h2>
          <p>Data is hosted via our platform infrastructure provider and stored securely using encrypted database systems.</p>
          <p>We implement:</p>
          <ul>
            <li>Encryption in transit</li>
            <li>Role based access controls</li>
            <li>Secure authentication</li>
            <li>Regular software updates</li>
          </ul>
          <p>Access to personal data is restricted to authorised users only.</p>

          <h2>9. International Transfers</h2>
          <p>Some third party providers may process data outside the United Kingdom. Where this occurs, we ensure appropriate safeguards are in place, such as:</p>
          <ul>
            <li>Standard contractual clauses</li>
            <li>Adequacy decisions</li>
          </ul>

          <h2>10. Data Retention</h2>
          <p>We retain personal data:</p>
          <ul>
            <li>For the duration of an active subscription</li>
            <li>For a reasonable period following cancellation for administrative and legal purposes</li>
          </ul>
          <p>Clubs may request deletion of their organisational data following account termination.</p>
          <p>We may retain limited information where required for legal or accounting purposes.</p>

          <h2>11. Your Rights</h2>
          <p>Under UK GDPR, you have the right to:</p>
          <ul>
            <li>Access your personal data</li>
            <li>Request correction</li>
            <li>Request deletion</li>
            <li>Restrict processing</li>
            <li>Object to processing</li>
            <li>Data portability</li>
            <li>Lodge a complaint with the ICO</li>
          </ul>
          <p>Requests can be made via <a href="mailto:hello@mycoachdeveloper.com">hello@mycoachdeveloper.com</a></p>

          <h2>12. Cookies</h2>
          <p>We use cookies and similar technologies to:</p>
          <ul>
            <li>Maintain login sessions</li>
            <li>Analyse usage</li>
            <li>Improve performance</li>
          </ul>
          <p>You can control cookies via your browser settings. A separate Cookie Policy may provide further detail.</p>

          <h2>13. Children's Data</h2>
          <p>The platform is intended for use by coaches and adult professionals.</p>
          <p>If a club enters data relating to players under 18, the club is responsible for ensuring lawful processing of that data.</p>
          <p>We do not knowingly collect personal data directly from children without appropriate consent.</p>

          <h2>14. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. The latest version will always be available on our website.</p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 bg-slate-100 border-t border-slate-200">
        <div className="max-w-4xl mx-auto text-center text-sm text-slate-500">
          <p>© {new Date().getFullYear()} My Coach Developer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
