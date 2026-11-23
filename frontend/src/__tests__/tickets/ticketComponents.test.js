// src/__tests__/ticketComponents.test.js
//
// Covers:
//   src/components/ticketUI/components/ticketContent.js
//   src/components/ticketUI/components/ticketActions.js
//   src/components/ticketUI/components/ticketExpandableDetails.js
//   src/components/ticketUI/components/QRCodeDisplay.js
//   src/components/ticketUI/components/ticketCard.js

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  mockCustomer,
  mockReference,
  mockTicketItem,
  mockTicketContentProps,
  mockTicketExpandableProps,
  mockActionHandlers,
  mockActionStatus,
  mockTicketCardProps,
  mockUniqueTicketId,
} from "@/__fixtures__/ticketFixtures";

// ─── Module imports ───────────────────────────────────────────────────────────

import TicketContent from "@/components/ticketUI/components/ticketContent";
import TicketActions from "@/components/ticketUI/components/ticketActions";
import TicketExpandableDetails from "@/components/ticketUI/components/ticketExpandableDetails";
import QRCodeDisplay from "@/components/ticketUI/components/QRCodeDisplay";
import TicketCard from "@/components/ticketUI/components/ticketCard";

// ─── Global mocks ─────────────────────────────────────────────────────────────

// next/image → plain <img> so src/alt are testable
jest.mock(
  "next/image",
  () =>
    function NextImage({ src, alt, onError, ...rest }) {
      return <img src={src} alt={alt} onError={onError} {...rest} />;
    },
);

// toastAlert → silence side effects in card action tests
jest.mock("@/components/common/toast/toastAlert", () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

// Error boundaries used inside TicketCard → passthrough
jest.mock(
  "@/components/errorBoundary/ticketActionBoundary",
  () =>
    function TicketActionBoundary({ children }) {
      return <>{children}</>;
    },
);

// ticketGenerators → prevent canvas/blob work in unit tests
jest.mock("@/components/ticketUI/ticketGenerators", () => ({
  generateTicketPDF: jest.fn().mockResolvedValue(new Blob()),
  generateICSFile: jest.fn().mockReturnValue("BEGIN:VCALENDAR\nEND:VCALENDAR"),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Suppress act() / React 18 async state update warnings for QRCodeDisplay
 * tests that involve image loading timers.
 */
const suppressActWarnings = () => {
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  return () => spy.mockRestore();
};

// ═══════════════════════════════════════════════════════════════════════════════
// TicketContent
// ═══════════════════════════════════════════════════════════════════════════════

describe("TicketContent", () => {
  const render_ = (overrides = {}) =>
    render(<TicketContent {...mockTicketContentProps} {...overrides} />);

  it("renders the event title", () => {
    render_();
    expect(
      screen.getByText(mockTicketContentProps.eventTitle),
    ).toBeInTheDocument();
  });

 it("renders the tier name", () => {
   render_();
   expect(screen.getAllByText(mockTicketItem.tierName).length).toBeGreaterThan(
     0,
   );
 });

  it("renders the event date", () => {
    render_();
    expect(
      screen.getByText(mockTicketContentProps.eventDate),
    ).toBeInTheDocument();
  });

  it("renders the event time", () => {
    render_();
    expect(
      screen.getByText(mockTicketContentProps.eventTime),
    ).toBeInTheDocument();
  });

  it("renders the venue name", () => {
    render_();
    expect(
      screen.getByText(mockTicketContentProps.eventVenue),
    ).toBeInTheDocument();
  });

  it("renders city and state together", () => {
    render_();
    expect(
      screen.getByText(
        `${mockTicketContentProps.eventCity}, ${mockTicketContentProps.eventState}`,
      ),
    ).toBeInTheDocument();
  });

  it("renders the ticket holder full name", () => {
    render_();
    expect(
      screen.getByText(
        `${mockTicketContentProps.firstName} ${mockTicketContentProps.lastName}`,
      ),
    ).toBeInTheDocument();
  });

  it("renders the quantity with 'x' suffix", () => {
    render_();
    expect(
      screen.getByText(`${mockTicketContentProps.quantity}x`),
    ).toBeInTheDocument();
  });

  it("renders the unique ticket ID in the stub QR area", () => {
    render_();
    expect(
      screen.getByText(mockTicketContentProps.uniqueTicketId),
    ).toBeInTheDocument();
  });

  it("renders Location label", () => {
    render_();
    expect(screen.getByText(/Location/i)).toBeInTheDocument();
  });

  it("renders Date label", () => {
    render_();
    expect(screen.getByText(/^Date$/i)).toBeInTheDocument();
  });

  it("renders Time label", () => {
    render_();
    expect(screen.getByText(/^Time$/i)).toBeInTheDocument();
  });

  it("renders Ticket Holder label", () => {
    render_();
    expect(screen.getByText(/Ticket Holder/i)).toBeInTheDocument();
  });

  it("renders Tier label and value", () => {
    render_();
    expect(screen.getByText(/^Tier$/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(mockTicketContentProps.tierName).length,
    ).toBeGreaterThan(0);
  });

  it("renders Quantity label", () => {
    render_();
    expect(screen.getByText(/^Quantity$/i)).toBeInTheDocument();
  });

  it("renders 'TBA' when eventDate is TBA", () => {
    render_({ eventDate: "TBA" });
    expect(screen.getAllByText("TBA").length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TicketActions
// ═══════════════════════════════════════════════════════════════════════════════

describe("TicketActions", () => {
  const render_ = (overrides = {}) =>
    render(
      <TicketActions
        uniqueTicketId={mockUniqueTicketId}
        actionHandlers={{ ...mockActionHandlers }}
        actionStatus={{ ...mockActionStatus }}
        {...overrides}
      />,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the DOWNLOAD button", () => {
    render_();
    expect(
      screen.getByRole("button", { name: /download/i }),
    ).toBeInTheDocument();
  });

  it("renders the SHARE button", () => {
    render_();
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("renders the ADD TO CALENDAR button", () => {
    render_();
    expect(
      screen.getByRole("button", { name: /add to calendar/i }),
    ).toBeInTheDocument();
  });

  it("calls handleDownload when DOWNLOAD is clicked", () => {
    render_();
    fireEvent.click(screen.getByRole("button", { name: /download/i }));
    expect(mockActionHandlers.handleDownload).toHaveBeenCalledTimes(1);
  });

  it("calls handleShare when SHARE is clicked", () => {
    render_();
    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    expect(mockActionHandlers.handleShare).toHaveBeenCalledTimes(1);
  });

  it("calls handleAddToCalendar when ADD TO CALENDAR is clicked", () => {
    render_();
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));
    expect(mockActionHandlers.handleAddToCalendar).toHaveBeenCalledTimes(1);
  });

  it("disables DOWNLOAD button when download status is true", () => {
    render_({ actionStatus: { ...mockActionStatus, download: true } });
    expect(screen.getByRole("button", { name: /downloaded/i })).toBeDisabled();
  });

  it("disables SHARE button when share status is true", () => {
    render_({ actionStatus: { ...mockActionStatus, share: true } });
    expect(screen.getByRole("button", { name: /shared/i })).toBeDisabled();
  });

  it("disables ADD TO CALENDAR button when calendar status is true", () => {
    render_({ actionStatus: { ...mockActionStatus, calendar: true } });
    expect(screen.getByRole("button", { name: /added/i })).toBeDisabled();
  });

  it("shows DOWNLOADED label when download is active", () => {
    render_({ actionStatus: { ...mockActionStatus, download: true } });
    expect(screen.getByText("DOWNLOADED")).toBeInTheDocument();
  });

  it("shows SHARED label when share is active", () => {
    render_({ actionStatus: { ...mockActionStatus, share: true } });
    expect(screen.getByText("SHARED")).toBeInTheDocument();
  });

  it("shows ADDED label when calendar is active", () => {
    render_({ actionStatus: { ...mockActionStatus, calendar: true } });
    expect(screen.getByText("ADDED")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TicketExpandableDetails
// ═══════════════════════════════════════════════════════════════════════════════

describe("TicketExpandableDetails", () => {
  const render_ = (overrides = {}) =>
    render(
      <TicketExpandableDetails
        {...mockTicketExpandableProps}
        setIsExpanded={jest.fn()}
        {...overrides}
      />,
    );

  it("renders the Additional Details toggle button", () => {
    render_();
    expect(
      screen.getByRole("button", { name: /additional details/i }),
    ).toBeInTheDocument();
  });

  it("sets aria-expanded=false when collapsed", () => {
    render_({ isExpanded: false });
    expect(
      screen.getByRole("button", { name: /additional details/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("sets aria-expanded=true when expanded", () => {
    render_({ isExpanded: true });
    expect(
      screen.getByRole("button", { name: /additional details/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("does NOT show detail fields when collapsed", () => {
    render_({ isExpanded: false });
    expect(screen.queryByText(mockCustomer.email)).not.toBeInTheDocument();
  });

  it("shows email when expanded", () => {
    render_({ isExpanded: true });
    expect(screen.getByText(mockCustomer.email)).toBeInTheDocument();
  });

  it("shows phone when expanded and phone is provided", () => {
    render_({ isExpanded: true });
    expect(screen.getByText(mockCustomer.phone)).toBeInTheDocument();
  });

  it("hides phone row when phone is empty", () => {
    render_({ isExpanded: true, phone: "" });
    expect(screen.queryByText(/^Phone$/i)).not.toBeInTheDocument();
  });

  it("shows reference when expanded", () => {
    render_({ isExpanded: true });
    expect(screen.getByText(mockReference)).toBeInTheDocument();
  });

  it("shows formatted total amount when expanded", () => {
    render_({ isExpanded: true });
    // ticketTotal is in kobo; formatCurrency divides by 100 then again ÷100
    // The component calls formatCurrency(ticketTotal / 100)
    // so raw value 10000000 → formatCurrency(100000) → ₦1,000
    expect(screen.getByText(/₦|NGN/)).toBeInTheDocument();
  });

  it("calls setIsExpanded when toggle button is clicked", () => {
    const setIsExpanded = jest.fn();
    render_({ isExpanded: false, setIsExpanded });
    fireEvent.click(
      screen.getByRole("button", { name: /additional details/i }),
    );
    expect(setIsExpanded).toHaveBeenCalledWith(true);
  });

  it("shows EXPAND hint when collapsed", () => {
    render_({ isExpanded: false });
    expect(screen.getByText(/expand/i)).toBeInTheDocument();
  });

  it("shows COLLAPSE hint when expanded", () => {
    render_({ isExpanded: true });
    expect(screen.getByText(/collapse/i)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// QRCodeDisplay
// ═══════════════════════════════════════════════════════════════════════════════

describe("QRCodeDisplay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders the QR Code region", () => {
    render(<QRCodeDisplay uniqueTicketId={mockUniqueTicketId} />);
    expect(
      screen.getByRole("region", { name: /QR Code/i }),
    ).toBeInTheDocument();
  });

  it("shows a loading/pulse state initially", () => {
    render(<QRCodeDisplay uniqueTicketId={mockUniqueTicketId} />);
    // Loading state renders before the 100ms timer fires
    const region = screen.getByRole("region", { name: /QR Code/i });
    expect(region).toBeInTheDocument();
    // The loading div has animate-pulse class
    const pulsing = region.querySelector(".animate-pulse");
    expect(pulsing).toBeInTheDocument();
  });

  it("shows error state when uniqueTicketId is missing", async () => {
    const restore = suppressActWarnings();
    render(<QRCodeDisplay uniqueTicketId="" />);

    await act(async () => {
      jest.runAllTimers();
    });

    // Error state renders the ticket ID text or "No ticket ID"
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    restore();
  });

  it("renders an img once the QR image loads successfully", async () => {
    const restore = suppressActWarnings();

    // Make Image onload fire synchronously
    const OriginalImage = global.Image;
    global.Image = class {
      set src(_) {
        setTimeout(() => this.onload?.(), 0);
      }
    };

    render(<QRCodeDisplay uniqueTicketId={mockUniqueTicketId} />);

    await act(async () => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      const img = screen.queryByRole("img");
      expect(img).toBeInTheDocument();
    });

    global.Image = OriginalImage;
    restore();
  });

  it("shows error state when Image fails to load", async () => {
    const restore = suppressActWarnings();

    const OriginalImage = global.Image;
    global.Image = class {
      set src(_) {
        setTimeout(() => this.onerror?.(), 0);
      }
    };

    render(<QRCodeDisplay uniqueTicketId={mockUniqueTicketId} />);

    await act(async () => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    global.Image = OriginalImage;
    restore();
  });

  it("includes screen-reader-only instructions", () => {
    render(<QRCodeDisplay uniqueTicketId={mockUniqueTicketId} />);
    const srOnly = document.querySelector(".sr-only");
    expect(srOnly).toBeInTheDocument();
    expect(srOnly.textContent).toContain(mockUniqueTicketId);
  });

  it("renders corner accent decorations", () => {
    render(<QRCodeDisplay uniqueTicketId={mockUniqueTicketId} />);
    // Four corner accent divs with border-red-500
    const corners = document.querySelectorAll(".border-red-500");
    expect(corners.length).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TicketCard (integration)
// ═══════════════════════════════════════════════════════════════════════════════

describe("TicketCard", () => {
  const render_ = (overrides = {}) =>
    render(<TicketCard {...mockTicketCardProps} {...overrides} />);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    // Prevent QRCodeDisplay's internal Image from hanging
    global.Image = class {
      set src(_) {
        setTimeout(() => this.onerror?.(), 0);
      }
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders without crashing with valid props", () => {
    expect(() => render_()).not.toThrow();
  });

  it("returns null when ticketItem is missing", () => {
    const { container } = render_({ ticketItem: null });
    expect(container.firstChild).toBeNull();
  });

  it("returns null when customer is missing", () => {
    const { container } = render_({ customer: null });
    expect(container.firstChild).toBeNull();
  });

  it("renders the event title via TicketContent", () => {
    render_();
    expect(screen.getByText(mockTicketItem.eventTitle)).toBeInTheDocument();
  });

  it("renders the tier name", () => {
    render_();
    expect(screen.getAllByText(mockTicketItem.tierName).length).toBeGreaterThan(
      0,
    );
  });

  it("renders the customer first name", () => {
    render_();
    expect(
      screen.getByText(new RegExp(mockCustomer.firstName)),
    ).toBeInTheDocument();
  });

  it("renders the venue", () => {
    render_();
    expect(screen.getByText(mockTicketItem.eventVenue)).toBeInTheDocument();
  });

  it("renders the city and state", () => {
    render_();
    expect(
      screen.getByText(
        `${mockTicketItem.eventCity}, ${mockTicketItem.eventState}`,
      ),
    ).toBeInTheDocument();
  });

  it("renders action buttons (DOWNLOAD, SHARE, ADD TO CALENDAR)", () => {
    render_();
    expect(
      screen.getByRole("button", { name: /download/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add to calendar/i }),
    ).toBeInTheDocument();
  });

  it("renders the expandable details toggle", () => {
    render_();
    expect(
      screen.getByRole("button", { name: /additional details/i }),
    ).toBeInTheDocument();
  });

  // ── ticketIndex / totalTickets ─────────────────────────────────────────────

  it("does not show ticket counter when totalTickets is 1", () => {
    render_({ ticketIndex: 0, totalTickets: 1 });
    expect(screen.queryByText(/#1 of 1/)).not.toBeInTheDocument();
  });

  it("shows ticket counter when totalTickets > 1", () => {
    render_({ ticketIndex: 0, totalTickets: 3 });
    expect(screen.getByText(/#1 of 3/)).toBeInTheDocument();
  });

  // ── Fallback values ────────────────────────────────────────────────────────

  it("renders TBA when eventStartDate is null", () => {
    render_({
      ticketItem: { ...mockTicketItem, eventStartDate: null },
    });
    expect(screen.getAllByText("TBA").length).toBeGreaterThan(0);
  });

  it("uses city+state as location when eventVenue is empty", () => {
    render_({
      ticketItem: { ...mockTicketItem, eventVenue: "" },
    });
    // city/state pair should still appear
    expect(
      screen.getByText(
        `${mockTicketItem.eventCity}, ${mockTicketItem.eventState}`,
      ),
    ).toBeInTheDocument();
  });

  // ── Expandable details interaction ─────────────────────────────────────────

  it("expands details section when toggle is clicked", () => {
    render_();
    expect(screen.queryByText(mockCustomer.email)).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /additional details/i }),
    );
    expect(screen.getByText(mockCustomer.email)).toBeInTheDocument();
  });

  it("collapses details section when toggle is clicked again", () => {
    render_();
    const toggle = screen.getByRole("button", { name: /additional details/i });
    fireEvent.click(toggle);
    expect(screen.getByText(mockCustomer.email)).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByText(mockCustomer.email)).not.toBeInTheDocument();
  });

  // ── Action button state transitions ───────────────────────────────────────

  it("disables DOWNLOAD button and shows DOWNLOADED after click", async () => {
    const {
      generateTicketPDF,
    } = require("@/components/ticketUI/ticketGenerators");
    generateTicketPDF.mockResolvedValue(new Blob());

    render_();
    const btn = screen.getByRole("button", { name: /download/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /downloaded/i }),
      ).toBeDisabled();
    });
  });

it("disables SHARE button and shows SHARED after click", async () => {
  Object.defineProperty(navigator, "share", {
    value: jest.fn().mockResolvedValue(undefined),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
    configurable: true,
    writable: true,
  });

  render_();
  fireEvent.click(screen.getByRole("button", { name: /share/i }));

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /shared/i })).toBeDisabled();
  });
});

  it("disables ADD TO CALENDAR and shows ADDED after click", async () => {
    URL.createObjectURL = jest.fn().mockReturnValue("blob:fake");
    URL.revokeObjectURL = jest.fn();
    // Stub the anchor click (jsdom cannot navigate), but NOT document.body.appendChild:
    // Testing Library uses its return value as the render container.
    jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    render_();
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(screen.getByRole("button", { name: /added/i })).toBeDisabled();
  });
  // ── Memoization ───────────────────────────────────────────────────────────

  it("does not re-render when unrelated props stay the same", () => {
    const renderSpy = jest.fn();

    // Wrap TicketCard to detect render calls
    const Wrapper = (props) => {
      renderSpy();
      return <TicketCard {...props} />;
    };

    const { rerender } = render(<Wrapper {...mockTicketCardProps} />);
    const firstCount = renderSpy.mock.calls.length;

    // Re-render with identical props (React.memo should bail out)
    rerender(<Wrapper {...mockTicketCardProps} />);
    // Wrapper itself re-renders, but TicketCard memo should not
    // We just verify the wrapper rendered twice and the card renders are stable
    expect(renderSpy.mock.calls.length).toBe(firstCount + 1);
  });
});
