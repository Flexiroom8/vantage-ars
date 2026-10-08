import { createContext, useContext, type ReactNode } from "react";
import type { OfficeSnapshot } from "@/lib/office/types";

const OfficeContext = createContext<OfficeSnapshot | null>(null);

export function OfficeProvider({
  snapshot,
  children,
}: {
  snapshot: OfficeSnapshot;
  children: ReactNode;
}) {
  return <OfficeContext.Provider value={snapshot}>{children}</OfficeContext.Provider>;
}

export function useOfficeSnapshot(): OfficeSnapshot {
  const snapshot = useContext(OfficeContext);
  if (!snapshot) throw new Error("Office records are not available.");
  return snapshot;
}
