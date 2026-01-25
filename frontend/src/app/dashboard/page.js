// frontend/src/app/dashboard/page.js
import DashboardContent from "./components/dashboardLayout/dashboardContent";

export default function DashboardPage() {
  // No auth logic here - AuthGuard in layout handles it
  return <DashboardContent />;
}
