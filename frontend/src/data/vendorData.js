// frontend/src/data/vendorData.js

export const VENDOR_CATEGORIES = [
  { value: "", label: "Select a category", disabled: true },
  { value: "caterer", label: "Catering & Food Services" },
  { value: "decorator", label: "Event Decoration & Design" },
  { value: "photographer", label: "Photography & Videography" },
  { value: "dj", label: "DJ & Entertainment" },
  { value: "mc", label: "Master of Ceremonies (MC)" },
  { value: "venue", label: "Venue & Space Rental" },
  { value: "planner", label: "Event Planning & Coordination" },
  { value: "makeup", label: "Makeup & Beauty Services" },
  { value: "rentals", label: "Equipment & Furniture Rentals" },
  { value: "security", label: "Security Services" },
];

export const NIGERIAN_STATES = [
  { value: "", label: "Select your state", disabled: true },
  { value: "Abia", label: "Abia" },
  { value: "Adamawa", label: "Adamawa" },
  { value: "Akwa Ibom", label: "Akwa Ibom" },
  { value: "Anambra", label: "Anambra" },
  { value: "Bauchi", label: "Bauchi" },
  { value: "Bayelsa", label: "Bayelsa" },
  { value: "Benue", label: "Benue" },
  { value: "Borno", label: "Borno" },
  { value: "Cross River", label: "Cross River" },
  { value: "Delta", label: "Delta" },
  { value: "Ebonyi", label: "Ebonyi" },
  { value: "Edo", label: "Edo" },
  { value: "Ekiti", label: "Ekiti" },
  { value: "Enugu", label: "Enugu" },
  { value: "Abuja FCT", label: "Federal Capital Territory (Abuja)" },
  { value: "Gombe", label: "Gombe" },
  { value: "Imo", label: "Imo" },
  { value: "Jigawa", label: "Jigawa" },
  { value: "Kaduna", label: "Kaduna" },
  { value: "Kano", label: "Kano" },
  { value: "Katsina", label: "Katsina" },
  { value: "Kebbi", label: "Kebbi" },
  { value: "Kogi", label: "Kogi" },
  { value: "Kwara", label: "Kwara" },
  { value: "Lagos", label: "Lagos" },
  { value: "Nasarawa", label: "Nasarawa" },
  { value: "Niger", label: "Niger" },
  { value: "Ogun", label: "Ogun" },
  { value: "Ondo", label: "Ondo" },
  { value: "Osun", label: "Osun" },
  { value: "Oyo", label: "Oyo" },
  { value: "Plateau", label: "Plateau" },
  { value: "Rivers", label: "Rivers" },
  { value: "Sokoto", label: "Sokoto" },
  { value: "Taraba", label: "Taraba" },
  { value: "Yobe", label: "Yobe" },
  { value: "Zamfara", label: "Zamfara" },
];

export const PRICE_RANGES = {
  MIN: 1000,
  MAX: 100000000,
  STEP: 1000,
};

export const FORM_PLACEHOLDERS = {
  businessName: "e.g., Johnson Catering Services",
  city: "e.g., Lekki Phase 1, Wuse 2, Victoria Island",
  minPrice: "e.g., 50000",
  phoneNumber: "e.g., 08012345678",
};
