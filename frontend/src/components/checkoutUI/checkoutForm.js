//frontend/src/components/checkoutUI/checkoutForm.js

"use client";

import { memo } from "react";
import CustomerForm from "@/components/checkoutUI/customerForm";
import PaystackCheckout from "@/components/checkoutUI/checkout";
import { User, CreditCard } from "lucide-react";
import { formatCurrency } from "@/utils/currency";

// Memoized checkout form component
const CheckoutForm = memo(
  ({
    customerInfo,
    isFormValid,
    userData,
    paymentMetadata,
    amountInKobo,
    finalTotal,
    onCustomerInfoChange,
    onValidationChange,
  }) => {
    return (
      <>
        {/* Customer Information Section */}
        <section
          className="bg-white p-4 sm:p-6 md:p-8 rounded-xl shadow-lg border border-gray-200"
          aria-labelledby="customer-info-heading"
        >
          <div className="flex items-center mb-4 md:mb-6">
            <User className="mr-2 text-blue-600" size={24} aria-hidden="true" />
            <h2
              id="customer-info-heading"
              className="text-xl sm:text-2xl font-bold text-gray-800"
            >
              Customer Information
            </h2>
          </div>

          <CustomerForm
            onCustomerInfoChange={onCustomerInfoChange}
            onValidationChange={onValidationChange}
            initialData={{ user: userData }}
          />
        </section>

        {/* Payment Section */}
        <section
          className="bg-white p-4 sm:p-6 md:p-8 rounded-xl shadow-lg border border-gray-200"
          aria-labelledby="payment-heading"
        >
          <div className="flex items-center mb-4 md:mb-6">
            <CreditCard
              className="mr-2 text-red-600"
              size={24}
              aria-hidden="true"
            />
            <h2
              id="payment-heading"
              className="text-xl sm:text-2xl font-bold text-red-700"
            >
              Payment Method
            </h2>
          </div>

          {isFormValid && customerInfo.email ? (
            <div className="space-y-4">
              {/* Payment info banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4">
                <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
                  <strong className="font-semibold">Secure Payment:</strong>{" "}
                  Your payment is processed securely through Paystack. We never
                  store your card details.
                </p>
              </div>

              {/* Paystack checkout component */}
              <PaystackCheckout
                amountInKobo={amountInKobo}
                email={customerInfo.email}
                totalAmount={finalTotal}
                formatCurrency={formatCurrency}
                metadata={paymentMetadata}
              />
            </div>
          ) : (
            // Placeholder when form is incomplete
            <div className="text-center p-6 sm:p-8 md:p-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-dashed border-gray-300">
              <User
                className="mx-auto mb-3 md:mb-4 text-gray-400"
                size={48}
                aria-hidden="true"
              />
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">
                Complete Your Information
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 max-w-sm mx-auto leading-relaxed">
                Please fill in all required customer details above to proceed
                with secure payment.
              </p>

              {/* Progress indicator */}
              <div className="mt-4 flex justify-center items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    customerInfo.firstName ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
                <div
                  className={`w-2 h-2 rounded-full ${
                    customerInfo.email ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
                <div
                  className={`w-2 h-2 rounded-full ${
                    customerInfo.phone ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
                <div
                  className={`w-2 h-2 rounded-full ${
                    isFormValid ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {isFormValid ? "Ready to proceed!" : "Fill all required fields"}
              </p>
            </div>
          )}
        </section>
      </>
    );
  }
);

CheckoutForm.displayName = "CheckoutForm";

export default CheckoutForm;
