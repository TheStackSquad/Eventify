// frontend/src/components/ticketUI/errorState.js

import Link from "next/link";
import { AlertCircle } from "lucide-react";

const ErrorState = ({ message = "No Ticket Found", subtext }) => (
  <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
      <AlertCircle
        className="mx-auto h-16 w-16 text-red-500 mb-4"
        aria-hidden="true"
      />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{message}</h1>
      <p className="text-gray-600 mb-6">
        {subtext ||
          "We couldn't find the ticket you're looking for. Please check the reference."}
      </p>
      <Link
        href="/events"
        className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Browse Events
      </Link>
    </div>
  </div>
);

export default ErrorState;