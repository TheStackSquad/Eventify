// frontend/src/components/vendorUI/vendorProfileWrapper/components/actionButtons.js
import React, { useState } from "react";
import { MessageSquare } from "lucide-react";
import ContactVendorModal from "@/components/modal/contactVendorModal";

const ActionButtons = ({ vendor }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleRequestQuote = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Prepare vendor data for the modal using flat structure
  const vendorData = {
    id: vendor?.id,
    name: vendor?.name,
    category: vendor?.category,
    state: vendor?.state,
    city: vendor?.city,
    image: vendor?.imageURL,
    rating: vendor?.pvsScore ? (vendor.pvsScore / 20).toFixed(1) : "0.0",
    location: `${vendor?.city || "Unknown"}, ${vendor?.state || "Location"}`,
  };

  return (
    <>
      <div className="mt-8 pt-6 border-t-2 border-green-200">
        {/* Request Quote Button - triggers modal */}
        <button
          onClick={handleRequestQuote}
          className="w-full min-h-11 py-3.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors duration-300 shadow-md hover:shadow-lg flex items-center justify-center"
          aria-label="Request a quote from this vendor"
          aria-haspopup="dialog"
          aria-expanded={isModalOpen}
        >
          <MessageSquare size={18} className="mr-2" aria-hidden="true" />
          <span>Request Quote</span>
        </button>
      </div>

      {/* Modal - only renders when isModalOpen is true */}
      <ContactVendorModal
        vendorId={vendor?.id}
        vendorData={vendorData}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        mode="create"
      />
    </>
  );
};

export default ActionButtons;
