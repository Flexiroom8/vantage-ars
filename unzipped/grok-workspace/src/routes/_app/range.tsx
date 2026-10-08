import { createFileRoute } from "@tanstack/react-router";
import { RangePage } from "@/pages/range";

export const Route = createFileRoute("/_app/range")({
  component: RangePage,
});
