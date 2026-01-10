// src/app/page.js
"use client";

import Hero from "@/components/homepage/hero";
import TicketCard from "@/components/homepage/ticketCard";
import { useAllEvents } from "@/utils/hooks/useEvents";

export default function Home() {
  // 3. Call the hook to initiate fetching and manage state
  const { data: events, isLoading, isError, error } = useAllEvents();

  // You can optionally check the state for rendering feedback:
  if (isLoading) return <div>Loading events...</div>;
   if (isError) return <div>Error loading events: {error.message}</div>;

  // The 'events' data will be available here when successfully fetched.
  // For this component's purpose (Hero/TicketCard), we just need to trigger the fetch.

  return (
    <main className="min-h-screen bg-black">
      <Hero />
      <TicketCard />
    </main>
  );
}
