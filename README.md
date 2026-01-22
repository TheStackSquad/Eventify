This developer’s note is designed to explain the "Ticket Payment & Inventory Safety" system we just built. You can drop this directly into your project's `README.md` or a `CONTRIBUTING.md` file.

---

## 🛠️ Developer’s Note: The "Atomic" Ticket Security System

### The Challenge

When selling tickets online, two major risks exist:

1. **Overselling:** Two people buying the last ticket at the exact same millisecond.
2. **Ghost Orders:** A user starts a purchase, "locks" a ticket, but then closes their browser, leaving that ticket stuck in limbo and unavailable for others to buy.

### Our Solution: The "Atomic Reaper" Architecture

To solve this, we implemented a robust, industrial-grade backend logic that ensures 100% data integrity.

#### 1. Atomic Transactions (No Overselling)

We use **Database Transactions**. Think of this as an "all-or-nothing" vault. When a payment is confirmed:

* We check if the order is still valid.
* We officially mark it as paid.
* We generate unique, secure ticket codes.
* We subtract the stock from the event.

If any single step fails (e.g., the internet cuts out while generating tickets), the entire process "rolls back" instantly as if it never started. This prevents "partial successes" where a user pays but doesn't get a ticket.

#### 2. The Background "Reaper" (Inventory Recovery)

To prevent "Ghost Orders" from taking up space, we built a background worker (The Reaper).

* **The Watch:** Every minute, it looks for "Pending" orders older than 15 minutes.
* **The Release:** If it finds one, it cancels the order and **immediately returns those tickets to the public pool**.
* **The Shield:** It marks the order as `EXPIRED`. Even if a user tries to pay for that old order a second later, the system will reject it because the Reaper has already secured the stock for someone else.

#### 3. Smart & Secure Ticket Codes

Instead of simple numbers (like Ticket #001), our system generates **Cryptographically Signed Codes** (e.g., `VL9IHU-001-f3a2b1c0`).

* **Tamper-Proof:** Because the code contains a "digital signature" (HMAC), a fraudster cannot guess a valid ticket code or change their ticket number from 10 to 1.
* **Offline Verification:** This signature allows event staff to verify that a ticket is authentic even if the venue has no internet connection.

### Technical Summary for Devs

* **Concurrency Control:** Handled via PostgreSQL row-level locking during status updates.
* **Idempotency:** The `UpdateOrderToPaidTx` method uses a strict `WHERE status = 'pending'` check to ensure webhooks don't process the same payment twice.
* **Background Processing:** Implemented via a Go Goroutine with a `time.Ticker`, decoupled from the main request/response cycle for high performance.

---
📝 Dev Journal: Jan 2026 - Hardening the Transactional Core
Today's Objective: Transition the Order and Inventory systems from "flexible/name-based" to "hardened/UUID-based" to ensure absolute financial integrity and prevent overselling.

The Problem
Our initial implementation relied on TierName strings for stock lookups. This was a "soft" link—if an organizer renamed a tier mid-sale, or if two events shared a "VIP" name, the logic would break. Additionally, pricing was susceptible to "price injection" if the backend trusted the price sent from the frontend request.

The Hardened Solution
UUID as the Single Source of Truth: We refactored the entire checkout flow to use TicketTierID (UUID) as the immutable primary key. The frontend now only sends the ID and Quantity; the backend fetches everything else (Name, Price, Event Title) directly from the database.

Authoritative Pricing: Implemented a PricingService that ignores user-provided prices. It performs a "Truth Lookup" by ID to calculate the total in Kobo (integers), preventing floating-point math errors and malicious price manipulation.

Atomic Inventory Management: * Pessimistic Reservation: Stock is decremented immediately when an order is initialized.

Guaranteed Release: If a payment fails or the 15-minute window expires, an atomic IncrementTicketStockTx returns those specific tickets to the pool using the UUID.

Idempotent Finalization: To handle the "Double Click" or "Webhook vs. User Redirect" race condition, we implemented a sync.Map deduplication layer in VerifyAndProcess. This ensures we only charge the user and generate tickets exactly once per Paystack reference.

Key Lessons
Trust No One: Never trust the frontend for data that exists in your database (especially money).

Type Safety is Architecture: Moving the TierDetails model to a central package was the key to making the Repository and Service layers "speak the same language."