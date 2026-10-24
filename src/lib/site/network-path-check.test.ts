import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { candidateDetails, networkPathSummary } from "./network-path-check.ts";

describe("browser network-path diagnostic", () => {
  it("keeps only candidate type and transport, never candidate addresses", () => {
    assert.deepEqual(
      candidateDetails([
        {
          candidate: "candidate:123 1 UDP 2122260223 192.168.1.12 54400 typ host generation 0",
        },
        {
          candidate:
            "candidate:456 1 udp 1686052607 203.0.113.20 62000 typ srflx raddr 192.168.1.12 rport 54400",
        },
        { candidate: "candidate:789 1 tcp 1518280447 192.168.1.12 9 typ host tcptype active" },
      ]),
      { types: ["host", "srflx"], protocols: ["tcp", "udp"] },
    );
  });

  it("states the limits and third-party STUN contact in the handoff summary", () => {
    const summary = networkPathSummary({
      status: "server-reflexive",
      candidateTypes: ["host", "srflx"],
      protocols: ["udp"],
      stunErrorCodes: [],
      elapsedMs: 1234,
      sipAlg: "not-tested",
    });
    assert.match(summary, /SIP ALG was not tested/);
    assert.match(summary, /packet loss/);
    assert.match(summary, /Google's public STUN server/);
    assert.doesNotMatch(summary, /203\.0\.113/);
  });
});
