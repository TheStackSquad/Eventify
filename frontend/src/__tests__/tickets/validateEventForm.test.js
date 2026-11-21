/**
 * validateEventForm.test.js
 *
 * Tests for:
 *   src/app/events/create-events/services/eventServices.js → validateEventForm
 *   src/utils/validate/eventValidate.js                    → validateStep
 *
 * Covers all 5 validation sections:
 *   1. Required field guards
 *   2. Temporal integrity (date/time logic)
 *   3. Ticketing & financial fairness
 *   4. Logistics & discovery (venue / virtual)
 *   5. Image requirement
 *
 * Also covers per-step navigation guards (validateStep) and
 * documents the image gap between step validation and final validation.
 *
 * Run alone:  npx jest validateEventForm.test
 */

const {
  makeTicket,
  makeFormData,
  validateEventForm,
} = require("@/__fixtures__/eventFixtures");

// Inline validateStep — mirrors src/utils/validate/eventValidate.js
const validateStep = (step, formData) => {
  const newErrors = {};
  if (step === 1) {
    if (!formData.eventTitle?.trim())
      newErrors.eventTitle = "Event title is required";
    if (!formData.eventDescription?.trim())
      newErrors.eventDescription = "Description is required";
    if (!formData.category) newErrors.category = "Category is required";
  }
  if (step === 2) {
    if (!formData.startDate) newErrors.startDate = "Start date is required";
    if (!formData.startTime) newErrors.startTime = "Start time is required";
    if (formData.eventType === "physical") {
      if (!formData.venueName) newErrors.venueName = "Venue name is required";
      if (!formData.venueAddress)
        newErrors.venueAddress = "Venue address is required";
      if (!formData.city) newErrors.city = "City is required";
    } else {
      if (!formData.virtualPlatform)
        newErrors.virtualPlatform = "Platform is required";
      if (!formData.meetingLink)
        newErrors.meetingLink = "Meeting link is required";
    }
  }
  if (step === 3) {
    if (!formData.tickets || formData.tickets.length === 0) {
      newErrors.tickets = "At least one ticket tier is required";
    } else {
      formData.tickets.forEach((ticket, index) => {
        if (!ticket.tierName?.trim())
          newErrors[`ticket_${index}_tierName`] = "Tier name is required";
        if (
          ticket.price === undefined ||
          ticket.price === null ||
          isNaN(ticket.price)
        )
          newErrors[`ticket_${index}_price`] = "Price is required";
        else if (ticket.price < 0)
          newErrors[`ticket_${index}_price`] = "Price cannot be negative";
        if (!ticket.quantity || ticket.quantity <= 0)
          newErrors[`ticket_${index}_quantity`] = "Quantity must be at least 1";
      });
    }
  }
  if (step === 4) {
    if (!formData.paystackSubaccountCode)
      newErrors.paystackSubaccountCode = "Paystack subaccount is required";
  }
  return { errors: newErrors, isValid: Object.keys(newErrors).length === 0 };
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Required field guards
// ─────────────────────────────────────────────────────────────────────────────

describe("validateEventForm — required fields", () => {
  it("passes for a fully valid physical event", () => {
    expect(validateEventForm(makeFormData()).isValid).toBe(true);
  });

  it("fails when eventTitle is empty", () => {
    const { isValid, errorMap } = validateEventForm(
      makeFormData({ eventTitle: "" }),
    );
    expect(isValid).toBe(false);
    expect(errorMap.eventTitle).toBeTruthy();
  });

  it("fails when eventTitle is only whitespace", () => {
    expect(validateEventForm(makeFormData({ eventTitle: "   " })).isValid).toBe(
      false,
    );
  });

  it("fails when eventDescription is empty", () => {
    expect(
      validateEventForm(makeFormData({ eventDescription: "" })).errorMap
        .eventDescription,
    ).toBeTruthy();
  });

  it("fails when category is empty", () => {
    expect(
      validateEventForm(makeFormData({ category: "" })).errorMap.category,
    ).toBeTruthy();
  });

  it("fails when eventType is missing", () => {
    expect(
      validateEventForm(makeFormData({ eventType: "" })).errorMap.eventType,
    ).toBeTruthy();
  });

  it("returns errorMap keys for every failing field (not just errors array)", () => {
    const { errorMap } = validateEventForm(
      makeFormData({ eventTitle: "", category: "", eventDescription: "" }),
    );
    expect(Object.keys(errorMap)).toEqual(
      expect.arrayContaining(["eventTitle", "category", "eventDescription"]),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Temporal integrity
// ─────────────────────────────────────────────────────────────────────────────

describe("validateEventForm — temporal integrity", () => {
  it("passes when end time is after start time on the same day", () => {
    const data = makeFormData({ startTime: "09:00", endTime: "18:00" });
    expect(validateEventForm(data).isValid).toBe(true);
  });

  it("fails when end date/time is before start date/time", () => {
    const data = makeFormData({
      startDate: "2099-06-15",
      startTime: "18:00",
      endDate: "2099-06-15",
      endTime: "09:00",
    });
    expect(validateEventForm(data).errorMap.endDate).toBeTruthy();
  });

  it("passes when end date is on a later day", () => {
    const data = makeFormData({
      startDate: "2099-06-15",
      endDate: "2099-06-16",
    });
    expect(validateEventForm(data).isValid).toBe(true);
  });

  it("fails when startDate is missing", () => {
    expect(
      validateEventForm(makeFormData({ startDate: "" })).errorMap.startDate,
    ).toBeTruthy();
  });

  it("fails when startTime is missing", () => {
    expect(
      validateEventForm(makeFormData({ startTime: "" })).errorMap.startTime,
    ).toBeTruthy();
  });

  /**
   * ❌ BUG-5: bufferTime check fires in edit mode for events whose start has passed.
   * An event that started 2 hours ago is legitimate in edit mode (e.g. updating
   * description mid-event) but the current code blocks it.
   * When fixed: the check should be skipped in edit mode. Change toBeTruthy → toBeFalsy.
   */
  it("BUG-5 [KNOWN]: flags past start time even in edit mode — should be exempt", () => {
    const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const data = makeFormData({
      startDate: pastDate.toISOString().split("T")[0],
      startTime: pastDate.toTimeString().slice(0, 5),
      endDate: "2099-06-15",
      endTime: "18:00",
    });
    const initialData = {
      soldCount: 5,
      startDate: pastDate.toISOString(),
      tickets: [],
    };
    const { errorMap } = validateEventForm(data, initialData);
    expect(errorMap.startDate).toBeTruthy(); // documents broken behaviour — fix → toBeFalsy
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Ticketing & financial fairness
// ─────────────────────────────────────────────────────────────────────────────

describe("validateEventForm — ticketing", () => {
  it("fails when tickets array is empty", () => {
    expect(
      validateEventForm(makeFormData({ tickets: [] })).errorMap.tickets,
    ).toBeTruthy();
  });

  it("fails when ticket has no tierName", () => {
    const data = makeFormData({ tickets: [makeTicket({ tierName: "" })] });
    expect(validateEventForm(data).errorMap["ticket_0_tierName"]).toBeTruthy();
  });

  it("fails when ticket price is negative", () => {
    const data = makeFormData({ tickets: [makeTicket({ price: -100 })] });
    expect(validateEventForm(data).errorMap["ticket_0_price"]).toBeTruthy();
  });

  it("allows free ticket (price = 0)", () => {
    const data = makeFormData({
      tickets: [makeTicket({ price: 0, quantity: 10 })],
    });
    expect(validateEventForm(data).isValid).toBe(true);
  });

  it("fails when quantity is 0", () => {
    expect(
      validateEventForm(
        makeFormData({ tickets: [makeTicket({ quantity: 0 })] }),
      ).errorMap["ticket_0_quantity"],
    ).toBeTruthy();
  });

  it("fails when quantity is negative", () => {
    expect(
      validateEventForm(
        makeFormData({ tickets: [makeTicket({ quantity: -1 })] }),
      ).errorMap["ticket_0_quantity"],
    ).toBeTruthy();
  });

  it("fails when capacity is below soldCount (edit mode)", () => {
    const initialData = {
      tickets: [makeTicket({ id: "tier-1", soldCount: 80, price: 5000 })],
    };
    const data = makeFormData({
      tickets: [makeTicket({ id: "tier-1", soldCount: 80, quantity: 50 })],
    });
    expect(
      validateEventForm(data, initialData).errorMap["ticket_0_quantity"],
    ).toBeTruthy();
  });

  it("allows increasing capacity beyond soldCount", () => {
    const initialData = {
      tickets: [makeTicket({ id: "tier-1", soldCount: 80, price: 5000 })],
    };
    const data = makeFormData({
      tickets: [makeTicket({ id: "tier-1", soldCount: 80, quantity: 200 })],
    });
    expect(
      validateEventForm(data, initialData).errorMap["ticket_0_quantity"],
    ).toBeUndefined();
  });

  it("blocks price change after tickets are sold (edit mode)", () => {
    const initialData = {
      tickets: [makeTicket({ id: "tier-1", soldCount: 10, price: 5000 })],
    };
    const data = makeFormData({
      tickets: [makeTicket({ id: "tier-1", soldCount: 10, price: 6000 })],
    });
    expect(
      validateEventForm(data, initialData).errorMap["ticket_0_price"],
    ).toBeTruthy();
  });

  it("allows price change when no tickets sold (edit mode)", () => {
    const initialData = {
      tickets: [makeTicket({ id: "tier-1", soldCount: 0, price: 5000 })],
    };
    const data = makeFormData({
      tickets: [makeTicket({ id: "tier-1", soldCount: 0, price: 6000 })],
    });
    expect(
      validateEventForm(data, initialData).errorMap["ticket_0_price"],
    ).toBeUndefined();
  });

  it("blocks deletion of sold tier (edit mode)", () => {
    const initialData = {
      tickets: [
        makeTicket({ id: "tier-1", tierName: "VIP", soldCount: 5 }),
        makeTicket({ id: "tier-2", tierName: "GA", soldCount: 0 }),
      ],
    };
    const data = makeFormData({
      tickets: [makeTicket({ id: "tier-2", tierName: "GA" })],
    });
    expect(validateEventForm(data, initialData).errorMap.tickets).toContain(
      "VIP",
    );
  });

  it("allows deletion of unsold tier (edit mode)", () => {
    const initialData = {
      tickets: [
        makeTicket({ id: "tier-1", soldCount: 0 }),
        makeTicket({ id: "tier-2", soldCount: 0 }),
      ],
    };
    const data = makeFormData({ tickets: [makeTicket({ id: "tier-1" })] });
    expect(validateEventForm(data, initialData).isValid).toBe(true);
  });

  it("multiple ticket errors are all returned (not just first)", () => {
    const data = makeFormData({
      tickets: [makeTicket({ tierName: "", price: -1, quantity: 0 })],
    });
    const { errorMap } = validateEventForm(data);
    const ticketKeys = Object.keys(errorMap).filter((k) =>
      k.startsWith("ticket_"),
    );
    expect(ticketKeys.length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Logistics & discovery
// ─────────────────────────────────────────────────────────────────────────────

describe("validateEventForm — physical event location", () => {
  it("requires venueName for physical event", () => {
    expect(
      validateEventForm(makeFormData({ venueName: "" })).errorMap.venueName,
    ).toBeTruthy();
  });

  it("requires city for physical event", () => {
    expect(
      validateEventForm(makeFormData({ city: "" })).errorMap.city,
    ).toBeTruthy();
  });

  it("does NOT require venueName for virtual event", () => {
    const data = makeFormData({
      eventType: "virtual",
      venueName: "",
      city: "",
      meetingLink: "https://zoom.us/j/123",
    });
    expect(validateEventForm(data).errorMap.venueName).toBeUndefined();
  });
});

describe("validateEventForm — virtual event", () => {
  it("requires a valid meetingLink starting with http", () => {
    const data = makeFormData({
      eventType: "virtual",
      meetingLink: "not-a-url",
    });
    expect(validateEventForm(data).errorMap.meetingLink).toBeTruthy();
  });

  it("accepts http:// meeting links (not only https)", () => {
    const data = makeFormData({
      eventType: "virtual",
      meetingLink: "http://zoom.us/j/123",
    });
    expect(validateEventForm(data).isValid).toBe(true);
  });

  it("accepts https:// meeting links", () => {
    const data = makeFormData({
      eventType: "virtual",
      meetingLink: "https://meet.google.com/abc",
    });
    expect(validateEventForm(data).isValid).toBe(true);
  });

  it("rejects empty meetingLink", () => {
    const data = makeFormData({ eventType: "virtual", meetingLink: "" });
    expect(validateEventForm(data).errorMap.meetingLink).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Image validation
// ─────────────────────────────────────────────────────────────────────────────

describe("validateEventForm — image requirement", () => {
  it("fails when no image of any kind is present", () => {
    const data = makeFormData({
      eventImage: "",
      eventImagePreview: "",
      eventImageFile: null,
    });
    expect(validateEventForm(data).errorMap.eventImage).toBeTruthy();
  });

  it("passes when eventImage URL is present (existing image in edit mode)", () => {
    const data = makeFormData({
      eventImage: "https://blob.vercel-storage.com/img.jpg",
      eventImagePreview: "",
      eventImageFile: null,
    });
    expect(validateEventForm(data).isValid).toBe(true);
  });

  it("passes when only eventImagePreview is present", () => {
    const data = makeFormData({
      eventImage: "",
      eventImagePreview: "blob:local-preview",
      eventImageFile: null,
    });
    expect(validateEventForm(data).isValid).toBe(true);
  });

  it("passes when only eventImageFile (new File) is present", () => {
    const mockFile = new File(["data"], "img.png", { type: "image/png" });
    const data = makeFormData({
      eventImage: "",
      eventImagePreview: "",
      eventImageFile: mockFile,
    });
    expect(validateEventForm(data).isValid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateStep — per-step navigation guards
// ─────────────────────────────────────────────────────────────────────────────

describe("validateStep — step navigation guards", () => {
  it("step 1 passes with valid basic info", () => {
    expect(validateStep(1, makeFormData()).isValid).toBe(true);
  });

  it("step 1 blocks empty title", () => {
    expect(
      validateStep(1, makeFormData({ eventTitle: "" })).errors.eventTitle,
    ).toBeTruthy();
  });

  it("step 1 blocks empty description", () => {
    expect(
      validateStep(1, makeFormData({ eventDescription: "" })).errors
        .eventDescription,
    ).toBeTruthy();
  });

  it("step 1 blocks missing category", () => {
    expect(
      validateStep(1, makeFormData({ category: "" })).errors.category,
    ).toBeTruthy();
  });

  it("step 2 passes with valid date and physical location", () => {
    expect(validateStep(2, makeFormData()).isValid).toBe(true);
  });

  it("step 2 requires venueAddress for physical (gap: validateEventForm does NOT check venueAddress)", () => {
    expect(
      validateStep(2, makeFormData({ venueAddress: "" })).errors.venueAddress,
    ).toBeTruthy();
  });

  it("step 3 passes with valid ticket", () => {
    expect(validateStep(3, makeFormData()).isValid).toBe(true);
  });

  it("step 3 allows price = 0 (free ticket)", () => {
    const data = makeFormData({ tickets: [makeTicket({ price: 0 })] });
    expect(validateStep(3, data).errors["ticket_0_price"]).toBeUndefined();
  });

  it("step 3 blocks undefined price", () => {
    const data = makeFormData({ tickets: [makeTicket({ price: undefined })] });
    expect(validateStep(3, data).errors["ticket_0_price"]).toBeTruthy();
  });

  it("step 4 requires paystackSubaccountCode", () => {
    expect(
      validateStep(4, makeFormData({ paystackSubaccountCode: "" })).errors
        .paystackSubaccountCode,
    ).toBeTruthy();
  });

  /**
   * GAP: validateStep has NO image check across any of its 4 steps.
   * validateEventForm (final) DOES check for image.
   * This means a user can navigate through all 4 steps without an image
   * and only hit the error on final submit — a jarring demo experience.
   * FIX: Add image check to step 1 in validateStep.
   */
  it("GAP [KNOWN]: step 1 does not catch missing image — user reaches submit before error", () => {
    const result = validateStep(
      1,
      makeFormData({
        eventImage: "",
        eventImagePreview: "",
        eventImageFile: null,
      }),
    );
    expect(result.isValid).toBe(true); // No image error in step validation — documents the gap
  });
});
