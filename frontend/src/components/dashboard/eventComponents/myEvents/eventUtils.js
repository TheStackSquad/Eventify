// frontend/src/components/dashboard/myEvents/eventUtils.js

// Utility function to calculate days until event
export const getDaysUntil = (date) => {
  const now = new Date();
  const eventDate = new Date(date);
  const diffTime = eventDate - now;
  // Use Math.ceil to round up, so 0.1 days is counted as 1 day away.
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Utility function to get event status
export const getEventStatus = (startDate, endDate) => {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) return { label: "Upcoming", color: "bg-blue-500" };
  if (now >= start && now <= end)
    return { label: "Live", color: "bg-green-500" };
  return { label: "Ended", color: "bg-gray-500" };
};
