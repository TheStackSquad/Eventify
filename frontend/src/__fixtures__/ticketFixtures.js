// src/__fixtures__/ticketFixtures.js

// ─── Raw API response shape (mirrors response.data from ENDPOINTS.PAYMENTS.VERIFY) ───

export const mockReference = "EVT-REF-20240101-ABCDE";

export const mockCustomer = {
  firstName: "Adaeze",
  lastName: "Okonkwo",
  email: "adaeze@example.com",
  phone: "08012345678",
};

export const mockTicketItem = {
  eventId: "event-001",
  eventTitle: "Lagos Jazz Festival",
  eventStartDate: "2024-12-15T18:00:00Z",
  eventEndDate: "2024-12-15T22:00:00Z",
  eventVenue: "Eko Hotel Convention Centre",
  eventCity: "Lagos",
  eventState: "Lagos",
  tierName: "VIP",
  quantity: 2,
  unitPrice: 5000000, // kobo — ₦50,000 per ticket
};

export const mockTicketItemMinimal = {
  eventId: "event-002",
  eventTitle: "Abuja Comedy Night",
  eventStartDate: null,
  eventEndDate: null,
  eventVenue: "",
  eventCity: "Abuja",
  eventState: "FCT",
  tierName: "Regular",
  quantity: 1,
  unitPrice: 1500000,
};

export const mockOrderData = {
  status: "success",
  data: {
    reference: mockReference,
    amountPaid: 10000000, // kobo — ₦100,000
    customerEmail: mockCustomer.email,
    customerFirstName: mockCustomer.firstName,
    customerLastName: mockCustomer.lastName,
    customerPhone: mockCustomer.phone,
    items: [mockTicketItem],
  },
};

export const mockOrderDataMultiTicket = {
  status: "success",
  data: {
    reference: mockReference,
    amountPaid: 11500000,
    customerEmail: mockCustomer.email,
    customerFirstName: mockCustomer.firstName,
    customerLastName: mockCustomer.lastName,
    customerPhone: mockCustomer.phone,
    items: [mockTicketItem, mockTicketItemMinimal],
  },
};

// ─── Unique ticket ID (matches TicketCard's useMemo logic) ───────────────────

export const mockUniqueTicketId = `${mockReference}-${mockTicketItem.eventId}-1`;

// ─── Props shapes for individual components ──────────────────────────────────

export const mockTicketContentProps = {
  eventTitle: mockTicketItem.eventTitle,
  eventVenue: mockTicketItem.eventVenue,
  eventCity: mockTicketItem.eventCity,
  eventState: mockTicketItem.eventState,
  tierName: mockTicketItem.tierName,
  uniqueTicketId: mockUniqueTicketId,
  eventDate: "12/15/2024",
  eventTime: "09:00 PM",
  quantity: mockTicketItem.quantity,
  firstName: mockCustomer.firstName,
  lastName: mockCustomer.lastName,
};

export const mockTicketExpandableProps = {
  isExpanded: false,
  setIsExpanded: jest.fn(),
  firstName: mockCustomer.firstName,
  lastName: mockCustomer.lastName,
  email: mockCustomer.email,
  phone: mockCustomer.phone,
  tierName: mockTicketItem.tierName,
  quantity: mockTicketItem.quantity,
  ticketTotal: mockTicketItem.unitPrice * mockTicketItem.quantity, // kobo
  reference: mockReference,
};

export const mockActionHandlers = {
  handleDownload: jest.fn(),
  handleShare: jest.fn(),
  handleAddToCalendar: jest.fn(),
};

export const mockActionStatus = {
  download: false,
  share: false,
  calendar: false,
};

export const mockTicketCardProps = {
  ticketItem: mockTicketItem,
  customer: mockCustomer,
  reference: mockReference,
  ticketIndex: 0,
  totalTickets: 1,
};

// ─── Generator inputs ─────────────────────────────────────────────────────────

export const mockICSInput = {
  eventTitle: mockTicketItem.eventTitle,
  tierName: mockTicketItem.tierName,
  reference: mockReference,
  location: mockTicketItem.eventVenue,
  startDate: new Date("2024-12-15T18:00:00Z"),
  endDate: new Date("2024-12-15T22:00:00Z"),
};

export const mockPDFInput = {
  eventTitle: mockTicketItem.eventTitle,
  tierName: mockTicketItem.tierName,
  quantity: mockTicketItem.quantity,
  reference: mockReference,
  customer: `${mockCustomer.firstName} ${mockCustomer.lastName}`,
  email: mockCustomer.email,
  total: "₦100,000",
  eventDate: "12/15/2024",
  venue: mockTicketItem.eventVenue,
};

export const mockTextTicketInput = {
  eventTitle: mockTicketItem.eventTitle,
  tierName: mockTicketItem.tierName,
  quantity: mockTicketItem.quantity,
  reference: mockReference,
  customer: `${mockCustomer.firstName} ${mockCustomer.lastName}`,
  email: mockCustomer.email,
  total: "₦100,000",
  venue: mockTicketItem.eventVenue,
};

// ─── Legacy ticketUtils shape (used by downloadTicket / shareTicket) ──────────

export const mockLegacyOrderData = {
  reference: mockReference,
  amount_kobo: 10000000,
  created_at: "2024-01-01T10:00:00Z",
  payment_channel: "card",
  customer: {
    first_name: mockCustomer.firstName,
    last_name: mockCustomer.lastName,
    email: mockCustomer.email,
    phone: mockCustomer.phone,
  },
  items: [
    {
      event_title: mockTicketItem.eventTitle,
      tier_name: mockTicketItem.tierName,
      quantity: mockTicketItem.quantity,
    },
  ],
};
