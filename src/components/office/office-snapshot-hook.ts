import { useContext } from "react";
import { OfficeSnapshotContext } from "./office-snapshot-context";

export function useOfficeSnapshot() {
  const snapshot = useContext(OfficeSnapshotContext);
  if (!snapshot) throw new Error("Office records are not available.");
  return snapshot;
}
