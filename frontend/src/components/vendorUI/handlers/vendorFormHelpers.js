//frontend/src/components/vendorUI/handlers/vendorFormHelpers.js

export const formatSelectOptions = (arr) => [
  { value: "", label: "Select...", disabled: true },
  ...arr.map((item) => ({ value: item, label: item, disabled: false })),
];

