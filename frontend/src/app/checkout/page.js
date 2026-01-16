// frontend/src/app/checkout/page.js
"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useCart } from "@/context/cartContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User } from "lucide-react";

// Components
import PaystackCheckout from "@/components/checkoutUI/checkout";
import CustomerForm from "@/components/checkoutUI/customerForm";
import OrderSummary from "./components/OrderSummary";

// Utils
import {
  calculateCartTotals,
  formatOrderMetadata,
} from "./utils/calculateCartTotals";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, itemCount } = useCart();

  const [customerInfo, setCustomerInfo] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    country: "Nigeria",
  });
  const [isFormValid, setIsFormValid] = useState(false);
  const [userData, setUserData] = useState(null);

  // Get user data from localStorage once on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("userData");
    if (!storedUser) return;

    try {
      const user = JSON.parse(storedUser);
      console.log("🟢 CheckoutPage: User Data loaded:", user);
      setUserData(user);
    } catch (error) {
      console.error("Error parsing user data:", error);
    }
  }, []);

  // Calculate cart totals using new fee structure
  const cartTotals = useMemo(() => {
    console.log("🟢 CheckoutPage: Calculating cart totals for items:", items);
    const totals = calculateCartTotals(items);
    console.log("🟢 CheckoutPage: Cart Totals:", totals);
    return totals;
  }, [items]);

  // Stable callback for customer info updates
  const handleCustomerInfoChange = useCallback((info) => {
    console.log("🟢 CheckoutPage: Received customer info from form:", info);
    setCustomerInfo(info);
  }, []);

  // Stable callback for validation status
  const handleFormValidation = useCallback((isValid) => {
    console.log("🟢 CheckoutPage: Form validation status:", isValid);
    setIsFormValid(isValid);
  }, []);

  // Memoize payment metadata
  const paymentMetadata = useMemo(() => {
    const metadata = formatOrderMetadata(cartTotals, customerInfo, items);
    console.log("🟢 CheckoutPage: Payment metadata created:", metadata);
    return metadata;
  }, [cartTotals, customerInfo, items]);

  // Log when customerInfo changes to debug the flow
  useEffect(() => {
    console.log("🟢 CheckoutPage: Customer info state updated:", customerInfo);
  }, [customerInfo]);

  // Redirect if cart is empty
  if (itemCount === 0) {
    return (
      <div className="p-8 text-center min-h-[60vh] flex flex-col justify-center items-center">
        <p className="text-xl font-medium text-gray-700 mb-4">
          Your cart is empty. Nothing to checkout.
        </p>
        <Link href="/events" className="text-blue-600 hover:underline">
          Go back to events
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center text-gray-600 hover:text-red-600 transition-colors font-medium"
      >
        <ArrowLeft size={20} className="mr-2" />
        Back to Cart
      </button>

      <h1 className="text-3xl font-extrabold text-gray-900 mb-6 border-b pb-2">
        Secure Checkout
      </h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column - Customer Info & Payment */}
        <div className="lg:col-span-2 space-y-8">
          {/* Customer Information Section */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <CustomerForm
              onCustomerInfoChange={handleCustomerInfoChange}
              onValidationChange={handleFormValidation}
              initialData={{ user: userData }}
            />
          </div>

          {/* Payment Section */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-red-700 mb-6">
              Payment Method
            </h2>

            {/* Debug Info - Remove in production */}
            {process.env.NODE_ENV === "development" && (
              <div className="mb-4 p-3 bg-gray-100 rounded text-xs font-mono">
                <div>
                  <strong>Debug Info:</strong>
                </div>
                <div>Form Valid: {isFormValid.toString()}</div>
                <div>Email: {customerInfo.email || "empty"}</div>
                <div>FirstName: {customerInfo.firstName || "empty"}</div>
                <div>LastName: {customerInfo.lastName || "empty"}</div>
                <div>Phone: {customerInfo.phone || "empty"}</div>
                <div>
                  Final Total: ₦{cartTotals.finalTotal.toLocaleString()}
                </div>
                <div>Amount in Kobo: {cartTotals.finalTotalKobo}</div>
                <div>
                  Has Mixed Tiers: {cartTotals.hasMixedTiers.toString()}
                </div>
                <div>Metadata exists: {paymentMetadata ? "YES" : "NO"}</div>
              </div>
            )}

            {isFormValid && customerInfo.email ? (
              <>
                {/* Fee Structure Notice */}
                {cartTotals.hasMixedTiers && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    <p className="font-medium mb-1">
                      ℹ️ Mixed Fee Structure Applied
                    </p>
                    <p className="text-xs">
                      Your cart contains tickets with different fee structures:
                      Small tickets (≤₦5,000) have a 10% fee, premium tickets
                      (&gt;₦5,000) have 7% + ₦50 + VAT.
                    </p>
                  </div>
                )}

                <PaystackCheckout
                  amountInKobo={cartTotals.finalTotalKobo}
                  email={customerInfo.email}
                  totalAmount={cartTotals.finalTotal}
                  metadata={paymentMetadata}
                />
              </>
            ) : (
              <div className="text-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <User className="mx-auto mb-4 text-gray-400" size={48} />
                <h3 className="text-lg font-medium text-gray-700 mb-2">
                  Complete Customer Information
                </h3>
                <p className="text-gray-500">
                  Please fill in all required customer details above to proceed
                  with payment.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Order Summary */}
        <div className="lg:col-span-1">
          <OrderSummary
            customerInfo={customerInfo}
            itemCount={itemCount}
            orderBreakdown={cartTotals}
            items={items}
          />
        </div>
      </div>
    </div>
  );
}
