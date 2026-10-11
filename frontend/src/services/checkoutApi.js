// frontend/src/service/chekoutApi.js

import backendInstance from "@/axiosConfig/axios";


export const checkoutApi = backendInstance;

export const CHECKOUT_ENDPOINTS = {
  INITIALIZE_ORDER: "/api/orders/initialize",
  // Example: VERIFY_PAYMENT: "/orders/verify-payment",
};

export default checkoutApi;
