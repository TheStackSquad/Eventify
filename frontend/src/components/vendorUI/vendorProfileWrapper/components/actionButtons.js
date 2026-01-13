// frontend/src/components/vendorUI/vendorProfileWrapper/components/actionButtons.js
import React, { useState } from "react";
import { MessageSquare, Mail } from "lucide-react";
import ContactVendorModal from "@/components/modal/contactVendorModal";
import Link from "next/link";

const ActionButtons = ({ vendor }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleRequestQuote = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Prepare vendor data for the modal
  const vendorData = {
    id: vendor.initialData.id,
    name: vendor.initialData.name,
    category: vendor.initialData.category,
    state: vendor.initialData.state,
    city: vendor.initialData.city,
    image: vendor.initialData.imageURL,
    rating: (vendor.initialData.pvsScore / 20).toFixed(1),
    location: `${vendor.initialData.city}, ${vendor.initialData.state}`,
  };

  return (
    <>
      <div className="mt-8 pt-6 border-t-2 border-green-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Request Quote Button - triggers modal */}
        <button
          onClick={handleRequestQuote}
          className="w-full py-3.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors duration-300 shadow-md hover:shadow-lg flex items-center justify-center"
          aria-label="Request a quote from this vendor"
          aria-haspopup="dialog"
          aria-expanded={isModalOpen}
        >
          <MessageSquare size={18} className="mr-2" aria-hidden="true" />
          <span>Request Quote</span>
        </button>

        <Link
          href={`mailto:${vendor.initialData.email}?subject=Inquiry about ${vendor.initialData.name}`}
          className="w-full py-3.5 bg-white text-green-700 font-semibold rounded-lg border-2 border-green-300 hover:bg-green-50 hover:border-green-400 transition-colors duration-300 flex items-center justify-center"
          aria-label="Send inquiry email"
        >
          <Mail size={18} className="mr-2" aria-hidden="true" />
          <span>Send Inquiry</span>
        </Link>
      </div>

      {/* Modal - only renders when isModalOpen is true */}
      <ContactVendorModal
        vendorId={vendor.initialData.id}
        vendorData={vendorData}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        mode="create"
      />
    </>
  );
};

export default ActionButtons;
