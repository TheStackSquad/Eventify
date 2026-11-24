// src/__tests__/ticketUtils.test.js
//
// Covers:
//   src/components/ticketUI/ticketUtils.js
//     - formatCurrency
//     - saveTicketDataLocally
//     - downloadTicket
//     - shareTicket
//   src/components/ticketUI/ticketGenerators.js
//     - generateICSFile
//     - generateTicketPDF
//     - generateTextTicket

import {
  mockCustomer,
  mockReference,
  mockICSInput,
  mockPDFInput,
  mockTextTicketInput,
  mockLegacyOrderData,
} from "@/__fixtures__/ticketFixtures";

// ─── Module imports ───────────────────────────────────────────────────────────

import {
  formatCurrency,
  saveTicketDataLocally,
  downloadTicket,
  shareTicket,
} from "@/components/ticketUI/ticketUtils";

import {
  generateICSFile,
  generateTicketPDF,
  generateTextTicket,
} from "@/components/ticketUI/ticketGenerators";

// ─── Shared DOM helpers ───────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// formatCurrency
// ═══════════════════════════════════════════════════════════════════════════════

describe("formatCurrency", () => {
  it("formats a typical kobo amount to NGN naira string", () => {
    // 10,000,000 kobo ÷ 100 = ₦100,000
    // formatCurrency receives kobo, divides by 100 internally
    const result = formatCurrency(10000000);
    expect(result).toMatch(/₦/);
    expect(result).toMatch(/100,000/);
  });

  it("formats zero kobo as ₦0", () => {
    const result = formatCurrency(0);
    expect(result).toMatch(/₦/);
    expect(result).toMatch(/0/);
  });

  it("formats small amounts correctly", () => {
    // 150000 kobo = ₦1,500
    const result = formatCurrency(150000);
    expect(result).toMatch(/1,500/);
  });

  it("returns a string (not a number)", () => {
    expect(typeof formatCurrency(5000000)).toBe("string");
  });

  it("uses NGN currency symbol", () => {
    const result = formatCurrency(1000);
    // Intl.NumberFormat with currency: NGN outputs ₦ or NGN depending on locale
    expect(result).toMatch(/₦|NGN/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// saveTicketDataLocally
// ═══════════════════════════════════════════════════════════════════════════════

describe("saveTicketDataLocally", () => {
  const mockOrderData = { items: [], reference: mockReference };

  beforeEach(() => {
    localStorage.clear();
    jest.spyOn(Storage.prototype, "setItem");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("saves order data to localStorage under ticket_{reference} key", () => {
    const result = saveTicketDataLocally(mockReference, mockOrderData);

    expect(result).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      `ticket_${mockReference}`,
      JSON.stringify(mockOrderData),
    );
  });

  it("returns false when reference is falsy", () => {
    expect(saveTicketDataLocally("", mockOrderData)).toBe(false);
    expect(saveTicketDataLocally(null, mockOrderData)).toBe(false);
    expect(saveTicketDataLocally(undefined, mockOrderData)).toBe(false);
  });

  it("returns false when orderData is falsy", () => {
    expect(saveTicketDataLocally(mockReference, null)).toBe(false);
    expect(saveTicketDataLocally(mockReference, undefined)).toBe(false);
  });

  it("returns false when localStorage.setItem throws", () => {
    localStorage.setItem.mockImplementationOnce(() => {
      throw new Error("QuotaExceededError");
    });

    const result = saveTicketDataLocally(mockReference, mockOrderData);
    expect(result).toBe(false);
  });

  it("returns false when both reference and orderData are missing", () => {
    expect(saveTicketDataLocally()).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// downloadTicket
// ═══════════════════════════════════════════════════════════════════════════════

describe("downloadTicket", () => {
  let createObjectURL;
  let revokeObjectURL;
  let appendChildSpy;
  let removeChildSpy;
  let clickSpy;

  beforeEach(() => {
    createObjectURL = jest
      .fn()
      .mockReturnValue("blob:http://localhost/fake-url");
    revokeObjectURL = jest.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    clickSpy = jest.fn();

    // Intercept anchor creation to capture the click spy
    const originalCreate = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        const el = originalCreate("a");
        el.click = clickSpy;
        return el;
      }
      return originalCreate(tag);
    });

    appendChildSpy = jest
      .spyOn(document.body, "appendChild")
      .mockImplementation(() => {});
    removeChildSpy = jest
      .spyOn(document.body, "removeChild")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns false when orderData is falsy", () => {
    expect(downloadTicket(null)).toBe(false);
    expect(downloadTicket(undefined)).toBe(false);
  });

  it("creates a text blob and triggers a download link click", () => {
    const result = downloadTicket(mockLegacyOrderData);

    expect(result).toBe(true);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("appends and removes the anchor from the DOM", () => {
    downloadTicket(mockLegacyOrderData);

    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
  });

  it("revokes the object URL after download", () => {
    downloadTicket(mockLegacyOrderData);

    expect(revokeObjectURL).toHaveBeenCalledWith(
      "blob:http://localhost/fake-url",
    );
  });

  it("sets the download filename using the reference", () => {
    // beforeEach already spies on createElement — re-spying causes infinite
    // recursion. Restore first so we can capture the real anchor element.
    jest.restoreAllMocks();

    const realCreate = document.createElement.bind(document);
    let capturedAnchor = null;

    jest.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = realCreate(tag);
      if (tag === "a") {
        capturedAnchor = el;
        el.click = jest.fn();
      }
      return el;
    });

    URL.createObjectURL = jest
      .fn()
      .mockReturnValue("blob:http://localhost/fake-url");
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(document.body, "appendChild").mockImplementation(() => {});
    jest.spyOn(document.body, "removeChild").mockImplementation(() => {});

    downloadTicket(mockLegacyOrderData);

    expect(capturedAnchor?.download).toContain(mockReference);
  });

  it("includes the event title and customer name in the text blob content", () => {
    let capturedBlob = null;
    URL.createObjectURL = jest.fn((blob) => {
      capturedBlob = blob;
      return "blob:http://localhost/fake-url";
    });

    downloadTicket(mockLegacyOrderData);

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        expect(text).toContain(mockLegacyOrderData.items[0].event_title);
        expect(text).toContain(mockLegacyOrderData.customer.first_name);
        expect(text).toContain(mockLegacyOrderData.reference);
        resolve();
      };
      reader.readAsText(capturedBlob);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// shareTicket
// ═══════════════════════════════════════════════════════════════════════════════

describe("shareTicket", () => {
  const originalWindow = global.window;

  afterEach(() => {
    jest.restoreAllMocks();
    // Restore navigator.share if we deleted it
    if (!("share" in navigator)) {
      Object.defineProperty(navigator, "share", {
        value: undefined,
        configurable: true,
        writable: true,
      });
    }
  });

  it("returns false when orderData is falsy", async () => {
    expect(await shareTicket(null)).toBe(false);
    expect(await shareTicket(undefined)).toBe(false);
  });

  it("uses Web Share API when navigator.share is available", async () => {
    const shareMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      configurable: true,
      writable: true,
    });

    const result = await shareTicket(mockLegacyOrderData);

    expect(shareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("Ticket"),
        url: expect.any(String),
      }),
    );
    expect(result).toBe(true);
  });

  it("falls back to clipboard when Web Share API is unavailable", async () => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    // jsdom does not implement execCommand — define it before spying
    document.execCommand = jest.fn().mockReturnValue(true);

    const appendSpy = jest
      .spyOn(document.body, "appendChild")
      .mockImplementation(() => {});
    const removeSpy = jest
      .spyOn(document.body, "removeChild")
      .mockImplementation(() => {});

    const result = await shareTicket(mockLegacyOrderData);

    expect(result).toBe("copied");
    appendSpy.mockRestore();
    removeSpy.mockRestore();
    delete document.execCommand;
  });

  it("returns false when Web Share API throws (non-AbortError)", async () => {
    const shareMock = jest
      .fn()
      .mockRejectedValue(new Error("Share not supported"));
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      configurable: true,
      writable: true,
    });

    const result = await shareTicket(mockLegacyOrderData);
    expect(result).toBe(false);
  });

  it("returns false when AbortError is thrown (user cancelled)", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    const shareMock = jest.fn().mockRejectedValue(abortError);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      configurable: true,
      writable: true,
    });

    const result = await shareTicket(mockLegacyOrderData);
    expect(result).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateICSFile
// ═══════════════════════════════════════════════════════════════════════════════

describe("generateICSFile", () => {
  it("returns a string", () => {
    expect(typeof generateICSFile(mockICSInput)).toBe("string");
  });

  it("starts with BEGIN:VCALENDAR and ends with END:VCALENDAR", () => {
    const output = generateICSFile(mockICSInput);
    expect(output.trim()).toMatch(/^BEGIN:VCALENDAR/);
    expect(output.trim()).toMatch(/END:VCALENDAR$/);
  });

  it("contains a VEVENT block", () => {
    const output = generateICSFile(mockICSInput);
    expect(output).toContain("BEGIN:VEVENT");
    expect(output).toContain("END:VEVENT");
  });

  it("includes the event title in the SUMMARY field", () => {
    const output = generateICSFile(mockICSInput);
    expect(output).toContain(`SUMMARY:${mockICSInput.eventTitle}`);
  });

  it("includes the tier name in SUMMARY", () => {
    const output = generateICSFile(mockICSInput);
    expect(output).toContain(mockICSInput.tierName);
  });

  it("includes the reference in the UID", () => {
    const output = generateICSFile(mockICSInput);
    expect(output).toContain(mockICSInput.reference);
  });

  it("includes the location", () => {
    const output = generateICSFile(mockICSInput);
    expect(output).toContain(`LOCATION:${mockICSInput.location}`);
  });

  it("formats DTSTART in UTC compact format (no dashes or colons)", () => {
    const output = generateICSFile(mockICSInput);
    // e.g. DTSTART:20241215T180000Z
    expect(output).toMatch(/DTSTART:\d{8}T\d{6}Z/);
  });

  it("formats DTEND in UTC compact format", () => {
    const output = generateICSFile(mockICSInput);
    expect(output).toMatch(/DTEND:\d{8}T\d{6}Z/);
  });

  it("contains a VALARM block for reminders", () => {
    const output = generateICSFile(mockICSInput);
    expect(output).toContain("BEGIN:VALARM");
    expect(output).toContain("END:VALARM");
  });

  it("includes STATUS:CONFIRMED", () => {
    const output = generateICSFile(mockICSInput);
    expect(output).toContain("STATUS:CONFIRMED");
  });

  it("includes the reference in the DESCRIPTION", () => {
    const output = generateICSFile(mockICSInput);
    expect(output).toContain(mockICSInput.reference);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateTicketPDF
// ═══════════════════════════════════════════════════════════════════════════════

describe("generateTicketPDF", () => {
  let createObjectURL;
  let revokeObjectURL;
  let clickSpy;
  let originalGetContext;
  let originalToBlob;

  beforeEach(() => {
    // Mock canvas methods on the prototype — avoids any createElement spy conflicts
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    originalToBlob = HTMLCanvasElement.prototype.toBlob;

    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
      fillRect: jest.fn(),
      fillText: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      fillStyle: "",
      font: "",
    }));

    HTMLCanvasElement.prototype.toBlob = jest.fn((cb) =>
      cb(new Blob(["png"], { type: "image/png" })),
    );

    createObjectURL = jest
      .fn()
      .mockReturnValue("blob:http://localhost/pdf-fake");
    revokeObjectURL = jest.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    clickSpy = jest.fn();

    // Single createElement spy — no recursion risk
    const realCreate = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = realCreate(tag);
      if (tag === "a") el.click = clickSpy;
      return el;
    });

    jest.spyOn(document.body, "appendChild").mockImplementation(() => {});
    jest.spyOn(document.body, "removeChild").mockImplementation(() => {});
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
    jest.restoreAllMocks();
  });

  it("resolves with a Blob", async () => {
    const result = await generateTicketPDF(mockPDFInput);
    expect(result).toBeInstanceOf(Blob);
  });

  it("triggers an anchor click to initiate download", async () => {
    await generateTicketPDF(mockPDFInput);
    expect(clickSpy).toHaveBeenCalled();
  });

  it("creates an object URL from the blob", async () => {
    await generateTicketPDF(mockPDFInput);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it("revokes the object URL after download", async () => {
    await generateTicketPDF(mockPDFInput);
    expect(revokeObjectURL).toHaveBeenCalledWith(
      "blob:http://localhost/pdf-fake",
    );
  });

  it("sets download filename containing the event title and reference", async () => {
    // Restore the beforeEach spy and re-spy to capture the anchor element
    jest.restoreAllMocks();

    let capturedAnchor = null;
    const realCreate = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = realCreate(tag);
      if (tag === "a") {
        capturedAnchor = el;
        el.click = jest.fn();
      }
      return el;
    });
    jest.spyOn(document.body, "appendChild").mockImplementation(() => {});
    jest.spyOn(document.body, "removeChild").mockImplementation(() => {});

    await generateTicketPDF(mockPDFInput);

    expect(capturedAnchor?.download).toContain("Lagos-Jazz-Festival");
    expect(capturedAnchor?.download).toContain(mockReference);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateTextTicket
// ═══════════════════════════════════════════════════════════════════════════════

describe("generateTextTicket", () => {
  it("returns a non-empty string", () => {
    const result = generateTextTicket(mockTextTicketInput);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes the event title", () => {
    const result = generateTextTicket(mockTextTicketInput);
    expect(result).toContain(mockTextTicketInput.eventTitle);
  });

  it("includes the tier name", () => {
    const result = generateTextTicket(mockTextTicketInput);
    expect(result).toContain(mockTextTicketInput.tierName);
  });

  it("includes the quantity", () => {
    const result = generateTextTicket(mockTextTicketInput);
    expect(result).toContain(String(mockTextTicketInput.quantity));
  });

  it("includes the customer name", () => {
    const result = generateTextTicket(mockTextTicketInput);
    expect(result).toContain(mockTextTicketInput.customer);
  });

  it("includes the customer email", () => {
    const result = generateTextTicket(mockTextTicketInput);
    expect(result).toContain(mockTextTicketInput.email);
  });

  it("includes the reference number", () => {
    const result = generateTextTicket(mockTextTicketInput);
    expect(result).toContain(mockTextTicketInput.reference);
  });

  it("includes the venue", () => {
    const result = generateTextTicket(mockTextTicketInput);
    expect(result).toContain(mockTextTicketInput.venue);
  });

  it("includes the total amount", () => {
    const result = generateTextTicket(mockTextTicketInput);
    expect(result).toContain(mockTextTicketInput.total);
  });

  it("contains a header and footer separator line", () => {
    const result = generateTextTicket(mockTextTicketInput);
    expect(result).toContain("═══");
  });

  it("contains the support email address", () => {
    const result = generateTextTicket(mockTextTicketInput);
    expect(result).toContain("support@eventify.com");
  });
});
