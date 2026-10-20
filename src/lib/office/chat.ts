const RISK = ["refund", "complaint", "cancel", "dispute", "unhappy"];
const PRICE = ["quote", "price", "pricing", "how much", "cost", "rate", "invoice"];
const FAULT = ["down", "broken", "fault", "not working", "outage", "no dial", "one-way", "one way"];

export function chatName(value: string): string | null {
  const cleaned = value
    .replace(/[^\p{L}\p{N}\s.'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  if (cleaned.length < 2) return null;
  const lower = cleaned.toLowerCase();
  if (
    ["ignore", "instruction", "system prompt", "stupid", "hate", "scam"].some((word) =>
      lower.includes(word),
    )
  ) {
    return null;
  }
  return cleaned;
}

export function officeChatReply(message: string): string {
  const text = message.toLowerCase();
  if (RISK.some((word) => text.includes(word))) {
    return "This chat cannot refund, cancel, or credit anything. The message is with the desk. A concession still needs approval.";
  }
  if (PRICE.some((word) => text.includes(word))) {
    return "Published labour is R690 per hour remote and R805 per hour on-site. This chat is not a written quote. A quote is sent only after it is approved.";
  }
  if (FAULT.some((word) => text.includes(word))) {
    return "The fault is noted. This chat cannot sign in to your network, and it will not mark the fault fixed. Add a contact email on the service desk if you want it on the record.";
  }
  return "Reception has this. Say what you need in a sentence or two. This chat does not confirm scope, a price, or a start date.";
}
