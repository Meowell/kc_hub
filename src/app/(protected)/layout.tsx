import { AppShell } from "@/components/common/app-shell";
import { requireCurrentUser } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCurrentUser();

  return <AppShell userName={user.name} avatarUrl={user.avatarUrl ?? undefined} backgroundUrl={user.backgroundUrl ?? undefined}>{children}</AppShell>;
}
