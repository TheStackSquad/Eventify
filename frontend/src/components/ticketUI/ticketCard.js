// frontend/src/components/ticketUI/ticketCard.js

import Link from "next/link";
import {
  Calendar,
  MapPin,
  Ticket,
  User,
  Mail,
  Phone,
  Clock,
  CheckCircle,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export default function TicketCard({ orderData, formatCurrency }) {
  if (!orderData || !orderData.items || orderData.items.length === 0) {
    return null;
  }

  const item = orderData.items[0];

  return (
    <>
      {/* Main Ticket Card - Added border and minor shadow lift */}
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-6 border border-slate-200">
        {/* Ticket Header - Event Info (Deep Evening Theme) */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm mb-3 transition-opacity duration-500">
                <Sparkles size={16} />
                <span>{item.tier_name}</span>
              </div>
              <h2 className="text-3xl font-bold mb-2">{item.event_title}</h2>
              <div className="flex items-center gap-4 text-white/90">
                <div className="flex items-center gap-2">
                  <Ticket size={18} />
                  <span>×{item.quantity}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-indigo-200/80 text-sm mb-1">Amount Paid</div>
              <div className="text-2xl font-bold">
                {/* 🚨 FIX: Using final_total and passing kobo amount directly */}
                {formatCurrency(orderData.final_total)}
              </div>
            </div>
          </div>

          {/* QR Code Placeholder / Reference Display */}
          <div className="bg-white rounded-2xl p-6 text-center shadow-inner">
            <div className="bg-gray-100 rounded-xl p-8 mb-4 transition-transform duration-500 ease-out hover:scale-[1.02]">
              {/* Placeholder for QR Code */}
              <div className="text-6xl mb-2">🎫</div>
              <div className="text-xs text-gray-500 font-mono select-all">
                {orderData.reference}
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Scan this code at the venue entrance
            </p>
          </div>
        </div>

        {/* Perforated Line Effect (Softened colors) */}
        <div className="relative h-8 bg-white overflow-hidden">
          <div className="absolute inset-x-0 top-0 flex justify-between px-4">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-100 to-slate-100 -mt-2 transition-transform duration-1000"
                style={{
                  transform: "translateY(0)",
                  transitionDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Ticket Details */}
        <div className="p-8 space-y-6">
          {/* Attendee Info */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User size={20} className="text-indigo-600" /> {/* 🎨 STYLED */}
              Ticket Holder
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg transition-shadow hover:shadow-sm">
                <User size={18} className="text-gray-400" />
                <div>
                  <div className="text-xs text-gray-500">Name</div>
                  <div className="font-medium text-gray-900">
                    {orderData.customer.first_name}{" "}
                    {orderData.customer.last_name}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg transition-shadow hover:shadow-sm">
                <Mail size={18} className="text-gray-400" />
                <div>
                  <div className="text-xs text-gray-500">Email</div>
                  <div className="font-medium text-gray-900 truncate">
                    {orderData.customer.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg transition-shadow hover:shadow-sm">
                <Phone size={18} className="text-gray-400" />
                <div>
                  <div className="text-xs text-gray-500">Phone</div>
                  <div className="font-medium text-gray-900">
                    {orderData.customer.phone}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg transition-shadow hover:shadow-sm">
                <MapPin size={18} className="text-gray-400" />
                <div>
                  <div className="text-xs text-gray-500">Location</div>
                  <div className="font-medium text-gray-900">
                    {orderData.customer.city}, {orderData.customer.state}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Order Info */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock size={20} className="text-indigo-600" /> {/* 🎨 STYLED */}
              Order Information
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Reference Number</span>
                <span className="font-mono font-medium text-gray-900 select-all">
                  {orderData.reference}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Purchase Date</span>
                <span className="font-medium text-gray-900">
                  {new Date(orderData.created_at).toLocaleDateString("en-NG", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Payment Method</span>
                <span className="font-medium text-gray-900 capitalize">
                  {orderData.payment_channel}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Status</span>
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  <CheckCircle size={14} />
                  Confirmed
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Important Notes (Adjusted border/text to harmonize) */}
      <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 mb-8 transition-shadow duration-300 hover:shadow-md">
        <h3 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
          <span className="text-xl">💡</span> {/* Changed from ⚠️ to 💡 */}
          Important Information
        </h3>
        <ul className="space-y-2 text-sm text-indigo-800">
          <li className="flex items-start gap-2">
            <span className="text-indigo-600 mt-1">•</span> {/* 🎨 STYLED */}
            <span>
              Present this ticket (digital or printed) at the venue entrance
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-600 mt-1">•</span> {/* 🎨 STYLED */}
            <span>Ticket is non-transferable and cannot be resold</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-600 mt-1">•</span> {/* 🎨 STYLED */}
            <span>Keep your reference number safe for support inquiries</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-600 mt-1">•</span> {/* 🎨 STYLED */}
            <span>
              Contact us at{" "}
              <span className="font-medium">support@eventify.com</span> if you
              need assistance
            </span>
          </li>
        </ul>
      </div>

      {/* CTA Section (Deep Evening Theme) */}
      <div className="bg-gradient-to-r from-indigo-700 to-purple-800 rounded-2xl p-8 mb-5 text-white text-center shadow-2xl transition-transform duration-500 hover:scale-[1.01]">
        <h3 className="text-2xl font-bold mb-2">Ready for More Events?</h3>
        <p className="text-white/90 mb-6">
          Discover exciting events happening near you
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-white text-indigo-700 px-8 py-3 rounded-xl font-medium hover:bg-indigo-50 transition-all duration-300 hover:scale-[1.03] shadow-lg"
          >
            Browse Events
            <ChevronRight size={20} />
          </Link>
          <Link
            href="/my-tickets"
            className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-sm text-white px-8 py-3 rounded-xl font-medium hover:bg-white/20 transition-all border-2 border-white/30"
          >
            <Ticket size={20} />
            My Tickets
          </Link>
        </div>
      </div>
    </>
  );
}
