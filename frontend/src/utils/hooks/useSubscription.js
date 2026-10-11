//frontend/src/utils/hooks/useSubscription.js

"use client";

import { useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  initiateSubscriptionAPI,
  fetchCurrentSubscription,
} from "@/services/subscriptionAPI";
import toastAlert from "@/components/common/toast/toastAlert";
import globalConstants from "@/utils/constants/globalConstants";

const { ERROR_MESSAGES } = globalConstants;

/**
 * Hook to fetch current vendor subscription status
 */
export const useSubscriptionStatus = () => {
  return useQuery({
    queryKey: ["subscriptionStatus"],
    queryFn: async () => {
      console.log("🔍 Fetching subscription status from API...");
      return fetchCurrentSubscription();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    onSuccess: (data) => {
      console.log("✅ Subscription status received:", {
        tier: data?.tier,
        status: data?.subscription?.status,
        expiresAt: data?.subscription?.expires_at,
      });
    },
    onError: (err) => {
      console.error("❌ Error in useSubscriptionStatus:", err.message);
    },
  });
};

/**
 * Hook to initiate Paystack subscription flow
 */
export const useInitiateSubscription = () => {
  const queryClient = useQueryClient();
  const abortControllerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        console.log("🧹 Unmounting: Cleaning up pending subscription requests");
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return useMutation({
    mutationFn: async (payload) => {
      console.log("🚀 Mutation Triggered: Initiating subscription", payload);

      // Abort any existing pending request
      if (abortControllerRef.current) {
        console.warn("⚠️ Aborting existing request before starting new one");
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      return initiateSubscriptionAPI(payload, controller.signal);
    },

    onSuccess: (response) => {
      console.log("📥 API Raw Response:", response);

      // Extract authorization URL from response (handle both nested and flat structures)
      const responseData = response?.data || response;
      const authUrl = responseData?.authorizationUrl || responseData?.url;
      const subId = responseData?.subscriptionId || responseData?.id;

      console.log("DEBUG - Extracted values:", {
        foundAuthUrl: !!authUrl,
        foundSubId: subId,
        source: response?.data ? "Nested (.data)" : "Flat (Direct)",
      });

      // Guard: Ensure we have the redirect URL
      if (!authUrl) {
        console.error(
          "❌ Critical: No redirect URL found in response object!",
          responseData,
        );
        toastAlert.error(
          "Payment initialization failed - No gateway URL found.",
        );
        return;
      }

      try {
        // Invalidate cache to force refetch after payment
        console.log("⚡ Invalidating old subscription queries...");
        queryClient.invalidateQueries(["subscriptionStatus"]);

        console.log("🔗 Redirecting browser to:", authUrl);

        // Redirect to Paystack payment page
        window.location.href = authUrl;
      } catch (redirectError) {
        console.error("❌ Redirect Exception:", redirectError);

        // Fallback: Programmatic link creation
        const link = document.createElement("a");
        link.href = authUrl;
        document.body.appendChild(link);
        link.click();
      }
    },

    onError: (error) => {
      // Ignore aborted requests
      if (error.name === "AbortError") {
        console.log("⏹️ Request was intentionally aborted");
        return;
      }

      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      console.error("❌ Mutation Error:", {
        status,
        message,
        fullError: error,
      });

      // Handle specific error cases
      if (status === 409) {
        toastAlert.error("You already have a pending or active subscription.");
      } else {
        toastAlert.error(message || "Failed to start payment process.");
      }
    },

    onSettled: () => {
      console.log("🏁 Subscription mutation cycle complete (Settled)");
      abortControllerRef.current = null;
    },
  });
};

/**
 * Hook to safely initiate subscription with pre-flight checks
 */
export const useSafeInitiateSubscription = () => {
  const { data: currentSub } = useSubscriptionStatus();
  const { mutate, isLoading } = useInitiateSubscription();

  const initiateWithValidation = (tierId) => {
    // Guard: Prevent duplicate active subscriptions
    if (currentSub?.subscription?.status === "active") {
      toastAlert.error("You already have an active subscription");
      console.warn("🚫 Blocked: User already has active subscription");
      return;
    }

    // Guard: Warn about pending payments
    if (currentSub?.subscription?.status === "pending") {
      toastAlert.warning(
        "You have a pending payment. Please complete it first.",
      );
      console.warn("🚫 Blocked: User has pending subscription");
      return;
    }

    // Proceed with initiation
    console.log("✅ Pre-flight checks passed, initiating subscription");
    mutate(tierId);
  };

  return { initiateWithValidation, isLoading };
};

/**
 * Helper hook to check subscription features
 */
export const useSubscriptionFeatures = () => {
  const { data, isLoading, error } = useSubscriptionStatus();

  return {
    features: data?.features || [],
    tier: data?.tier || "free",
    isLoading,
    error,
    hasFeature: (featureName) => {
      const has = data?.features?.some((f) => f.name === featureName);
      console.log(`Checking feature [${featureName}]:`, has);
      return has || false;
    },
  };
};
