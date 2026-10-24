export const NETWORK_DIAGNOSTIC_DRAFT_KEY = "vantage-network-path-diagnostic";
const STUN_SERVER = "stun:stun.l.google.com:19302";

export type NetworkPathResult = {
  status: "server-reflexive" | "no-server-reflexive" | "no-candidate";
  candidateTypes: string[];
  protocols: string[];
  stunErrorCodes: number[];
  elapsedMs: number;
  sipAlg: "not-tested";
};

type CandidateLike = {
  candidate: string;
};

export function candidateDetails(candidates: CandidateLike[]): {
  types: string[];
  protocols: string[];
} {
  const types = new Set<string>();
  const protocols = new Set<string>();
  for (const item of candidates) {
    const candidate = item.candidate ?? "";
    const type = /\btyp\s+(host|srflx|prflx|relay)\b/i.exec(candidate)?.[1]?.toLowerCase();
    const protocol = /^candidate:\S+\s+\d+\s+(udp|tcp)(?:\s|$)/i.exec(candidate)?.[1]?.toLowerCase();
    if (type) types.add(type);
    if (protocol) protocols.add(protocol);
  }
  return {
    types: [...types].sort(),
    protocols: [...protocols].sort(),
  };
}

export function networkPathSummary(result: NetworkPathResult): string {
  const path =
    result.status === "server-reflexive"
      ? "A server-reflexive ICE candidate was gathered; this browser can reach a STUN server."
      : result.status === "no-server-reflexive"
        ? "Candidates were gathered, but no server-reflexive candidate was observed."
        : "No ICE candidates were gathered before the check ended.";
  return [
    "Browser network-path diagnostic",
    path,
    `Candidate types: ${result.candidateTypes.join(", ") || "none"}.`,
    `Candidate transports: ${result.protocols.join(", ") || "none"}.`,
    `STUN error codes: ${result.stunErrorCodes.join(", ") || "none reported"}.`,
    `Gathering time: ${result.elapsedMs} ms.`,
    "SIP ALG was not tested. This check does not test SIP signalling, call quality, packet loss, or the customer's PBX/router configuration.",
    "The browser contacted Google's public STUN server; Vantage-ARS did not receive IP addresses or candidate details.",
  ].join("\n");
}

export async function checkNetworkPath(
  timeoutMs = 8_000,
  createPeer: (configuration: RTCConfiguration) => RTCPeerConnection = (configuration) =>
    new RTCPeerConnection(configuration),
): Promise<NetworkPathResult> {
  if (typeof RTCPeerConnection === "undefined") {
    throw new Error("This browser does not support WebRTC network checks.");
  }
  const startedAt = Date.now();
  const peer = createPeer({ iceServers: [{ urls: STUN_SERVER }] });
  const candidates: CandidateLike[] = [];
  const stunErrorCodes = new Set<number>();
  try {
    peer.createDataChannel("network-path-check");
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, timeoutMs);
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          candidates.push(event.candidate);
          return;
        }
        window.clearTimeout(timer);
        resolve();
      };
      peer.onicegatheringstatechange = () => {
        if (peer.iceGatheringState === "complete") {
          window.clearTimeout(timer);
          resolve();
        }
      };
      peer.onicecandidateerror = (event) => {
        if (Number.isInteger(event.errorCode)) stunErrorCodes.add(event.errorCode);
      };
      if (peer.iceGatheringState === "complete") {
        window.clearTimeout(timer);
        resolve();
      }
      // Timeout is a bounded observation, not a connectivity failure.
    });

    const details = candidateDetails(candidates);
    const status = details.types.includes("srflx")
      ? "server-reflexive"
      : details.types.length > 0
        ? "no-server-reflexive"
        : "no-candidate";
    return {
      status,
      candidateTypes: details.types,
      protocols: details.protocols,
      stunErrorCodes: [...stunErrorCodes].sort((a, b) => a - b),
      elapsedMs: Math.max(0, Date.now() - startedAt),
      sipAlg: "not-tested",
    };
  } finally {
    peer.onicecandidate = null;
    peer.onicegatheringstatechange = null;
    peer.onicecandidateerror = null;
    peer.close();
  }
}
