import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import NotificationSettings from "@/app/settings/notifications/page";
import { useAuth } from "@/utils/hooks/useAuth";
import backendInstance from "@/axiosConfig/axios";
import toastAlert from "@/components/common/toast/toastAlert";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/utils/hooks/useAuth", () => ({
  useAuth: jest.fn(),
}));

// backendInstance is the default export from axios.js
jest.mock("@/axiosConfig/axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

// toastAlert is a default export plain object — mock the whole thing
jest.mock("@/components/common/toast/toastAlert", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// LoadingSpinner renders `message` as <h2> — no mock needed; we assert on text.

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER = { id: "user-123", email: "test@example.com" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Render and wait until the loading spinner is gone (fetch resolved/rejected). */
async function renderAndSettle(props = {}) {
  const result = render(<NotificationSettings {...props} />);
  await waitFor(() =>
    expect(
      screen.queryByText("Loading your settings..."),
    ).not.toBeInTheDocument(),
  );
  return result;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("NotificationSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Initial loading state ──────────────────────────────────────────────────

  describe("initial loading state", () => {
    it("shows loading spinner while fetch is in flight", () => {
      useAuth.mockReturnValue({ user: USER });
      // Never resolves — holds component in loading state indefinitely
      backendInstance.get.mockReturnValue(new Promise(() => {}));

      render(<NotificationSettings />);

      expect(screen.getByText("Loading your settings...")).toBeInTheDocument();
    });

    it("hides loading spinner and renders UI after fetch resolves", async () => {
      useAuth.mockReturnValue({ user: USER });
      backendInstance.get.mockResolvedValue({
        data: { allowReminderEmails: true },
      });

      await renderAndSettle();

      expect(screen.getByText("Email Notifications")).toBeInTheDocument();
      expect(
        screen.queryByText("Loading your settings..."),
      ).not.toBeInTheDocument();
    });

    it("stops loading immediately and skips fetch when user is null", async () => {
      useAuth.mockReturnValue({ user: null });

      render(<NotificationSettings />);

      await waitFor(() =>
        expect(screen.getByText("Email Notifications")).toBeInTheDocument(),
      );
      expect(backendInstance.get).not.toHaveBeenCalled();
    });
  });

  // ── Fetching preferences ───────────────────────────────────────────────────

  describe("fetching preferences", () => {
    it("calls GET /api/user/preferences when user.id is present", async () => {
      useAuth.mockReturnValue({ user: USER });
      backendInstance.get.mockResolvedValue({
        data: { allowReminderEmails: true },
      });

      await renderAndSettle();

      expect(backendInstance.get).toHaveBeenCalledWith("/api/user/preferences");
      expect(backendInstance.get).toHaveBeenCalledTimes(1);
    });

    it("sets checkbox to checked when allowReminderEmails is true", async () => {
      useAuth.mockReturnValue({ user: USER });
      backendInstance.get.mockResolvedValue({
        data: { allowReminderEmails: true },
      });

      await renderAndSettle();

      expect(screen.getByRole("checkbox")).toBeChecked();
    });

    it("sets checkbox to unchecked when allowReminderEmails is false", async () => {
      useAuth.mockReturnValue({ user: USER });
      backendInstance.get.mockResolvedValue({
        data: { allowReminderEmails: false },
      });

      await renderAndSettle();

      expect(screen.getByRole("checkbox")).not.toBeChecked();
    });

    it("stops loading and keeps default (checked) when fetch fails", async () => {
      useAuth.mockReturnValue({ user: USER });
      backendInstance.get.mockRejectedValue(new Error("Network error"));

      await renderAndSettle();

      // Default allowReminders is true — checkbox stays checked after error
      expect(screen.getByRole("checkbox")).toBeChecked();
    });
  });

  // ── Toggle — uncheck (disable reminders) ──────────────────────────────────

  describe("unchecking the toggle (disabling reminders)", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ user: USER });
      // Start with reminders ON so we can uncheck
      backendInstance.get.mockResolvedValue({
        data: { allowReminderEmails: true },
      });
    });

    it("calls PATCH /api/user/preferences with allowReminderEmails=false", async () => {
      backendInstance.patch.mockResolvedValue({});

      await renderAndSettle();

      await act(async () => {
        fireEvent.click(screen.getByRole("checkbox"));
      });

      expect(backendInstance.patch).toHaveBeenCalledWith(
        "/api/user/preferences",
        { allowReminderEmails: false },
      );
    });

    it("shows 'Reminder emails disabled' success toast", async () => {
      backendInstance.patch.mockResolvedValue({});

      await renderAndSettle();

      await act(async () => {
        fireEvent.click(screen.getByRole("checkbox"));
      });

      expect(toastAlert.success).toHaveBeenCalledWith(
        "Reminder emails disabled",
      );
    });

    it("unchecks the checkbox after successful save", async () => {
      backendInstance.patch.mockResolvedValue({});

      await renderAndSettle();

      await act(async () => {
        fireEvent.click(screen.getByRole("checkbox"));
      });

      expect(screen.getByRole("checkbox")).not.toBeChecked();
    });
  });

  // ── Toggle — check (enable reminders) ─────────────────────────────────────

  describe("checking the toggle (enabling reminders)", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ user: USER });
      // Start with reminders OFF so we can check
      backendInstance.get.mockResolvedValue({
        data: { allowReminderEmails: false },
      });
    });

    it("calls PATCH /api/user/preferences with allowReminderEmails=true", async () => {
      backendInstance.patch.mockResolvedValue({});

      await renderAndSettle();

      await act(async () => {
        fireEvent.click(screen.getByRole("checkbox"));
      });

      expect(backendInstance.patch).toHaveBeenCalledWith(
        "/api/user/preferences",
        { allowReminderEmails: true },
      );
    });

    it("shows 'Reminder emails enabled' success toast", async () => {
      backendInstance.patch.mockResolvedValue({});

      await renderAndSettle();

      await act(async () => {
        fireEvent.click(screen.getByRole("checkbox"));
      });

      expect(toastAlert.success).toHaveBeenCalledWith(
        "Reminder emails enabled",
      );
    });
  });

  // ── Save error handling ────────────────────────────────────────────────────

  describe("save error handling", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ user: USER });
      backendInstance.get.mockResolvedValue({
        data: { allowReminderEmails: true },
      });
    });

    it("shows 'Failed to update preferences' error toast when PATCH fails", async () => {
      backendInstance.patch.mockRejectedValue(new Error("Server error"));

      await renderAndSettle();

      await act(async () => {
        fireEvent.click(screen.getByRole("checkbox"));
      });

      await waitFor(() => {
        expect(toastAlert.error).toHaveBeenCalledWith(
          "Failed to update preferences",
        );
      });
    });

    it("does not call toastAlert.success when PATCH fails", async () => {
      backendInstance.patch.mockRejectedValue(new Error("Server error"));

      await renderAndSettle();

      await act(async () => {
        fireEvent.click(screen.getByRole("checkbox"));
      });

      await waitFor(() => {
        expect(toastAlert.error).toHaveBeenCalledTimes(1);
      });
      expect(toastAlert.success).not.toHaveBeenCalled();
    });
  });

  // ── Saving in-progress UI ──────────────────────────────────────────────────

  describe("saving in-progress state", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ user: USER });
      backendInstance.get.mockResolvedValue({
        data: { allowReminderEmails: true },
      });
    });

    it("disables the checkbox while save is in progress", async () => {
      // Never resolves — holds isSaving=true
      backendInstance.patch.mockReturnValue(new Promise(() => {}));

      await renderAndSettle();

      act(() => {
        fireEvent.click(screen.getByRole("checkbox"));
      });

      expect(screen.getByRole("checkbox")).toBeDisabled();
    });

    it("shows 'Saving changes...' overlay spinner while save is in progress", async () => {
      backendInstance.patch.mockReturnValue(new Promise(() => {}));

      await renderAndSettle();

      act(() => {
        fireEvent.click(screen.getByRole("checkbox"));
      });

      expect(screen.getByText("Saving changes...")).toBeInTheDocument();
    });

    it("re-enables the checkbox after save completes", async () => {
      backendInstance.patch.mockResolvedValue({});

      await renderAndSettle();

      await act(async () => {
        fireEvent.click(screen.getByRole("checkbox"));
      });

      expect(screen.getByRole("checkbox")).not.toBeDisabled();
    });

    it("removes saving spinner after save completes", async () => {
      backendInstance.patch.mockResolvedValue({});

      await renderAndSettle();

      await act(async () => {
        fireEvent.click(screen.getByRole("checkbox"));
      });

      expect(screen.queryByText("Saving changes...")).not.toBeInTheDocument();
    });
  });

  // ── Static content ─────────────────────────────────────────────────────────

  describe("static content", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ user: USER });
      backendInstance.get.mockResolvedValue({
        data: { allowReminderEmails: true },
      });
    });

    it("renders 'Email Notifications' page heading", async () => {
      await renderAndSettle();
      expect(screen.getByText("Email Notifications")).toBeInTheDocument();
    });

    it("renders 'Subscription Reminders' section heading", async () => {
      await renderAndSettle();
      expect(screen.getByText("Subscription Reminders")).toBeInTheDocument();
    });

    it("renders description about 7, 3, 1 day reminder cadence", async () => {
      await renderAndSettle();
      expect(
        screen.getByText(/7, 3, and 1 day before your subscription expires/),
      ).toBeInTheDocument();
    });

    it("renders info note that payment receipts are always sent", async () => {
      await renderAndSettle();
      expect(
        screen.getByText(/Payment receipts and important account/),
      ).toBeInTheDocument();
    });
  });
});
