import { createFileRoute } from "@tanstack/react-router";
import { ConstitutionPage } from "@/pages/constitution";

export const Route = createFileRoute("/_app/constitution")({
  component: ConstitutionPage,
});
