// frontend/src/components/create-events/constants/formConfig.js

export const CATEGORIES = [
  "Music", "Sports", "Arts & Culture", "Technology",
  "Business", "Food & Drink", "Networking", "Education",
  "Entertainment", "Other",
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

  // Location
  venueName: "",
  venueAddress: "",
  city: "",
  state: "",
  country: "Nigeria",

  // Virtual
  virtualPlatform: "",
  meetingLink: "",

  // Ticketing (Updated for Integrity Logic)
  tickets: [
    {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      tierName: "General Admission",
      price: 0,
      quantity: 10,
      soldCount: 0,
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
