import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Terms of Service</h1>
          <p className="text-slate-500 mt-2">Last updated: 17 February 2026</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 prose prose-slate max-w-none">
          <p className="lead text-lg text-slate-600">
            These Terms and Conditions govern your use of the MyCoachDeveloper platform and services.
            By creating an account or subscribing, you agree to these Terms.
          </p>

          <h2>1. About Us</h2>
          <p>MyCoachDeveloper is operated by Joe Morrissey, a UK based sole trader.</p>
          <p>Contact email: <a href="mailto:hello@mycoachdeveloper.com">hello@mycoachdeveloper.com</a></p>

          <h2>2. Definitions</h2>
          <ul>
            <li><strong>"Platform"</strong> means the MyCoachDeveloper website and related services.</li>
            <li><strong>"User"</strong> means any individual accessing the Platform.</li>
            <li><strong>"Individual Subscription"</strong> means a subscription purchased by a single user.</li>
            <li><strong>"Club Subscription"</strong> means a subscription purchased by an organisation for use by multiple authorised users.</li>
            <li><strong>"Organisation"</strong> means a club or entity purchasing a Club Subscription.</li>
          </ul>

          <h2>3. Eligibility</h2>
          <p>The Platform is intended for use by coaches and adult professionals.</p>
          <p>By using the Platform, you confirm that you are at least 18 years old.</p>
          <p>If an Organisation registers, it confirms it has authority to bind that Organisation to these Terms.</p>

          <h2>4. Account Registration</h2>
          <p>Users must provide accurate information when creating an account.</p>
          <p>You are responsible for maintaining the confidentiality of your login credentials.</p>
          <p>We may suspend or terminate accounts where information is inaccurate or used improperly.</p>

          <h2>5. Subscriptions and Payment</h2>
          <ul>
            <li>Subscriptions are available on a monthly or annual basis.</li>
            <li>All payments are processed securely by Stripe.</li>
            <li>We do not store full payment card details.</li>
            <li>Subscriptions renew automatically unless cancelled.</li>
            <li>Prices may be updated with reasonable notice.</li>
          </ul>

          <h2>6. Cancellation</h2>
          <ul>
            <li>To cancel a subscription, users must email <a href="mailto:hello@mycoachdeveloper.com">hello@mycoachdeveloper.com</a> before their renewal date.</li>
            <li>Cancellation takes effect at the end of the current billing period.</li>
            <li>No partial refunds are provided for unused portions of a billing cycle.</li>
            <li>Annual subscriptions are non-refundable once active, except where required by applicable consumer law.</li>
            <li>Where immediate access to the Platform is requested, users acknowledge that statutory cooling off rights may be waived.</li>
          </ul>

          <h2>7. Failed Payments</h2>
          <p>If payment cannot be processed, we may suspend access to the Platform.</p>
          <p>If payment remains outstanding, we reserve the right to terminate the subscription.</p>

          <h2>8. Club Subscriptions and Data Ownership</h2>
          <p><strong>For Club Subscriptions:</strong></p>
          <ul>
            <li>The Organisation owns the coaching and development data created within its account.</li>
            <li>The Organisation controls user access and permissions.</li>
            <li>Adding or removing users does not affect subscription pricing unless otherwise agreed.</li>
          </ul>
          <p><strong>For Individual Subscriptions:</strong></p>
          <ul>
            <li>The individual user owns their data.</li>
          </ul>

          <h2>9. Data Retention After Cancellation</h2>
          <p>Following cancellation:</p>
          <ul>
            <li>Access continues until the end of the billing period.</li>
            <li>Accounts are then deactivated.</li>
            <li>Data may be permanently deleted after a retention period.</li>
          </ul>
          <p>Organisations may request data export prior to deletion.</p>

          <h2>10. Acceptable Use</h2>
          <p>Users agree not to:</p>
          <ul>
            <li>Use the Platform for unlawful purposes</li>
            <li>Upload malicious code</li>
            <li>Attempt unauthorised access</li>
            <li>Share login credentials</li>
            <li>Misuse AI outputs</li>
          </ul>
          <p>We reserve the right to suspend accounts for misuse.</p>

          <h2>11. AI Generated Content</h2>
          <p>The Platform uses third party AI providers to generate insights and outputs.</p>
          <p>AI outputs are generated automatically and should be reviewed by users before implementation.</p>
          <p>We do not guarantee that AI generated content is error free, complete or suitable for specific circumstances.</p>
          <p>Users remain responsible for professional decisions made using the Platform.</p>

          <h2>12. Intellectual Property</h2>
          <p>All intellectual property rights in the Platform remain the property of MyCoachDeveloper.</p>
          <p>Users retain ownership of content they create.</p>
          <p>Users grant us a licence to process and display their content for the purpose of operating the Platform.</p>

          <h2>13. Limitation of Liability</h2>
          <p>To the fullest extent permitted by law, we are not liable for:</p>
          <ul>
            <li>Indirect or consequential loss</li>
            <li>Loss of profits</li>
            <li>Loss of business opportunity</li>
            <li>Decisions made based on AI outputs</li>
          </ul>
          <p>Our total liability shall not exceed the amount paid by the user in the preceding 12 months.</p>
          <p>Nothing in these Terms limits liability for death or personal injury caused by negligence or for fraud.</p>

          <h2>14. Termination</h2>
          <p>We may suspend or terminate access if:</p>
          <ul>
            <li>These Terms are breached</li>
            <li>Payments are not made</li>
            <li>The Platform is misused</li>
          </ul>

          <h2>15. Changes to the Platform</h2>
          <p>We may update, modify or improve the Platform at any time.</p>
          <p>We do not guarantee uninterrupted availability.</p>

          <h2>16. Privacy</h2>
          <p>Use of the Platform is also governed by our <Link to="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</Link>.</p>

          <h2>17. Governing Law</h2>
          <p>These Terms are governed by the laws of England and Wales.</p>
          <p>Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
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
