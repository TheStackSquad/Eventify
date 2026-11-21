/**
 * @file reactQueryProvider.test.jsx
 *
 * ─── WHAT THIS FILE TESTS ───────────────────────────────────────────────────
 *
 *  ReactQueryProvider is a thin wrapper that:
 *    1. Creates a stable QueryClient instance (once per mount via useState)
 *    2. Configures default query/mutation options
 *    3. Conditionally renders ReactQueryDevtools in development only
 *
 * ─── NODE_ENV SWITCHING ─────────────────────────────────────────────────────
 *
 *  next/jest freezes process.env.NODE_ENV — Object.defineProperty silently
 *  fails. jest.replaceProperty() (Jest 29+) is the correct approach and is
 *  restored automatically after each test via afterEach.
 *
 * ─── DEVTOOLS MOCK ──────────────────────────────────────────────────────────
 *
 *  ReactQueryDevtools is a heavy devtools bundle that has no behaviour to
 *  assert on in unit tests. It is mocked to a lightweight sentinel so we can
 *  assert presence/absence without importing the real bundle.
 *
 * ─── QUERYCLIENT INSPECTION ─────────────────────────────────────────────────
 *
 *  We extract the live QueryClient from the rendered tree via
 *  useQueryClient() inside a consumer component. This avoids reaching into
 *  React internals and tests the actual instance the provider exposes.
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@tanstack/react-query-devtools", () => ({
  ReactQueryDevtools: () => <div data-testid="rq-devtools" />,
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import React, { useRef } from "react";
import { render, screen } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import ReactQueryProvider from "@/provider/reactQueryProvider";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Renders ReactQueryProvider with the given children.
 * Returns the container for further assertions.
 */
const renderProvider = (children = <div data-testid="child">hello</div>) =>
  render(<ReactQueryProvider>{children}</ReactQueryProvider>);

/**
 * Consumer that captures the live QueryClient instance exposed by the provider.
 * Stores it in a ref so we can read it after render without causing re-renders.
 */
const QueryClientCapture = ({ captureRef }) => {
  const client = useQueryClient();
  captureRef.current = client;
  return null;
};

/** Render the provider and return the live QueryClient instance it exposes. */
const getQueryClient = () => {
  const captureRef = { current: null };
  render(
    <ReactQueryProvider>
      <QueryClientCapture captureRef={captureRef} />
    </ReactQueryProvider>,
  );
  return captureRef.current;
};

// ─── Suite ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// Rendering
// ══════════════════════════════════════════════════════════════════════════════

describe("ReactQueryProvider — rendering", () => {
  it("renders without crashing", () => {
    expect(() => renderProvider()).not.toThrow();
  });

  it("renders children", () => {
    renderProvider(<span data-testid="child-node">content</span>);
    expect(screen.getByTestId("child-node")).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    renderProvider(
      <>
        <div data-testid="child-a">a</div>
        <div data-testid="child-b">b</div>
      </>,
    );
    expect(screen.getByTestId("child-a")).toBeInTheDocument();
    expect(screen.getByTestId("child-b")).toBeInTheDocument();
  });

  it("exposes a QueryClient to consumers via useQueryClient", () => {
    const client = getQueryClient();
    expect(client).not.toBeNull();
    expect(typeof client.getQueryData).toBe("function");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// QueryClient stability
// ══════════════════════════════════════════════════════════════════════════════

describe("ReactQueryProvider — QueryClient stability", () => {
  it("provides the same QueryClient instance across re-renders", () => {
    const captureRef = { current: null };

    const { rerender } = render(
      <ReactQueryProvider>
        <QueryClientCapture captureRef={captureRef} />
      </ReactQueryProvider>,
    );

    const firstInstance = captureRef.current;

    rerender(
      <ReactQueryProvider>
        <QueryClientCapture captureRef={captureRef} />
      </ReactQueryProvider>,
    );

    const secondInstance = captureRef.current;

    // useState initializer runs only once — same reference expected
    expect(secondInstance).toBe(firstInstance);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// QueryClient default options
// ══════════════════════════════════════════════════════════════════════════════

describe("ReactQueryProvider — QueryClient default query options", () => {
  let client;

  beforeEach(() => {
    client = getQueryClient();
  });

  it("sets staleTime to 5 minutes", () => {
    const { staleTime } = client.getDefaultOptions().queries;
    expect(staleTime).toBe(5 * 60 * 1000);
  });

  it("sets gcTime to 10 minutes", () => {
    const { gcTime } = client.getDefaultOptions().queries;
    expect(gcTime).toBe(10 * 60 * 1000);
  });

  it("sets retry to 1", () => {
    const { retry } = client.getDefaultOptions().queries;
    expect(retry).toBe(1);
  });

  it("disables refetchOnWindowFocus", () => {
    const { refetchOnWindowFocus } = client.getDefaultOptions().queries;
    expect(refetchOnWindowFocus).toBe(false);
  });

  it("enables refetchOnReconnect", () => {
    const { refetchOnReconnect } = client.getDefaultOptions().queries;
    expect(refetchOnReconnect).toBe(true);
  });

  it("disables refetchOnMount", () => {
    const { refetchOnMount } = client.getDefaultOptions().queries;
    expect(refetchOnMount).toBe(false);
  });
});

describe("ReactQueryProvider — QueryClient default mutation options", () => {
  it("sets mutation retry to 1", () => {
    const client = getQueryClient();
    const { retry } = client.getDefaultOptions().mutations;
    expect(retry).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ReactQueryDevtools — conditional rendering
// ══════════════════════════════════════════════════════════════════════════════

describe("ReactQueryProvider — ReactQueryDevtools visibility", () => {
  it("renders DevTools in development", () => {
    jest.replaceProperty(process.env, "NODE_ENV", "development");
    renderProvider();
    expect(screen.getByTestId("rq-devtools")).toBeInTheDocument();
  });

  it("does NOT render DevTools in production", () => {
    jest.replaceProperty(process.env, "NODE_ENV", "production");
    renderProvider();
    expect(screen.queryByTestId("rq-devtools")).not.toBeInTheDocument();
  });

  it("does NOT render DevTools in test environment", () => {
    // NODE_ENV is 'test' during Jest runs — DevTools must be absent
    // jest.replaceProperty not needed here — this is the default Jest env
    renderProvider();
    expect(screen.queryByTestId("rq-devtools")).not.toBeInTheDocument();
  });
});
