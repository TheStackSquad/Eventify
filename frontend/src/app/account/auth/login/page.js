// src/app/login/page.js
import AuthFormBoundary from "@/components/errorBoundary/authFormBoundary";
import LoginForm from "@/components/account/LoginForm";

export default function AccountLoginPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-body">
      <AuthFormBoundary formType="login">
        <LoginForm />
      </AuthFormBoundary>
    </div>
  );
}
