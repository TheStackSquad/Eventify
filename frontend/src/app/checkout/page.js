// frontend/src/app/checkout/page.

"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useCart } from "@/context/cartContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import PaystackCheckout from "@/components/checkoutUI/checkout";
import CustomerForm from "@/components/checkoutUI/customerForm";
import OrderSummary from "@/components/checkoutUI/orderSummaryCard";
import SecureCheckoutPanel from "@/components/checkoutUI/secureCheckoutPanel";
import CheckoutSectionBoundary from "@/components/errorBoundary/checkoutSectionBoundary";

import {
  calculateCartTotals,
  formatOrderMetadata,
} from "./utils/calculateCartTotals";

const EMPTY_CUSTOMER = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  country: "Nigeria",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, itemCount } = useCart();

  const [customerInfo, setCustomerInfo] = useState(EMPTY_CUSTOMER);
  const [isFormValid, setIsFormValid] = useState(false);
  const [initialUserData, setInitialUserData] = useState(null);
  
    useEffect(() => {
      if (typeof window === "undefined") return;
      try {
        const raw = localStorage.getItem("userData");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            setInitialUserData(parsed);
          }
        }
      } catch (error) {
        console.warn("Failed to read userData from localStorage:", error);
      }
    }, []);
  
  const cartTotals = useMemo(() => {
    try {
    return calculateCartTotals(items);
  } catch (error) {
    console.error("Cart calculation error:", error);
    return {
      subtotal: 0,
      finalTotal: 0,
      finalTotalKobo: 0,
      hasMixedTiers: false,
      serviceCharge: 0,
      serviceFee: 0,
      vat: 0,
      itemsBreakdown: [],
      hasCalculationError: true,
      calculationError:
        `We couldn’t calculate your cart totals accurately. Please refresh or re-add your tickets.`,
    };
  }
}, [items]);

  const handleCustomerInfoChange = useCallback(
    (info) => setCustomerInfo(info),
    [],
  );
  const handleFormValidation = useCallback(
    (valid) => setIsFormValid(valid),
    [],
  );

  const paymentMetadata = useMemo(() => {
    try {
      return formatOrderMetadata(cartTotals, customerInfo, items);
    } catch (error) {
      console.error("Metadata formatting error:", error);
      return null;
    }
  }, [cartTotals, customerInfo, items]);

  if (itemCount === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
        <p className="mb-4 text-xl font-medium text-gray-700">
          Your cart is empty. Nothing to checkout.
        </p>
        <Link href="/events" className="text-blue-600 hover:underline">
          Go back to events
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 pb-28 md:p-8 md:pb-28 lg:pb-8">
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center font-medium text-gray-600 transition-colors hover:text-red-600"
      >
        <ArrowLeft size={20} className="mr-2" />
        Back to cart
      </button>

      <h1 className="mb-6 border-b pb-2 text-3xl font-extrabold text-gray-900">
        Secure checkout
      </h1>

      {cartTotals.hasCalculationError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"
        >
          {cartTotals.calculationError ||
            "There was a problem calculating your cart totals. Please review your cart."}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CheckoutSectionBoundary
            section="Customer Information"
            minHeight="400px"
          >
            <SecureCheckoutPanel
              customerInfo={customerInfo}
              isFormValid={isFormValid && !cartTotals.hasCalculationError}
            ></SecureCheckoutPanel>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <CustomerForm
                initialData={
                  initialUserData ? { user: initialUserData } : undefined
                }
                onCustomerInfoChange={handleCustomerInfoChange}
                onValidationChange={handleFormValidation}
              />
            </div>
          </CheckoutSectionBoundary>

          <CheckoutSectionBoundary section="Payment Gateway" minHeight="300px">
            <SecureCheckoutPanel
              customerInfo={customerInfo}
              isFormValid={isFormValid}
            >
              <PaystackCheckout
                amountInKobo={cartTotals.finalTotalKobo}
                email={customerInfo.email}
                totalAmount={cartTotals.finalTotal}
                metadata={paymentMetadata}
              />
            </SecureCheckoutPanel>
          </CheckoutSectionBoundary>
        </div>

        <div className="lg:col-span-1">
          <CheckoutSectionBoundary section="Order Summary" minHeight="400px">
            <OrderSummary
              customerInfo={customerInfo}
              itemCount={itemCount}
              orderBreakdown={cartTotals}
              items={items}
            />
          </CheckoutSectionBoundary>
        </div>
      </div>
    </div>
  );
}