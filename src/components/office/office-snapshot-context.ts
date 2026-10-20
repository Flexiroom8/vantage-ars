import { createContext } from "react";
import type { OfficeSnapshot } from "@/lib/office/types";

export type OfficeSnapshotValue = OfficeSnapshot | null;

export const OfficeSnapshotContext = createContext<OfficeSnapshotValue>(null);
