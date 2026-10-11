// frontend/src/app/for-you/utils/transformer.js

export const transformSingleVendor = (vendor) => {
  if (!vendor) {
    console.warn("⚠️ [Transformer] Received null/undefined vendor");
    return null;
  }

  console.log("🔄 [Transformer] Input vendor:", vendor);

  const transformed = {
    // UUID
    id: vendor.vendorId || vendor.vendor_id,

    // Core fields
    businessName: vendor.name || "Unknown Business",
    category: vendor.category || "General",
    
    // Scores
    score: Number(vendor.pvsScore || vendor.pvs_score) || 0,
    reviewCount: vendor.reviewCount || vendor.review_count || 0,
    
    // Subscription
    tier: vendor.subscriptionTier || vendor.subscription_tier || "free",
    
    // Image - CRITICAL
    avatar: vendor.imageUrl || vendor.image_url || "/api/placeholder/400/320",
    
    // Location
    location:
      vendor.city && vendor.state
        ? `${vendor.city}, ${vendor.state}`
        : vendor.state || "Nigeria",
    
    // Verification
    isVerified: !!(
      vendor.isIdentityVerified || 
      vendor.is_identity_verified || 
      (vendor.isBusinessVerified?.Bool || vendor.is_business_verified?.Bool)
    ),
    isBusinessRegistered: !!(
      vendor.isBusinessRegistered || 
      vendor.is_business_registered
    ),
    
    // Rankings
    rank: {
      overall: vendor.overallRank || vendor.overall_rank || null,
      category: vendor.categoryRank || vendor.category_rank || null,
    },
    
    // Views
    views_30d: vendor.monthlyViews || vendor.monthly_views || 0,
    
    // Rating (calculate from score if not provided)
    rating: vendor.rating || ((vendor.pvsScore || vendor.pvs_score || 0) / 20).toFixed(1),
  };

  console.log("✅ [Transformer] Output:", {
    id: transformed.id,
    name: transformed.businessName,
    hasImage: transformed.avatar !== "/api/placeholder/400/320",
    imageUrl: transformed.avatar,
  });

  return transformed;
};

export const transformLeaderboardData = (data) => {
  if (!data || typeof data !== "object") {
    console.warn("⚠️ [Transformer] Invalid leaderboard data:", data);
    return {};
  }

  const transformed = {};

  Object.keys(data).forEach((categoryKey) => {
    if (Array.isArray(data[categoryKey])) {
      transformed[categoryKey] = data[categoryKey]
        .map(transformSingleVendor)
        .filter(v => v !== null)
        .sort((a, b) => b.score - a.score);
      
      console.log(`📊 [Transformer] ${categoryKey}: ${transformed[categoryKey].length} vendors`);
    } else {
      transformed[categoryKey] = [];
    }
  });

  return transformed;
};
