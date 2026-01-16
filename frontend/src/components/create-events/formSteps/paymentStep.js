// frontend/src/components/create-events/formSteps/paymentStep.js
import { createInputField } from "@/components/common/createInputFields";
import PolicyModal from "../components/policyModal";
import { TIER_THRESHOLD } from "@/utils/currency";
import Image from "next/image";

export default function PaymentStep({ formData, errors, handleInputChange }) {
  // Check if there are any paid tickets to determine if payment info is relevant
  const hasPaidTickets = formData.tickets.some((t) => !t.isFree && t.price > 0);

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-white mb-4">Payment Setup</h3>
      <PolicyModal />
      {/* SECURITY & PAYOUT INFO BOX */}
      <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="bg-emerald-500/20 p-2 rounded-lg">
            <svg
              className="w-5 h-5 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <div>
            <h4 className="text-emerald-300 font-semibold mb-1">
              Secure Payout Policy
            </h4>
            <p className="text-emerald-100/80 text-sm leading-relaxed">
              To ensure attendee security, Paystack acts as the holding agent
              for all ticket sales.
              <strong>
                {" "}
                Funds are automatically processed and settled into your account
                after the event has successfully ended.
              </strong>
            </p>
          </div>
        </div>
      </div>

      {/* PAYSTACK INTEGRATION */}
      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white font-semibold">Paystack Subaccount</h4>
          <Image
            src="https://paystack.com/assets/img/login/paystack-logo.png"
            alt="Paystack"
            className="h-4 opacity-70"
          />
        </div>

        {createInputField({
          label: "Subaccount Code",
          type: "text",
          name: "paystackSubaccountCode",
          value: formData.paystackSubaccountCode,
          onChange: (e) =>
            handleInputChange("paystackSubaccountCode", e.target.value),
          placeholder: "ACCT_xxxxxxxxxx",
          error: errors.paystackSubaccountCode,
          required: hasPaidTickets,
        })}

        <p className="mt-2 text-xs text-gray-400">
          Required to receive payouts. Don&apos;t have one?{" "}
          <a
            href="https://paystack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline hover:text-blue-300"
          >
            Create a subaccount here
          </a>
        </p>
      </div>

      {/* DYNAMIC REVENUE BREAKDOWN */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h4 className="text-white font-semibold mb-4">
          Service Fee Transparency
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Small Ticket Tier */}
          <div className="p-3 bg-gray-900/50 rounded-md border border-gray-700">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              Standard
            </span>
            <p className="text-white font-medium">
              Tickets ≤ ₦{TIER_THRESHOLD.toLocaleString()}
            </p>
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-gray-400">Service Fee</span>
              <span className="text-white">
                10% <small className="text-gray-500">(VAT Incl.)</small>
              </span>
            </div>
          </div>

          {/* Premium Ticket Tier */}
          <div className="p-3 bg-gray-900/50 rounded-md border border-gray-700">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
              Premium
            </span>
            <p className="text-white font-medium">
              Tickets &gt; ₦{TIER_THRESHOLD.toLocaleString()}
            </p>
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-gray-400">Service Fee</span>
              <span className="text-white">
                7% + ₦50 <small className="text-gray-500">+ VAT</small>
              </span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-gray-500 leading-tight">
          * Service fees are applied to the ticket price paid by the attendee.
          The Paystack processing fee (1.5% + ₦100) is deducted from the total
          transaction.
        </p>
      </div>

      {createInputField({
        label: "Maximum Event Capacity (Optional)",
        type: "number",
        name: "maxAttendees",
        value: formData.maxAttendees,
        onChange: (e) => handleInputChange("maxAttendees", e.target.value),
        placeholder: "Total number of attendees allowed",
      })}
    </div>
  );
}
