import { OnboardingForm } from "@/components/forms/onboarding-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "",
};

export default function OnboardingPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <OnboardingForm />
    </div>
  );
}
