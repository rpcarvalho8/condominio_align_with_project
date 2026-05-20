import { Redirect } from "wouter";
import { authClient } from "../lib/auth";

export function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm">A carregar...</div>
      </div>
    );
  }

  if (!session) return <Redirect to="/login" />;

  const user = session.user as any;

  // Condómino trying to access admin area → send to portal
  if (adminOnly && user?.role !== "admin") return <Redirect to="/portal" />;

  return <>{children}</>;
}
