//frontend/src/__tests__/vendors/selectFields.js

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SelectField from "@/components/vendorUI/components/form/selectedField";
import { NIGERIAN_STATES, VENDOR_CATEGORIES } from "@/data/vendorData";

const setScreen = (w, h) => {
  window.innerWidth = w;
  window.innerHeight = h;
};
const realW = window.innerWidth;
const realH = window.innerHeight;
afterEach(() => setScreen(realW, realH));

const setupStates = (props = {}) => {
  const onChange = jest.fn();
  render(
    <SelectField
      label="State"
      name="state"
      value=""
      onChange={onChange}
      options={NIGERIAN_STATES}
      required
      {...props}
    />,
  );
  return { onChange, trigger: screen.getByRole("combobox", { name: /State/ }) };
};

const setupCategories = (props = {}) => {
  const onChange = jest.fn();
  render(
    <SelectField
      label="Category"
      name="category"
      value=""
      onChange={onChange}
      options={VENDOR_CATEGORIES}
      {...props}
    />,
  );
  return {
    onChange,
    trigger: screen.getByRole("combobox", { name: /Category/ }),
  };
};

describe("SelectField — display", () => {
  it("shows a placeholder when nothing is selected", () => {
    expect(setupStates().trigger).toHaveTextContent("Select state");
  });

  it("shows the label of the selected value, not the raw value", () => {
    expect(setupStates({ value: "Abuja FCT" }).trigger).toHaveTextContent(
      "Federal Capital Territory (Abuja)",
    );
  });

  it("shows the error and marks the field invalid", () => {
    const { trigger } = setupStates({
      error: "Please select your primary state",
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please select your primary state",
    );
    expect(trigger).toHaveAttribute("aria-invalid", "true");
  });

  it("does not open when disabled", () => {
    const { trigger } = setupStates({ disabled: true });
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("SelectField — choosing", () => {
  it("lists every real option (the empty placeholder entry is not one)", () => {
    const { trigger } = setupStates();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(
      NIGERIAN_STATES.length - 1,
    );
  });

  it("calls onChange with an event-shaped payload and closes", () => {
    const { trigger, onChange } = setupStates();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Lagos" }));
    expect(onChange).toHaveBeenCalledWith({
      target: { name: "state", value: "Lagos" },
    });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("works from the keyboard: arrows move, Enter chooses, Escape closes", () => {
    const { trigger, onChange } = setupStates();
    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // opens on the first option
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith({
      target: { name: "state", value: "Adamawa" },
    });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("a short list jumps by first letter (type-ahead)", () => {
    const { trigger, onChange } = setupCategories();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "v" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith({
      target: { name: "category", value: "venue" },
    });
  });
});

describe("SelectField — search (long lists)", () => {
  it("filters as you type and Enter chooses the first match", () => {
    const { trigger, onChange } = setupStates();
    fireEvent.click(trigger);
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "lag" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith({
      target: { name: "state", value: "Lagos" },
    });
  });

  it("says so when nothing matches, and Enter chooses nothing", () => {
    const { trigger, onChange } = setupStates();
    fireEvent.click(trigger);
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No matches")).toBeInTheDocument();
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("typing a letter on the field opens the list with that search", () => {
    const { trigger } = setupStates();
    fireEvent.keyDown(trigger, { key: "l" });
    expect(screen.getByRole("searchbox")).toHaveValue("l");
  });

  it("starts with an empty search each time it opens", () => {
    const { trigger } = setupStates();
    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "ab" },
    });
    fireEvent.keyDown(trigger, { key: "Escape" });
    fireEvent.click(trigger);
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });
});

describe("SelectField — desktop popover", () => {
  it("focuses the search box so typing starts immediately", () => {
    setScreen(1280, 800);
    const { trigger } = setupStates();
    fireEvent.click(trigger);
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  it("caps the height and stays inside the screen horizontally", () => {
    setScreen(1280, 800);
    const { trigger } = setupStates();
    fireEvent.click(trigger);
    const panel = screen.getByRole("listbox").parentElement;
    expect(parseInt(panel.style.maxHeight, 10)).toBeLessThanOrEqual(340);
    expect(parseInt(panel.style.left, 10)).toBeGreaterThanOrEqual(8);
    expect(
      parseInt(panel.style.left, 10) + parseInt(panel.style.width, 10),
    ).toBeLessThanOrEqual(1280 - 8);
  });

  it("closes when the user presses outside", () => {
    setScreen(1280, 800);
    const { trigger } = setupStates();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("SelectField — phone bottom sheet", () => {
  it.each([
    ["a portrait phone", 375, 667],
    ["a small Android", 360, 640],
    ["a phone held sideways", 844, 390],
  ])("opens as a sheet on %s, at most 70%% of the height", (_label, w, h) => {
    setScreen(w, h);
    const { trigger } = setupStates();
    fireEvent.click(trigger);
    const panel = screen.getByRole("listbox").parentElement;
    expect(panel.className).toMatch(/inset-x-0/);
    expect(parseInt(panel.style.maxHeight, 10)).toBeLessThanOrEqual(
      Math.round(h * 0.7),
    );
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("does not pop the keyboard: the search box is not auto-focused", () => {
    setScreen(375, 667);
    const { trigger } = setupStates();
    fireEvent.click(trigger);
    expect(screen.getByRole("searchbox")).not.toHaveFocus();
  });

  it("locks page scroll while open and restores it afterwards", () => {
    setScreen(375, 667);
    const { trigger } = setupStates();
    fireEvent.click(trigger);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(document.body.style.overflow).toBe("");
    expect(trigger).toHaveFocus();
  });

  it("closes from the backdrop click, not from pointerdown (no tap fall-through)", () => {
    setScreen(375, 667);
    const { trigger } = setupStates();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.click(document.querySelector('div[aria-hidden="true"].inset-0'));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});