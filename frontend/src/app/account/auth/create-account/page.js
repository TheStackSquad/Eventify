//src/app/account/signup/page.js
import AuthFormBoundary from "@/components/errorBoundary/authFormBoundary";
import SignUpForm from "@/components/account/signUp";

export default function SignUpPage() {
  return (
    <AuthFormBoundary formType="signup">
      <SignUpForm />
    </AuthFormBoundary>
  );
}