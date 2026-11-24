// frontend/ src/ __tests__/ authTestHelpers.js

/**
 * authTestHelpers.js
 * Shared constants, mock factories, and jsdom utilities for auth test suites.
 */

"use strict";

const MOCK_API_ENDPOINTS = {
  AUTH: {
    REFRESH: "/auth/refresh",
    LOGIN: "/auth/login",
    SIGNUP: "/auth/signup",
  },
  EVENTS: {
    CREATE: "/events",
    UPDATE: "/events/:eventId",
    DELETE: "/events/:id",
    GET_BY_ID: "/events/:eventId",
    MY_EVENTS: "/events/user",
    BASE: "/events",
    ANALYTICS: "/events/:eventId/analytics",
  },
};

const makeError = (status, url = "/api/data", extraConfig = {}) => ({
  response: { status, data: {} },
  config: { url, method: "get", _retry: false, ...extraConfig },
  message: `Request failed with status code ${status}`,
});

/**
 * Set window.location.pathname without triggering navigation.
 * pushState is the only jsdom-safe way to control pathname.
 */
const navigateTo = (path) => window.history.pushState({}, "", path);

/**
 * Advance fake timers by ms then drain the microtask queue so that any
 * async work inside the setTimeout callback has fully resolved/rejected.
 * REQUIRES: jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
 */
const advanceAndFlush = async (ms) => {
  jest.advanceTimersByTime(ms);
  await new Promise((resolve) => process.nextTick(resolve));
};

const createMockAxiosInstance = (
  defaultResponse = { data: "retried" },
  refreshResponse = { status: 200 },
) => {
  const instance = jest.fn().mockResolvedValue(defaultResponse);
  instance.post = jest.fn().mockResolvedValue(refreshResponse);
  return instance;
};

module.exports = {
  MOCK_API_ENDPOINTS,
  makeError,
  navigateTo,
  advanceAndFlush,
  createMockAxiosInstance,
};