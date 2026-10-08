import { createFileRoute } from "@tanstack/react-router";
import { CommandPage } from "@/pages/command";

export const Route = createFileRoute("/_app/")({
  component: CommandPage,
});
