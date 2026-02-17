import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function DataProcessing() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Data Processing Summary</h1>
          <p className="text-slate-500 mt-2">Last updated: 17 February 2026</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 prose prose-slate max-w-none">
          
          <p className="lead text-lg text-slate-600">
            This document provides a summary of how MyCoachDeveloper processes and protects
            personal data on behalf of clubs and individual users.
          </p>
          <p className="text-slate-600">It is designed to support transparency and due diligence.</p>

          <h2>1. Roles and Responsibilities</h2>
          <p>MyCoachDeveloper is operated by Joe Morrissey, UK based sole trader.</p>
          <p>For the purposes of UK data protection law:</p>
          <ul>
            <li>For individual subscriptions, MyCoachDeveloper acts as <strong>Data Controller</strong>.</li>
            <li>For club subscriptions, MyCoachDeveloper acts as <strong>Data Processor</strong> in respect of coaching and development data entered by the organisation.</li>
          </ul>
          <p>The subscribing club or organisation acts as Data Controller for the data created within its organisational account.</p>

          <h2>2. Categories of Data Processed</h2>
          <p>Depending on usage, the platform may process:</p>
          
          <h3>Account Data</h3>
          <ul>
            <li>Names</li>
            <li>Email addresses</li>
            <li>Roles within club</li>
          </ul>

          <h3>Coaching and Development Data</h3>
          <ul>
            <li>Session plans</li>
            <li>Observations</li>
            <li>Reflections</li>
            <li>Performance tracking information</li>
            <li>AI generated outputs</li>
          </ul>

          <h3>Technical Data</h3>
          <ul>
            <li>IP addresses</li>
            <li>Device and browser information</li>
            <li>Usage logs</li>
          </ul>

          <h3>Payment Data</h3>
          <ul>
            <li>Processed directly by Stripe</li>
            <li>MyCoachDeveloper does not store full card details</li>
          </ul>

          <p>The platform is not intended for the storage of special category data under UK GDPR.</p>

          <h2>3. Purpose of Processing</h2>
          <p>Data is processed solely to:</p>
          <ul>
            <li>Provide and operate the MyCoachDeveloper platform</li>
            <li>Enable coach development tracking</li>
            <li>Generate AI assisted insights</li>
            <li>Manage subscriptions</li>
            <li>Maintain system security</li>
          </ul>
          <p><strong>Data is not sold or shared for marketing purposes.</strong></p>

          <h2>4. Subprocessors</h2>
          <p>MyCoachDeveloper uses carefully selected third party providers to support service delivery. These may include:</p>
          <ul>
            <li>Stripe for payment processing</li>
            <li>AI service providers such as OpenAI for AI functionality</li>
            <li>Hosting and infrastructure providers via the Emergent platform</li>
            <li>Database services such as MongoDB</li>
          </ul>
          <p>All subprocessors are engaged under contractual safeguards.</p>
          <p>A list of subprocessors can be provided upon request.</p>

          <h2>5. International Transfers</h2>
          <p>Where third party providers process data outside the United Kingdom, appropriate safeguards are in place, such as:</p>
          <ul>
            <li>Standard contractual clauses</li>
            <li>Adequacy regulations</li>
          </ul>

          <h2>6. Security Measures</h2>
          <p>MyCoachDeveloper implements appropriate technical and organisational measures, including:</p>
          <ul>
            <li>Encrypted data transmission</li>
            <li>Role based access controls</li>
            <li>Secure authentication</li>
            <li>Restricted administrative access</li>
          </ul>
          <p>Access to organisational data is limited to authorised users within that organisation.</p>

          <h2>7. Data Retention</h2>
          <p>For club subscriptions:</p>
          <ul>
            <li>Data is retained for the duration of the subscription</li>
            <li>Following termination, data may be retained for a limited period before permanent deletion</li>
          </ul>
          <p>Clubs may request data export prior to deletion.</p>

          <h2>8. Data Subject Rights</h2>
          <p>Clubs, as Data Controllers, are responsible for responding to data subject rights requests relating to their organisational data.</p>
          <p>MyCoachDeveloper will reasonably assist in fulfilling such requests where technically feasible.</p>
          <p>Individual subscribers may contact us directly to exercise their data rights.</p>

          <h2>9. Incident Management</h2>
          <p>In the event of a confirmed personal data breach affecting organisational data, MyCoachDeveloper will notify the relevant organisation without undue delay and provide reasonable cooperation.</p>

          <h2>10. Contact</h2>
          <p>For further information regarding data protection:</p>
          <p><a href="mailto:hello@mycoachdeveloper.com">hello@mycoachdeveloper.com</a></p>
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
