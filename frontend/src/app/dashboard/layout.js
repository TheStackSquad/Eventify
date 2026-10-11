// frontend/src/app/dashboard/layout.js
import AuthGuard from "@/components/auth/authGuard";

export default function DashboardLayout({ children }) {
  return (
    <AuthGuard redirectTo="/account/auth/login" preserveCallback={true}>
      {children}
    </AuthGuard>
  );
}
