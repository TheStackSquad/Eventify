// frontend/src/components/create-events/components/policyModal.js
import { useState } from "react";

export default function PolicyModal() {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group relative flex items-center gap-2 px-4 py-2 bg-blue-600/10 border border-blue-500/30 rounded-full hover:bg-blue-600/20 transition-all duration-300"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
        </span>
        <span className="text-sm font-medium text-blue-300 group-hover:text-blue-200">
          How Payouts & Taxes Work
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
          <h3 className="text-xl font-bold text-white">
            Financial Transparency & Terms
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-white">
                The Escrow (Payout) System
              </h4>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              To protect both creators and attendees, our platform operates on
              an <strong>Escrow-style settlement</strong>. Paystack acts as the
              neutral holding agent. Funds collected from ticket sales are held
              securely and are only released to your subaccount after the event
              has taken place. This ensures that refunds can be processed
              seamlessly if an event is cancelled or significantly altered.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-white">
                Tax & Government Obligations
              </h4>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              As a registered entity, we act as a{" "}
              <strong>Collecting Agent for Value Added Tax (VAT)</strong>. Under
              current financial regulations, a 7.5% VAT is applied strictly to
              the <em>service fees</em> charged by the platform, not the total
              ticket price. These funds are remitted to the relevant tax
              authorities to ensure your event remains compliant with national
              financial laws.
            </p>
          </section>

          <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">
              Creator Responsibility
            </h5>
            <p className="text-xs text-gray-400 italic">
              While we handle VAT on our service fees, creators are responsible
              for their own personal or corporate income tax filings related to
              their event earnings.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 bg-gray-800/30 text-center">
          <button
            onClick={() => setIsOpen(false)}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
          >
            I Understand the Terms
          </button>
        </div>
      </div>
    </div>
  );
}
