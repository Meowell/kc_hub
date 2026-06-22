import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen grid-rows-[1fr_auto] px-4 py-6">
      <div className="flex items-center justify-center">
        <LoginForm />
      </div>
      <footer className="text-center text-xs text-slate-500">
        <a href="https://www.miit.gov.cn/" className="transition-colors hover:text-slate-300">
          粤ICP备2026072242号
        </a>
      </footer>
    </main>
  );
}
