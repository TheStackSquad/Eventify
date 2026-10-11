//frontend /src /components /dashboard /vendorComponents /vendorAnalytics /subscriptionCard.js

"use client";

import { Calendar, AlertCircle, CheckCircle } from "lucide-react";
import { formatDistanceToNow, differenceInDays } from "date-fns";

export default function SubscriptionCard({ subscription }) {
  if (!subscription) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">No active subscription</p>
      </div>
    );
  }

  const expiryDate = new Date(subscription.expiresAt);
  const daysUntilExpiry = differenceInDays(expiryDate, new Date());

  // Determine status
  const isExpiringSoon = daysUntilExpiry <= 7;
  const isExpired = daysUntilExpiry < 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {subscription.tier.charAt(0).toUpperCase() +
              subscription.tier.slice(1)}{" "}
            Plan
          </h3>
          <p className="text-sm text-gray-600">
            ₦{(subscription.price / 100).toLocaleString()}/month
          </p>
        </div>

        {/* Status Badge */}
        {isExpired ? (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <AlertCircle size={14} />
            Expired
          </span>
        ) : isExpiringSoon ? (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
            <AlertCircle size={14} />
            Expiring Soon
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <CheckCircle size={14} />
            Active
          </span>
        )}
      </div>

      {/* Expiry Info */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Calendar size={16} />
        <span>
          {isExpired
            ? `Expired ${formatDistanceToNow(expiryDate, { addSuffix: true })}`
            : `Expires ${formatDistanceToNow(expiryDate, { addSuffix: true })}`}
        </span>
      </div>

      {/* Warning Message */}
      {isExpiringSoon && !isExpired && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            Your subscription expires in {daysUntilExpiry}{" "}
            {daysUntilExpiry === 1 ? "day" : "days"}. Renew now to keep your
            premium features.
          </p>
        </div>
      )}

      {/* Renewal Button */}
      {(isExpiringSoon || isExpired) && (
        <button
          onClick={() =>
            (window.location.href = "/dashboard/subscription/renew")
          }
          className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          {isExpired ? "Reactivate Subscription" : "Renew Now"}
        </button>
      )}
    </div>
  );
}