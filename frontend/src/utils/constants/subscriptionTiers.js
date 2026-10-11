// frontend/src/utils/constants/subscriptionTiers.js

// ========== SUBSCRIPTION TIERS ==========
export const SUBSCRIPTION_TIERS = {
  // FREE: {
  //   id: "free",
  //   name: "Free",
  //   price: 0,
  //   priceKobo: 0,
  //   priceDisplay: "₦0",
  //   billingCycle: "forever",
  //   recommended: false,
  //   badge: { show: false, text: "", color: "gray", icon: "" },
  //   tagline: "Get started with basic listing",
  //   color: "gray",
  //   // Grouped features to match component logic
  //   features: {
  //     visibility: [
  //       { name: "Basic profile listing", included: true },
  //       { name: "Lowest search priority", included: true },
  //       { name: "Featured on For-You page", included: false },
  //     ],
  //     analytics: [
  //       { name: "Profile view tracking", included: false },
  //       { name: "Inquiry analytics", included: false },
  //     ],
  //     profile: [
  //       { name: "Photo gallery (up to 3)", included: true },
  //       { name: "Video showcase", included: false },
  //     ],
  //   },
  //   benefits: ["Basic online presence", "Review collection"],
  //   valueProp: { roi: "Limited", metric: "Basic Listing" },
  // },

  BASIC: {
    id: "basic",
    name: "Basic",
    price: 3500,
    priceKobo: 350000,
    priceDisplay: "₦3,500",
    billingCycle: "month",
    recommended: false,
    badge: { show: true, text: "Bronze", color: "#CD7F32", icon: "🥉" },
    tagline: "See who's viewing + get noticed",
    color: "blue",
    features: {
      visibility: [
        { name: "Normal search ranking", included: true },
        { name: "Featured on For-You page", included: true },
      ],
      analytics: [
        { name: "Profile views (30 days)", included: true },
        { name: "Inquiry count", included: true },
      ],
      credibility: [
        { name: "Bronze verified badge", included: true },
        { name: "Public view count", included: true },
      ],
    },
    benefits: ["See who views you", "Appear in discovery"],
    valueProp: { roi: "3x Visibility", metric: "~400 views per ₦1,000" },
  },

  PREMIUM: {
    id: "premium",
    name: "Premium",
    price: 10000,
    priceKobo: 1000000,
    priceDisplay: "₦10,000",
    billingCycle: "month",
    recommended: true,
    badge: { show: true, text: "Silver", color: "#C0C0C0", icon: "🥈" },
    tagline: "3x visibility + Top-rated proof",
    color: "indigo",
    features: {
      visibility: [
        { name: "Search boost (+20 pts)", included: true, highlight: true },
        { name: "Top Performers grid", included: true },
      ],
      analytics: [
        { name: "Conversion tracking", included: true },
        { name: "Review analytics", included: true },
      ],
      profile: [
        { name: "Photo gallery (up to 10)", included: true },
        { name: "Video showcase (2)", included: true },
      ],
    },
    benefits: ["Rank in Top 10", "Priority inquiries"],
    valueProp: { roi: "High Growth", metric: "~4,000+ views/mo" },
  },

  FEATURED: {
    id: "featured",
    name: "Featured",
    price: 20000,
    priceKobo: 2000000,
    priceDisplay: "₦20,000",
    billingCycle: "month",
    recommended: false,
    badge: { show: true, text: "Gold", color: "#FFD700", icon: "🥇" },
    tagline: "Dominate your category",
    color: "purple",
    features: {
      visibility: [
        { name: "Maximum boost (+50 pts)", included: true },
        { name: "Home Hero Carousel", included: true, highlight: true },
      ],
      analytics: [
        { name: "Competitor dashboard", included: true },
        { name: "Geographic heatmap", included: true },
      ],
      profile: [{ name: "Unlimited photos/videos", included: true }],
    },
    benefits: ["#1 Rank Potential", "Maximum Exposure"],
    valueProp: { roi: "Market Leader", metric: "~8,000+ views/mo" },
  },
};

// ========== COMPARISON FEATURES (Detailed) ==========
export const COMPARISON_FEATURES = [
  // VISIBILITY & DISCOVERY
  {
    category: "Visibility & Discovery",
    features: [
      {
        label: "Search Results",
        free: "✓ Lowest priority",
        basic: "✓ Normal priority",
        premium: "✓ Boosted (+20)",
        featured: "✓ Maximum (+50)",
      },
      {
        label: "For-You Page",
        free: "✗",
        basic: "✓ All Vendors",
        premium: "✓ Top Grid",
        featured: "✓ Hero + Grid",
      },
      {
        label: "Hero Carousel",
        free: "✗",
        basic: "✗",
        premium: "✗",
        featured: "✓ Daily rotation",
      },
      {
        label: "Category Spotlight",
        free: "✗",
        basic: "✗",
        premium: "✓",
        featured: "✓ First position",
      },
    ],
  },

  // ANALYTICS & INSIGHTS
  {
    category: "Analytics & Insights",
    features: [
      {
        label: "Profile View Count",
        free: "✗",
        basic: "✓ Last 30 days",
        premium: "✓ + Historical",
        featured: "✓ Real-time",
      },
      {
        label: "Inquiry Tracking",
        free: "✗",
        basic: "✓ Count only",
        premium: "✓ Detailed",
        featured: "✓ Full breakdown",
      },
      {
        label: "Performance Charts",
        free: "✗",
        basic: "✓ Views chart",
        premium: "✓ All metrics",
        featured: "✓ + Trends",
      },
      {
        label: "Conversion Metrics",
        free: "✗",
        basic: "✗",
        premium: "✓ Inquiry rate",
        featured: "✓ + Revenue",
      },
      {
        label: "Competitor Comparison",
        free: "✗",
        basic: "✗",
        premium: "✗",
        featured: "✓ Top 10 rank",
      },
      {
        label: "Geographic Insights",
        free: "✗",
        basic: "✗",
        premium: "✗",
        featured: "✓ Heatmap",
      },
    ],
  },

  // CREDIBILITY & TRUST
  {
    category: "Credibility & Trust",
    features: [
      {
        label: "Verified Badge",
        free: "✗",
        basic: "🥉 Bronze",
        premium: "🥈 Silver",
        featured: "🥇 Gold",
      },
      {
        label: "Public View Count",
        free: "✗",
        basic: '✓ "1,440 views"',
        premium: '✓ "4,000 views"',
        featured: '✓ "8,000+ views"',
      },
      {
        label: "Ranking Display",
        free: "✗",
        basic: "✗",
        premium: '✓ "Top 10"',
        featured: '✓ "#1"',
      },
      {
        label: "Featured Tag",
        free: "✗",
        basic: "✗",
        premium: "✗",
        featured: "✓ Gold banner",
      },
    ],
  },

  // PROFILE & BRANDING
  {
    category: "Profile & Branding",
    features: [
      {
        label: "Photo Gallery",
        free: "3 photos",
        basic: "3 photos",
        premium: "10 photos",
        featured: "Unlimited",
      },
      {
        label: "Video Showcase",
        free: "✗",
        basic: "✗",
        premium: "2 videos",
        featured: "Unlimited",
      },
      {
        label: "Description Length",
        free: "500 chars",
        basic: "1,000 chars",
        premium: "Unlimited",
        featured: "Unlimited + rich",
      },
    ],
  },

  // CUSTOMER ENGAGEMENT
  {
    category: "Customer Engagement",
    features: [
      {
        label: "Receive Inquiries",
        free: "✓",
        basic: "✓",
        premium: "✓",
        featured: "✓",
      },
      {
        label: "Priority Delivery",
        free: "✗",
        basic: "✗",
        premium: "✓ +24h earlier",
        featured: "✓ +48h earlier",
      },
      {
        label: "Response Tracking",
        free: "✗",
        basic: "✗",
        premium: "✓ Avg time",
        featured: "✓ Full analytics",
      },
    ],
  },
];

// ========== HELPER FUNCTIONS ==========

//Get tier by ID
export const getTierById = (tierId) => {
  const tierKey = tierId.toUpperCase();
  return SUBSCRIPTION_TIERS[tierKey] || SUBSCRIPTION_TIERS.FREE;
};

//Get all tiers as array (ordered)
export const getAllTiersArray = () => {
  return [
    SUBSCRIPTION_TIERS.FREE,
    SUBSCRIPTION_TIERS.BASIC,
    SUBSCRIPTION_TIERS.PREMIUM,
    SUBSCRIPTION_TIERS.FEATURED,
  ];
};

//Get only paid tiers
export const getPaidTiers = () => {
  return [
    SUBSCRIPTION_TIERS.BASIC,
    SUBSCRIPTION_TIERS.PREMIUM,
    SUBSCRIPTION_TIERS.FEATURED,
  ];
};

//Get tier color (for badges, buttons, etc.)
export const getTierColor = (tierId) => {
  const tier = getTierById(tierId);
  return tier.color;
};

//Get tier badge
export const getTierBadge = (tierId) => {
  const tier = getTierById(tierId);
  return tier.badge;
};

//Check if tier has feature access
export const hasFeatureAccess = (currentTier, requiredTier) => {
  const tierRank = {
    free: 0,
    basic: 1,
    premium: 2,
    featured: 3,
  };

  return (
    tierRank[currentTier.toLowerCase()] >= tierRank[requiredTier.toLowerCase()]
  );
};
