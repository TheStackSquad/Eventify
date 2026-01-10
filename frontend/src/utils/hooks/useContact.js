// frontend/src/utils/hooks/useContact.js
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { contactAPI } from "@/services/contactAPI";
import toastAlert from "@/components/common/toast/toastAlert";

export default function useContact(onSuccessCallback) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ vendorId, formData }) => {
      // Mapping the UI form fields to our Backend Model
      return contactAPI.sendInquiry({
        vendorId: vendorId,
        name: formData.name,
        email: formData.email,
        message: formData.message,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      toastAlert.success("Inquiry sent! The vendor will contact you soon.");
      if (onSuccessCallback) onSuccessCallback();
    },
    onError: (error) => {
      const msg = error.response?.data?.error || "Failed to send inquiry.";
      toastAlert.error(msg);
    },
  });

  return {
    sendInquiry: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    resetContact: mutation.reset,
  };
}