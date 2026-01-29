// frontend/src/components/create-events/formSteps/paymentStep.js

import Image from "next/image";
import { createInputField } from "@/components/common/createInputFields";
import PolicyModal from "../components/policyModal";
import { AlertCircle, Lock, ShieldCheck } from "lucide-react";

export default function PaymentStep({
  formData,
  errors,
  handleInputChange,
  lockStatus,
}) {
  const hasPaidTickets = formData.tickets?.some(
    (t) => !t.isFree && t.price > 0,
  );

  // Get lock status from props (passed from useEventForm)
  const totalSalesCount = lockStatus?.totalSold || 0;
  const isSubaccountLocked = lockStatus?.paystackSubaccount || false;

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-white mb-4">Payment Setup</h3>

      <PolicyModal />

      {/* 1. Policy Info Box */}
      <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="bg-emerald-500/20 p-2 rounded-lg flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-emerald-300 font-semibold mb-1">
              Secure Payout Policy
            </h4>
            <p className="text-emerald-100/80 text-sm leading-relaxed">
              Paystack acts as the holding agent for security. Funds are settled
              <strong> after the event ends successfully.</strong>
            </p>
          </div>
        </div>
      </div>

      {/* 2. Paystack Subaccount Section */}
      <div
        className={`bg-gray-800/50 rounded-lg p-6 border transition-all duration-300 ${
          isSubaccountLocked
            ? "border-amber-600/40 shadow-inner"
            : "border-gray-700 hover:border-gray-600"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          {/* Header with Lock Badge */}
          <div className="flex items-center gap-2">
            <h4 className="text-white font-semibold">Paystack Subaccount</h4>
            {isSubaccountLocked && (
              <span className="flex items-center gap-1 bg-amber-900/30 text-amber-500 text-[10px] px-2 py-0.5 rounded border border-amber-800/50 uppercase font-bold animate-in fade-in zoom-in duration-300">
                <Lock className="w-3 h-3" /> Locked
              </span>
            )}
          </div>

          {/* Paystack Logo - Lighthouse Optimized */}
          <div className="relative h-6 w-24">
            <Image
              src="/img/paystack/paystack.png"
              alt="Secured by Paystack"
              fill
              sizes="(max-width: 768px) 80px, 96px"
              className={`object-contain object-right transition-all ${
                isSubaccountLocked ? "grayscale opacity-40" : "opacity-80"
              }`}
              priority
              quality={85}
            />
          </div>
        </div>

        {/* Subaccount Input */}
        {createInputField({
          label: "Subaccount Code",
          type: "text",
          name: "paystackSubaccountCode",
          value: formData.paystackSubaccountCode || "",
          onChange: (e) =>
            handleInputChange("paystackSubaccountCode", e.target.value),
          placeholder: "ACCT_xxxxxxxxxx",
          error: errors.paystackSubaccountCode,
          required: hasPaidTickets,
          disabled: isSubaccountLocked,
          className: isSubaccountLocked
            ? "opacity-60 cursor-not-allowed bg-gray-950"
            : "",
        })}

        {/* Lock Warning Alert */}
        {isSubaccountLocked && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-md bg-amber-500/5 border border-amber-500/10 animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-200/70 leading-normal">
              Payout destination is frozen because{" "}
              <strong className="text-amber-300">{totalSalesCount}</strong>{" "}
              ticket{totalSalesCount === 1 ? "" : "s"}{" "}
              {totalSalesCount === 1 ? "has" : "have"} already been sold. Please
              contact support for emergency banking updates.
            </p>
          </div>
        )}

        {/* Helper Text (when not locked) */}
        {!isSubaccountLocked && (
          <p className="mt-2 text-xs text-gray-400">
            Required for payouts. Don&apos;t have one?{" "}
            <a
              href="https://paystack.com/subaccounts"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline hover:text-blue-300 transition-colors"
            >
              Create a subaccount
            </a>
          </p>
        )}
      </div>

      {/* 3. Service Fee Information */}
      <div className="bg-gray-800/30 rounded-lg p-5 border border-gray-700">
        <div className="flex items-start gap-3">
          <div className="bg-blue-500/20 p-2 rounded-lg flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h4 className="text-white font-medium mb-2">Service Fees</h4>
            <div className="text-sm text-gray-400 space-y-1">
              <p>
                • <strong className="text-gray-300">Paystack:</strong> 1.5% +
                ₦100 per transaction
              </p>
              <p>
                • <strong className="text-gray-300">Platform:</strong> 2.5% of
                ticket price
              </p>
              <p className="text-xs text-gray-500 mt-2">
                These fees are automatically deducted before payouts
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Maximum Event Capacity (Optional) */}
      <div className="bg-gray-800/30 rounded-lg p-5 border border-gray-700">
        <h4 className="text-white font-medium mb-3">Event Capacity</h4>

        {createInputField({
          label: "Maximum Attendees (Optional)",
          type: "number",
          name: "maxAttendees",
          value: formData.maxAttendees || "",
          onChange: (e) => handleInputChange("maxAttendees", e.target.value),
          placeholder: "Leave blank for unlimited",
          min: totalSalesCount || 1,
          className: isSubaccountLocked ? "border-amber-900/20" : "",
        })}

        <p className="text-xs text-gray-500 mt-2">
          Total number of people allowed to attend this event. Must be at least{" "}
          {totalSalesCount || "1"}.
        </p>

        {/* Show warning if capacity is set below total ticket capacity */}
        {formData.maxAttendees &&
          formData.tickets &&
          (() => {
            const totalTicketCapacity = formData.tickets.reduce(
              (sum, t) => sum + (t.quantity || 0),
              0,
            );
            return formData.maxAttendees < totalTicketCapacity ? (
              <div className="mt-2 flex items-start gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-yellow-300">
                  Warning: Max capacity ({formData.maxAttendees}) is less than
                  total ticket capacity ({totalTicketCapacity})
                </p>
              </div>
            ) : null;
          })()}
      </div>

      {/* 5. Important Notes */}
      <div className="bg-gray-800/20 rounded-lg p-4 border border-gray-700/50">
        <h5 className="text-sm font-semibold text-gray-300 mb-2">
          Important Notes
        </h5>
        <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
          <li>Ensure your Paystack subaccount is active and verified</li>
          <li>Settlement occurs 3-5 business days after your event ends</li>
          <li>
            Keep your banking information up to date in your Paystack dashboard
          </li>
          {isSubaccountLocked && (
            <li className="text-amber-400">
              Once tickets are sold, payment details cannot be changed
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
