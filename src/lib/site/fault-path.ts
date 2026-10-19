/**
 * The three places a fault almost always sits.
 *
 * Single source of truth shared by the hero teaser (PathExhibit) and the full
 * interactive finder (SignalPath). They used to each keep a private copy of the
 * same titles and detail lines, so the same sentences were printed twice on the
 * home page and could silently drift apart.
 */
export const FAULT_STOPS = [
  {
    key: "phone",
    title: "The phone",
    detail: "No dial tone, one-way audio, or a handset that will not register.",
  },
  {
    key: "network",
    title: "The network",
    detail: "Wi-Fi, switches, and the route between the two ends.",
  },
  {
    key: "system",
    title: "The system",
    detail: "The phone system or server the call depends on.",
  },
] as const;

export type FaultStopKey = (typeof FAULT_STOPS)[number]["key"];
