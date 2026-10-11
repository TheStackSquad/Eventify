// frontend/src/components/create-events/formSteps/dateTimeLocationStep.js

import { createInputField } from "@/components/common/createInputFields";
import { memo, useMemo } from "react";

// Memoized time options generation
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ["00", "15", "30", "45"];

const TimeInput = memo(({ label, value, onChange, error, required }) => {
  // Parse 24h format (HH:MM) into components
  const [hours, minutes, period] = useMemo(() => {
    if (!value) return ["12", "00", "AM"];
    const [h24, m] = value.split(":");
    const hour24 = parseInt(h24);
    const isPM = hour24 >= 12;
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    return [hour12.toString(), m, isPM ? "PM" : "AM"];
  }, [value]);

  // Convert to 24h format and call onChange
  const handleChange = (newHours, newMinutes, newPeriod) => {
    let h24 = parseInt(newHours);
    if (newPeriod === "PM" && h24 !== 12) h24 += 12;
    if (newPeriod === "AM" && h24 === 12) h24 = 0;
    onChange(`${h24.toString().padStart(2, "0")}:${newMinutes}`);
  };

  const baseClass = `px-3 py-3 bg-gray-800 border rounded-lg text-white focus:ring-2 focus:ring-green-500 ${
    error ? "border-red-500" : "border-gray-700"
  }`;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex gap-2">
        <select
          value={hours}
          onChange={(e) => handleChange(e.target.value, minutes, period)}
          className={`flex-1 ${baseClass}`}
          aria-label="Hours"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h.toString().padStart(2, "0")}
            </option>
          ))}
        </select>

        <span className="text-gray-300 py-3" aria-hidden="true">
          :
        </span>

        <select
          value={minutes}
          onChange={(e) => handleChange(hours, e.target.value, period)}
          className={`flex-1 ${baseClass}`}
          aria-label="Minutes"
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <select
          value={period}
          onChange={(e) => handleChange(hours, minutes, e.target.value)}
          className={`flex-1 ${baseClass}`}
          aria-label="AM/PM"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
});

TimeInput.displayName = "TimeInput";

export default function DateTimeLocationStep({
  formData,
  errors,
  handleInputChange,
}) {
  const isPhysical = formData.eventType === "physical";

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-white mb-4">
        Date, Time & Location
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {createInputField({
          label: "Start Date",
          type: "date",
          name: "startDate",
          value: formData.startDate,
          onChange: (e) => handleInputChange("startDate", e.target.value),
          error: errors.startDate,
          required: true,
        })}

        <TimeInput
          label="Start Time"
          value={formData.startTime}
          onChange={(value) => handleInputChange("startTime", value)}
          error={errors.startTime}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {createInputField({
          label: "End Date",
          type: "date",
          name: "endDate",
          value: formData.endDate,
          onChange: (e) => handleInputChange("endDate", e.target.value),
        })}

        <TimeInput
          label="End Time"
          value={formData.endTime}
          onChange={(value) => handleInputChange("endTime", value)}
          error={errors.endTime}
        />
      </div>

      {isPhysical ? (
        <>
          {createInputField({
            label: "Venue Name",
            type: "text",
            name: "venueName",
            value: formData.venueName,
            onChange: (e) => handleInputChange("venueName", e.target.value),
            placeholder: "e.g., Lagos Convention Centre",
            error: errors.venueName,
            required: true,
          })}

          {createInputField({
            label: "Venue Address",
            type: "text",
            name: "venueAddress",
            value: formData.venueAddress,
            onChange: (e) => handleInputChange("venueAddress", e.target.value),
            placeholder: "Full street address",
            error: errors.venueAddress,
            required: true,
          })}

          <div className="grid grid-cols-2 gap-4">
            {createInputField({
              label: "City",
              type: "text",
              name: "city",
              value: formData.city,
              onChange: (e) => handleInputChange("city", e.target.value),
              error: errors.city,
              required: true,
            })}

            {createInputField({
              label: "State",
              type: "text",
              name: "state",
              value: formData.state,
              onChange: (e) => handleInputChange("state", e.target.value),
            })}
          </div>
        </>
      ) : (
        <>
          {createInputField({
            label: "Virtual Platform",
            type: "text",
            name: "virtualPlatform",
            value: formData.virtualPlatform,
            onChange: (e) =>
              handleInputChange("virtualPlatform", e.target.value),
            placeholder: "e.g., Zoom, Google Meet, Teams",
            error: errors.virtualPlatform,
            required: true,
          })}

          {createInputField({
            label: "Meeting Link",
            type: "url",
            name: "meetingLink",
            value: formData.meetingLink,
            onChange: (e) => handleInputChange("meetingLink", e.target.value),
            placeholder: "https://zoom.us/j/...",
            error: errors.meetingLink,
            required: true,
          })}
        </>
      )}
    </div>
  );
}
