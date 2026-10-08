import { createFileRoute } from "@tanstack/react-router";
import { FleetPage } from "@/pages/fleet";

export const Route = createFileRoute("/_app/fleet")({
  component: FleetPage,
});
