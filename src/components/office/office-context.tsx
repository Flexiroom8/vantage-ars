import type { ReactNode } from "react";
import type { OfficeSnapshot } from "@/lib/office/types";
import { OfficeSnapshotContext } from "./office-snapshot-context";

export function OfficeProvider({
  snapshot,
  children,
}: {
  snapshot: OfficeSnapshot;
  children: ReactNode;
}) {
  return (
    <OfficeSnapshotContext.Provider value={snapshot}>{children}</OfficeSnapshotContext.Provider>
  );
}
