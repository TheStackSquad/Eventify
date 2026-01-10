// frontend/src/utils/hooks/useReview.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewAPI } from "@/services/reviewApi";
import toastAlert from "@/components/common/toast/toastAlert";
import { parseReviewError } from "@/utils/helper/errorParser";
import { SUCCESS_MESSAGES } from "@/utils/constants/errorMessages";

export const useReview = (vendorId) => {
  const queryClient = useQueryClient();

  const {
    data: reviewData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["reviews", vendorId],
    queryFn: () => reviewAPI.getVendorReviews(vendorId),
    enabled: !!vendorId,
    staleTime: 1000 * 60 * 5,
  });

  const createReviewMutation = useMutation({
    mutationFn: (newReview) => reviewAPI.createReview(vendorId, newReview),

    onMutate: async (newReview) => {
      await queryClient.cancelQueries({ queryKey: ["reviews", vendorId] });
      const previousReviews = queryClient.getQueryData(["reviews", vendorId]);

      queryClient.setQueryData(["reviews", vendorId], (old) => ({
        ...old,
        reviews: [
          {
            id: "temp-id",
            ...newReview,
            comment: newReview.content,
            createdAt: new Date().toISOString(),
          },
          ...(old?.reviews || []),
        ],
      }));

      return { previousReviews };
    },

    onError: (err, newReview, context) => {
      queryClient.setQueryData(["reviews", vendorId], context.previousReviews);
      const friendlyError = parseReviewError(err);
      toastAlert.error(friendlyError);
    },

    onSuccess: (data) => {
      const message = data?.message || SUCCESS_MESSAGES.REVIEW.SUBMITTED;
      toastAlert.success(message);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", vendorId] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ reviewId, isApproved }) =>
      reviewAPI.updateReviewStatus(reviewId, isApproved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", vendorId] });
      toastAlert.success(SUCCESS_MESSAGES.REVIEW.APPROVED);
    },
  });

  return {
    reviews: reviewData?.reviews || [],
    reviewCount: reviewData?.count || 0,
    isLoading,
    isError,
    error,
    refetch,
    postReview: createReviewMutation.mutate,
    isPosting: createReviewMutation.isPending,
    updateStatus: updateStatusMutation.mutate,
  };
};
