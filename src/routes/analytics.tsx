import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/auth";

export const Route = createFileRoute("/analytics")({
  beforeLoad: async () => {
    await requireAdmin();
    throw redirect({ to: "/admin/analytics" });
  },
  component: () => null,
});
