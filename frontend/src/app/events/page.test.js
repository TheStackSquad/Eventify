// frontend/src/app/events/page.test.js
import { render, screen, waitFor } from "@testing-library/react";
import EventsPage,  {generateMetadata}  from "@/app/events/page";
//import EventsPage from "../events/page";

// 1. Mock the global fetch function
// We'll use jest.spyOn for clarity and control
const mockFetch = jest.spyOn(global, "fetch");

// 2. Mock the client component (EventsPageClient)
// We only care that it receives the correct props, not its internal rendering.
// This is crucial for isolating the server component's test.
jest.mock("@/app/events/eventsPageClient", () => {
  // Use a simple functional component for the mock
  return function MockEventsPageClient({ initialEvents }) {
    return (
      <div data-testid="events-client-component">
        <span data-testid="event-count">{initialEvents.length}</span>
        {/* We can also assert the structure of the data if needed */}
        {initialEvents.length > 0 && (
          <span data-testid="first-event-title">{initialEvents[0].title}</span>
        )}
      </div>
    );
  };
});

describe("EventsPage Server Component", () => {
  // Clear all mocks after each test to ensure test isolation
  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- Test Case 1: Successful Fetch ---
  it("should successfully fetch events and pass them to EventsPageClient", async () => {
    // Define the mock data
    const mockEvents = [
      { id: 1, title: "Concert Night", date: "2025-12-01" },
      { id: 2, title: "Tech Conference", date: "2025-12-10" },
    ];

    // Configure the mock 'fetch' call to return success response with JSON data
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => mockEvents,
    });

    // Render the server component
    // Note: Rendering an async Server Component directly requires calling it,
    // and using `await` with `render` from RTL.
    const { container } = render(await EventsPage());

    // 1. Assert that the fetch function was called correctly
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/events"),
      expect.objectContaining({
        next: { revalidate: 60 },
        headers: { "Content-Type": "application/json" },
      })
    );

    // 2. Assert that the client component received the correct data
    const clientComponent = screen.getByTestId("events-client-component");
    expect(clientComponent).toBeInTheDocument();

    const eventCount = screen.getByTestId("event-count");
    expect(eventCount).toHaveTextContent(mockEvents.length.toString());

    const firstEventTitle = screen.getByTestId("first-event-title");
    expect(firstEventTitle).toHaveTextContent("Concert Night");
  });

  // --- Test Case 2: Fetch Failure (HTTP error) ---
  it("should pass an empty array to EventsPageClient on HTTP failure", async () => {
    // Mock a non-ok response (e.g., 500 Server Error)
    const errorStatus = 500;
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: errorStatus,
      statusText: "Internal Server Error",
      // We don't need to mock json() for a failure, but it's good practice to provide it
      json: async () => ({ message: "Server error" }),
    });

    // Suppress console.error output during the test run
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Render the component
    render(await EventsPage());

    // 1. Assert that fetch was called
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // 2. Assert that the error was logged
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching events:"),
        expect.any(Error)
      );
    });

    // 3. Assert that the client component received an empty array
    const eventCount = screen.getByTestId("event-count");
    expect(eventCount).toHaveTextContent("0");

    // Restore the console.error original function
    consoleErrorSpy.mockRestore();
  });

  // --- Test Case 3: Network Error (Exception) ---
  it("should pass an empty array to EventsPageClient on network/exception error", async () => {
    // Mock the fetch call to throw an error (simulates network issue, DNS error, etc.)
    const networkError = new Error("Network timeout or connection refused");
    mockFetch.mockRejectedValueOnce(networkError);

    // Suppress console.error output during the test run
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Render the component
    render(await EventsPage());

    // 1. Assert that fetch was called
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // 2. Assert that the error was logged
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "❌ Error fetching events:",
        networkError
      );
    });

    // 3. Assert that the client component received an empty array
    const eventCount = screen.getByTestId("event-count");
    expect(eventCount).toHaveTextContent("0");

    // Restore the console.error original function
    consoleErrorSpy.mockRestore();
  });

  // --- Test Case 4: Metadata Generation (Optional but good practice) ---
 it("should generate the correct metadata for SEO", async () => {
   // EventsPage exports a `generateMetadata` async function
   // FIX: Call the named export function directly
   const metadata = await generateMetadata(); // <-- Corrected line

   expect(metadata.title).toBe("Browse Events | Your App Name");
   expect(metadata.description).toContain("Discover amazing events");
   expect(metadata.openGraph.title).toBe("Browse Events");
   expect(metadata.openGraph.images[0]).toBe("/og-events.jpg");
 });
});
