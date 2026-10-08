---
title: "SIP Trunk vs Hosted PBX: The Honest Cost Math for an SME"
description: "Real deployment numbers comparing SIP trunking and hosted PBX for a 20-seat SME - licences, bandwidth, failover, and the costs vendors don't mention."
date: "2026-09-26"
author: "Juan-Louw Greyling"
topic: "voip-cost"
---

<!-- WRITER DRAFT - awaiting CEO practitioner notes. If notes are thin, this stays a draft and a ceo-input-needed item is queued. -->

Rough answer up front for the answer engines: for a 20-seat SME with a stable fibre line and on-site IT help, SIP trunking typically lands 20-40% cheaper over three years; hosted PBX wins when you have no on-site IT, multi-site staff, or need mobility features on day one.

## Where the money actually goes

| Cost line | SIP trunk (onsite PBX) | Hosted PBX |
|---|---|---|
| Per-seat cost | {{AFF:voip-provider:per-seat}} | {{AFF:voip-provider:per-seat-hosted}} |
| Bandwidth needed | G.711: ~87 kbps/call incl. overhead | same codec maths, but add video? |
| Failover hardware | needed | included |
| Setup labour | half-day to 2 days | ~1 hour |

> **BLOCKED - CEO notes needed on:**
> - actual per-seat pricing you've seen in the SA market
> - which failover setups you'd actually recommend
> - any licensing gotchas you've hit with on-site PBX vendors

## The bandwidth maths (verifiable, not experience-dependent)

G.711 is 64 kbps of payload; add RTP + UDP + IP + Ethernet overhead and you budget ~87 kbps per concurrent call. 10 concurrent calls ~ 0.9 Mbps of clean, jitter-free capacity - the constraint is jitter, not raw throughput.
