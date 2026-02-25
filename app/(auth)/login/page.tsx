import { AuthPanel } from "@/components/auth/auth-panel";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_hsl(var(--primary)/0.35),_transparent_40%),radial-gradient(circle_at_80%_15%,_hsl(32_95%_60%/0.24),_transparent_35%),linear-gradient(180deg,_hsl(195_58%_97%),_hsl(0_0%_100%))]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,_transparent_0%,_hsl(var(--primary)/0.04)_42%,_transparent_100%)]" />
      <div className="relative z-10 w-full max-w-md">
        <AuthPanel />
      </div>
    </div>
  );
}
