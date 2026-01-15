// frontend/src/components/ticketUI/components/ticketContent.js

import { Calendar, MapPin, Clock } from "lucide-react";

/**
 * TicketContent Component - Refactored to match boarding pass style
 */
const TicketContent = ({
  eventTitle,
  eventVenue,
  eventCity,
  eventState,
  tierName,
  uniqueTicketId,
  eventDate,
  eventTime,
  quantity,
  firstName,
  lastName,
}) => (
  <div className="flex flex-col md:flex-row">
    {/* LEFT SIDE - Dark Yellow with Event Details */}
    <div className="relative bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-500 md:w-2/3 p-8 md:p-10">
      {/* Decorative Elements */}
      {/* <div className="absolute top-4 right-4 opacity-20">
        <Plane size={80} className="text-yellow-900 transform rotate-45" />
      </div> */}

      {/* Event Header */}
      <div className="mb-8 mt-8">
        <h1 className="text-3xl md:text-4xl font-black text-yellow-900 leading-tight mb-2">
          {eventTitle}
        </h1>
        <p className="text-sm font-semibold text-yellow-800">{tierName}</p>
      </div>

      {/* Event Details Grid */}
      <div className="space-y-6">
        {/* Date & Time Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={14} className="text-yellow-900" />
              <p className="text-xs font-bold text-yellow-900 uppercase tracking-wide">
                Date
              </p>
            </div>
            <p className="font-mono text-lg font-bold text-yellow-950">
              {eventDate}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-yellow-900" />
              <p className="text-xs font-bold text-yellow-900 uppercase tracking-wide">
                Time
              </p>
            </div>
            <p className="font-mono text-lg font-bold text-yellow-950">
              {eventTime}
            </p>
          </div>
        </div>

        {/* Location */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={14} className="text-yellow-900" />
            <p className="text-xs font-bold text-yellow-900 uppercase tracking-wide">
              Location
            </p>
          </div>
          <p className="font-bold text-yellow-950 text-lg">{eventVenue}</p>
          <p className="text-sm font-semibold text-yellow-800">
            {eventCity}, {eventState}
          </p>
        </div>

        {/* Passenger Info */}
        <div className="pt-4 border-t-2 border-yellow-600 border-dashed">
          <p className="text-xs font-bold text-yellow-900 uppercase tracking-wide mb-1">
            Ticket Holder
          </p>
          <p className="font-bold text-yellow-950 text-xl">
            {firstName} {lastName}
          </p>
        </div>
      </div>

      {/* Perforated Edge on Right (Desktop) */}
      <div className="hidden md:block absolute right-0 top-0 bottom-0 w-8">
        <div className="flex flex-col justify-around h-full py-4">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full bg-white -mr-2 shadow-inner"
            />
          ))}
        </div>
      </div>

      {/* Perforated Edge on Bottom (Mobile) */}
      <div className="md:hidden absolute bottom-0 left-0 right-0 h-8">
        <div className="flex justify-around items-center w-full px-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full bg-white -mb-2 shadow-inner"
            />
          ))}
        </div>
      </div>
    </div>

    {/* RIGHT SIDE - White with Ticket Details & QR */}
    <div className="bg-white md:w-1/3 p-8 md:p-6 flex flex-col justify-between">
      {/* QR Code Section */}
      <div className="flex-1 flex flex-col items-center justify-center mb-6">
        <div className="bg-white p-4 rounded-xl border-4 border-gray-900 shadow-lg mb-4">
          {/* QR Code will be rendered by QRCodeDisplay component */}
          <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-xs text-gray-400">QR</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 font-mono text-center break-all px-2">
          {uniqueTicketId}
        </p>
      </div>

      {/* Ticket Details */}
      <div className="space-y-4 border-t-2 border-gray-200 pt-6">
        {/* Quantity */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
            Quantity
          </p>
          <p className="font-mono text-2xl font-black text-gray-900">
            {quantity}x
          </p>
        </div>

        {/* Tier */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
            Tier
          </p>
          <p className="font-bold text-gray-900">{tierName}</p>
        </div>
      </div>

      {/* Barcode Effect */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex gap-[2px] h-12">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-gray-900"
              style={{
                opacity: Math.random() > 0.3 ? 1 : 0,
                height: `${50 + Math.random() * 50}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default TicketContent;
