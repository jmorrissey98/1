import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function CommercialTerms() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Commercial Terms Summary</h1>
          <p className="text-slate-500 mt-2">MyCoachDeveloper</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 prose prose-slate max-w-none">
          
          <p className="lead text-lg text-slate-600">
            MyCoachDeveloper is built to support long term coaching alignment and development.
            We work with individual coaches and clubs, and we aim to keep our commercial terms
            simple, fair and transparent.
          </p>
          <p className="text-slate-600">
            Below is a clear summary of how subscriptions, payments and cancellations work.
          </p>

          <h2>Subscriptions</h2>
          <p>You can subscribe as:</p>
          <ul>
            <li>An individual coach</li>
            <li>A club or organisation</li>
          </ul>
          <p>Subscriptions are available on a monthly or annual basis.</p>
          <p>Club subscriptions allow an administrator to add and manage coaches and staff within their organisation account.</p>

          <h2>Monthly Plans</h2>
          <p>Monthly subscriptions renew automatically each month.</p>
          <p>You may cancel at any time by emailing us before your next renewal date.</p>
          <p>If you cancel, you will retain full access until the end of your current billing period.</p>
          <p>We do not provide partial refunds for unused time within a billing cycle.</p>

          <h2>Annual Plans</h2>
          <p>Annual subscriptions are billed upfront at a discounted rate and provide uninterrupted access for 12 months.</p>
          <p>Because access to the platform begins immediately upon subscription, annual plans are non-refundable once active, except where required by applicable consumer law.</p>
          <p>If you are unsure whether an annual plan is right for you, we recommend starting on a monthly plan first.</p>

          <h2>Club Accounts</h2>
          <p>Club subscriptions are organisation based.</p>
          <p>Once subscribed, a club administrator can add or remove coaches and staff at any time.</p>
          <p>Removing a coach does not reduce the subscription fee or trigger a refund.</p>
          <p>For club accounts, the organisation owns the data created within that account.</p>

          <h2>Payments</h2>
          <p>All payments are processed securely by Stripe.</p>
          <p>We do not store full payment card details.</p>
          <p>If a payment cannot be processed, access to the platform may be temporarily suspended until the issue is resolved.</p>

          <h2>Cancelling Your Subscription</h2>
          <p>To cancel your subscription, please email <a href="mailto:hello@mycoachdeveloper.com">hello@mycoachdeveloper.com</a>.</p>
          <p>Cancellation requests must be received before your renewal date to prevent the next billing charge.</p>
          <p>Once cancelled, you will retain access until the end of your current paid period.</p>
          <p>We aim to process cancellation requests promptly and fairly.</p>

          <h2>Data After Cancellation</h2>
          <p>After a subscription ends:</p>
          <ul>
            <li>Access remains until the end of the paid period</li>
            <li>Accounts are then deactivated</li>
            <li>Data is retained for a limited period before permanent deletion</li>
          </ul>
          <p>Clubs may request data export prior to deletion.</p>

          <h2>Our Approach</h2>
          <p>MyCoachDeveloper is built around long term partnerships, not short term lock ins.</p>
          <p>If something unexpected happens, we encourage open communication. Our goal is to operate in a way that reflects the standards we promote within coaching environments: clarity, fairness and accountability.</p>
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
