import { createRouter as createTanstackRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function createRouter() {
  return createTanstackRouter({ routeTree, defaultErrorComponent: AppErrorComponent });
}
