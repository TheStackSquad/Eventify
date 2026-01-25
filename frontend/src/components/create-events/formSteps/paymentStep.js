// frontend/src/components/create-events/formSteps/paymentStep.
import Image from "next/image";
import { createInputField } from "@/components/common/createInputFields";
import PolicyModal from "../components/policyModal";
//import { TIER_THRESHOLD } from "@/utils/currency";
import { AlertCircle, Lock } from "lucide-react"; // Consistent iconography

export default function PaymentStep({ formData, errors, handleInputChange }) {
  const hasPaidTickets = formData.tickets.some((t) => !t.isFree && t.price > 0);

  // Single source of truth for the lock
  const totalSalesCount = formData.tickets.reduce(
    (acc, t) => acc + (t.soldCount || 0),
    0,
  );
  const isLocked = totalSalesCount > 0;

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-white mb-4">Payment Setup</h3>
      <PolicyModal />

      {/* 1. Policy Info Box */}
      <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="bg-emerald-500/20 p-2 rounded-lg flex-shrink-0">
            <Lock className="w-5 h-5 text-emerald-400" />
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

      {/* 2. Paystack Section */}
      <div
        className={`bg-gray-800/50 rounded-lg p-6 border transition-all duration-300 ${
          isLocked ? "border-amber-600/40 shadow-inner" : "border-gray-700"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h4 className="text-white font-semibold">Paystack Subaccount</h4>
            {isLocked && (
              <span className="flex items-center gap-1 bg-amber-900/30 text-amber-500 text-[10px] px-2 py-0.5 rounded border border-amber-800/50 uppercase font-bold animate-in fade-in zoom-in">
                <Lock className="w-3 h-3" /> Locked
              </span>
            )}
          </div>

          {/* Lighthouse Optimized Logo */}
          <div className="relative h-6 w-24">
            <Image
              src="/img/paystack/paystack-logo.png"
              alt="Secured by Paystack"
              fill
              sizes="(max-width: 768px) 80px, 96px"
              className={`object-contain object-right transition-all ${isLocked ? "grayscale opacity-40" : "opacity-80"}`}
              priority
              quality={90}
            />
          </div>
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
          disabled: isLocked,
          className: isLocked
            ? "opacity-60 cursor-not-allowed bg-gray-950"
            : "",
        })}

        {/* Real-time Inline Alert */}
        {isLocked && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-md bg-amber-500/5 border border-amber-500/10">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-200/70 leading-normal italic">
              Payout destination is frozen because{" "}
              <strong>{totalSalesCount}</strong> ticket(s) have already been
              sold. Please contact support for emergency banking updates.
            </p>
          </div>
        )}

        {!isLocked && (
          <p className="mt-2 text-xs text-gray-400">
            Required for payouts. Don&apos;t have one?{" "}
            <a
              href="https://paystack.com"
              target="_blank"
              className="text-blue-400 underline hover:text-blue-300"
            >
              Create a subaccount
            </a>
          </p>
        )}
      </div>

      {/* 3. Fees and Capacity (Remaining the same but with totalSalesCount min check) */}
      {/* ... (Service Fee section) ... */}

      {createInputField({
        label: "Maximum Event Capacity (Optional)",
        type: "number",
        name: "maxAttendees",
        value: formData.maxAttendees,
        onChange: (e) => handleInputChange("maxAttendees", e.target.value),
        placeholder: "Total number of attendees allowed",
        min: totalSalesCount,
        className: isLocked ? "border-amber-900/20" : "",
      })}
    </div>
  );
}