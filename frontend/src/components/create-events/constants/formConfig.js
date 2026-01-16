//frontend/src/components/create-events/constants/formConfig.js

export const CATEGORIES = [
  "Music",
  "Sports",
  "Arts & Culture",
  "Technology",
  "Business",
  "Food & Drink",
  "Networking",
  "Education",
  "Entertainment",
  "Other",
];

export const INITIAL_FORM_DATA = {
  // Basic Info
  eventTitle: "",
  eventDescription: "",
  category: "",
  eventType: "physical",

  // Date & Time
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  timezone: "Africa/Lagos",

  // Location (for physical events)
  venueName: "",
  venueAddress: "",
  city: "",
  state: "",
  country: "Nigeria",

  // Virtual Event Details (for online events)
  virtualPlatform: "",
  meetingLink: "",

  // Ticketing
  tickets: [
    {
      tierName: "General Admission",
      price: "",
      quantity: "",
      isFree: false,
      description: "",
    },
  ],

  // Payment Setup
  paystackSubaccountCode: "",

  // Additional Info
  eventImage: null,
  eventImagePreview: "",
  tags: [],
  maxAttendees: "",
};
