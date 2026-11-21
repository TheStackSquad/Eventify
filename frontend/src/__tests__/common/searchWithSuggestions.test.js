// src/__tests__/searchWithSuggestions.test.js

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SearchWithSuggestions from "@/components/vendorUI/components/search/searchWithSuggestion";
import { mockVendorList } from "@/__fixtures__/vendorFixtures";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildProps(overrides = {}) {
  return {
    searchTerm: "",
    onSearchChange: jest.fn(),
    onSearchSubmit: jest.fn(),
    onSuggestionClick: jest.fn(),
    vendors: mockVendorList,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────
describe("SearchWithSuggestions — rendering", () => {
  it("renders the search input", () => {
    render(<SearchWithSuggestions {...buildProps()} />);
    expect(
      screen.getByPlaceholderText("Search vendors, categories, locations..."),
    ).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(<SearchWithSuggestions {...buildProps()} />);
    expect(screen.getByLabelText("Submit search")).toBeInTheDocument();
  });

  it("does NOT render clear button when search term is empty", () => {
    render(<SearchWithSuggestions {...buildProps({ searchTerm: "" })} />);
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
  });

  it("renders clear button when search term is non-empty", () => {
    render(<SearchWithSuggestions {...buildProps({ searchTerm: "Lagos" })} />);
    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Input change handling
// ─────────────────────────────────────────────────────────────────────────────
describe("SearchWithSuggestions — input changes", () => {
  it("calls onSearchChange with the new value when user types", () => {
    const onSearchChange = jest.fn();
    render(<SearchWithSuggestions {...buildProps({ onSearchChange })} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Photography" } });

    expect(onSearchChange).toHaveBeenCalledWith("Photography");
  });

  it("shows suggestions dropdown after typing", async () => {
    render(<SearchWithSuggestions {...buildProps({ searchTerm: "Lagos" })} />);

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);

    // With deferred value, suggestions appear after re-render
    await waitFor(() => {
      // "Lagos Photo Studio" is in the vendor list
      expect(screen.queryAllByRole("button").length).toBeGreaterThan(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion generation
// ─────────────────────────────────────────────────────────────────────────────
describe("SearchWithSuggestions — suggestion generation", () => {
  it("does NOT show suggestions when search term is less than 2 chars", async () => {
    render(<SearchWithSuggestions {...buildProps({ searchTerm: "L" })} />);

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);

    // No suggestions dropdown
    await waitFor(() => {
      expect(screen.queryByText(/Vendor/)).not.toBeInTheDocument();
    });
  });

  it("shows vendor name suggestions matching the search term", async () => {
    render(<SearchWithSuggestions {...buildProps({ searchTerm: "Lagos" })} />);

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Lagos" } });

    await waitFor(() => {
      expect(screen.getByText("Lagos Photo Studio")).toBeInTheDocument();
    });
  });

  it("shows category suggestions matching the search term", async () => {
    // "CATERING" matches "cat"
    render(<SearchWithSuggestions {...buildProps({ searchTerm: "cat" })} />);

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "cat" } });

    await waitFor(() => {
      expect(screen.getByText(/Category: CATERING/)).toBeInTheDocument();
    });
  });

  it("shows location suggestions matching the search term", async () => {
    // "Wuse" is the city for Abuja vendor
    render(<SearchWithSuggestions {...buildProps({ searchTerm: "Wuse" })} />);

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Wuse" } });

    await waitFor(() => {
      expect(screen.getByText(/Location: Wuse/)).toBeInTheDocument();
    });
  });

  it("limits vendor name suggestions to 5 results", async () => {
    // Create 10 vendors all matching "test"
    const manyVendors = Array.from({ length: 10 }, (_, i) => ({
      ...mockVendorList[0],
      id: `id-${i}`,
      name: `Test Vendor ${i}`,
    }));

    render(
      <SearchWithSuggestions
        {...buildProps({ vendors: manyVendors, searchTerm: "Test" })}
      />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Test" } });

    await waitFor(() => {
      const vendorButtons = screen
        .queryAllByRole("button")
        .filter((btn) => btn.textContent.includes("Test Vendor"));
      expect(vendorButtons.length).toBeLessThanOrEqual(5);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// "No results" state
// ─────────────────────────────────────────────────────────────────────────────
describe("SearchWithSuggestions — no results", () => {
  it("shows 'No matching vendors found' when search has >= 2 chars but no matches", async () => {
    render(
      <SearchWithSuggestions
        {...buildProps({ searchTerm: "xyzzzz", vendors: mockVendorList })}
      />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "xyzzzz" } });

    await waitFor(() => {
      expect(
        screen.getByText(/No matching vendors found for/),
      ).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion click
// ─────────────────────────────────────────────────────────────────────────────
describe("SearchWithSuggestions — suggestion click", () => {
  it("calls onSuggestionClick with the suggestion object when a suggestion is clicked", async () => {
    const onSuggestionClick = jest.fn();
    render(
      <SearchWithSuggestions
        {...buildProps({ onSuggestionClick, searchTerm: "Lagos" })}
      />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Lagos" } });

    await waitFor(() => {
      expect(screen.getByText("Lagos Photo Studio")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Lagos Photo Studio"));

    expect(onSuggestionClick).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Lagos Photo Studio",
        type: "vendor",
      }),
    );
  });

  it("hides the suggestions dropdown after a suggestion is clicked", async () => {
    render(<SearchWithSuggestions {...buildProps({ searchTerm: "Lagos" })} />);

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Lagos" } });

    await waitFor(() =>
      expect(screen.getByText("Lagos Photo Studio")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText("Lagos Photo Studio"));

    await waitFor(() => {
      expect(screen.queryByText("Lagos Photo Studio")).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Submit
// ─────────────────────────────────────────────────────────────────────────────
describe("SearchWithSuggestions — form submit", () => {
  it("calls onSearchSubmit with the current searchTerm when form is submitted", () => {
    const onSearchSubmit = jest.fn();
    render(
      <SearchWithSuggestions
        {...buildProps({ searchTerm: "Photography", onSearchSubmit })}
      />,
    );

    fireEvent.click(screen.getByLabelText("Submit search"));

    expect(onSearchSubmit).toHaveBeenCalledWith("Photography");
  });

  it("hides suggestions after form submission", async () => {
    render(<SearchWithSuggestions {...buildProps({ searchTerm: "Lagos" })} />);

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Lagos" } });

    await waitFor(() =>
      expect(screen.getByText("Lagos Photo Studio")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByLabelText("Submit search"));

    await waitFor(() => {
      expect(screen.queryByText("Lagos Photo Studio")).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Clear button
// ─────────────────────────────────────────────────────────────────────────────
describe("SearchWithSuggestions — clear button", () => {
  it("calls onSearchChange with empty string when clear is clicked", () => {
    const onSearchChange = jest.fn();
    render(
      <SearchWithSuggestions
        {...buildProps({ searchTerm: "Lagos", onSearchChange })}
      />,
    );

    fireEvent.click(screen.getByLabelText("Clear search"));

    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("hides the suggestions dropdown after clearing", async () => {
    render(<SearchWithSuggestions {...buildProps({ searchTerm: "Lagos" })} />);

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Lagos" } });

    await waitFor(() =>
      expect(screen.getByText("Lagos Photo Studio")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByLabelText("Clear search"));

    await waitFor(() => {
      expect(screen.queryByText("Lagos Photo Studio")).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Click outside dismissal
// ─────────────────────────────────────────────────────────────────────────────
describe("SearchWithSuggestions — click outside", () => {
  it("hides suggestions when user clicks outside the component", async () => {
    render(
      <div>
        <SearchWithSuggestions {...buildProps({ searchTerm: "Lagos" })} />
        <div data-testid="outside-element">Outside</div>
      </div>,
    );

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Lagos" } });

    await waitFor(() =>
      expect(screen.getByText("Lagos Photo Studio")).toBeInTheDocument(),
    );

    // Click outside
    fireEvent.mouseDown(screen.getByTestId("outside-element"));

    await waitFor(() => {
      expect(screen.queryByText("Lagos Photo Studio")).not.toBeInTheDocument();
    });
  });
});
