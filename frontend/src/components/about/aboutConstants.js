//frontend/src/components/about/aboutConstants.js

import { 
  Ticket, Users, TrendingUp, Star, Shield, Lock, 
  CheckCircle, CreditCard, DollarSign, Building2 
} from "lucide-react";

export const stats = [
  { icon: Ticket, value: "50,000+", label: "Tickets Sold Monthly", annual: "600,000+ annually" },
  { icon: Users, value: "2,500+", label: "Verified Vendors", annual: "All vNIN & CAC certified" },
  { icon: TrendingUp, value: "300%", label: "Growth Rate", annual: "Year over year" },
  { icon: Star, value: "98%", label: "Customer Satisfaction", annual: "Based on user feedback" },
];

export const trustFactors = [
  {
    icon: Shield,
    title: "Vendor Verification",
    description: "Every vendor is verified through vNIN and registered with CAC - RC or BN number required."
  },
  {
    icon: Lock,
    title: "Secure Ticketing",
    description: "Industry-standard one ticket per user protocol ensures authenticity and prevents fraud."
  },
  {
    icon: CheckCircle,
    title: "Transparent Fees",
    description: "Competitive service fees with no hidden charges. Event creators keep more."
  },
];

export const paymentPartners = [
  { name: "Paystack", logo: CreditCard },
  { name: "Flutterwave", logo: DollarSign },
  { name: "Interswitch", logo: CreditCard },
];

export const hospitalityPartners = [
  { name: "Eko Hotels & Suites", logo: Building2 },
  { name: "Protea Hotels", logo: Building2 },
  { name: "Transcorp Hilton", logo: Building2 },
  { name: "Radisson Blu", logo: Building2 },
];