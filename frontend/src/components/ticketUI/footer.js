// frontend/src/components/ticketUI/footer.js

import Link from "next/link";

const TicketFooter = () => (
  <footer className="mt-12 text-center">
    <div className="inline-block bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-2xl">
      <h2 className="font-semibold text-gray-900 mb-2">
        Important Information
      </h2>
      <ul className="text-sm text-gray-600 space-y-1 text-left">
        <li>• Save or download your ticket(s) for offline access</li>
        <li>• Present QR code at venue entrance for verification</li>
        <li>• Add event to your calendar to get reminders</li>
        <li>• Contact support if you have any questions</li>
      </ul>
    </div>

    <p className="text-sm text-gray-500 mt-6">
      Need help?{" "}
      <Link href="/support" className="text-indigo-600 hover:underline">
        Contact Support
      </Link>
    </p>
  </footer>
);

export default TicketFooter;