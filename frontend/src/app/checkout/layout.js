//frontend/src/app/checkout/layout.js
export default function CheckoutLayout({ children }) {
  return (
    <>
      {/* Preload Paystack for better LCP */}
      <link
        rel="preconnect"
        href="https://js.paystack.co"
        crossOrigin="anonymous"
      />
      <link
        rel="dns-prefetch"
        href="https://js.paystack.co"
      />
      {children}
    </>
  );
}
