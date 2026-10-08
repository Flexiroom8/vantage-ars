import { COMPANY } from "./company.ts";
import { formatZar } from "./money.ts";

export const FOUNDER_EMAIL = COMPANY.email;

export type FounderNotice = {
  kind: "enquiry" | "approval" | "payment" | "chat";
  subject: string;
  body: string;
};

function oneLine(value: string, max: number): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function founderEnquiryNotice(input: {
  name: string;
  email: string;
  subject: string;
  desk: boolean;
  excerpt: string;
}): FounderNotice {
  const where = input.desk ? "customer service desk" : "website enquiry";
  return {
    kind: "enquiry",
    subject: "Vantage-ARS · customer wrote",
    body: [
      `A ${where} was recorded. No email was sent to the customer.`,
      `Name: ${oneLine(input.name, 160)}`,
      `Their email: ${oneLine(input.email, 254)}`,
      `Subject: ${oneLine(input.subject, 120)}`,
      oneLine(input.excerpt, 800),
      "Open the founder office at https://vantage-ars.co.za/office",
    ].join("\n"),
  };
}

export function founderPaymentNotice(input: {
  name: string;
  email: string;
  reference: string;
  cents: number;
}): FounderNotice {
  return {
    kind: "payment",
    subject: "Vantage-ARS · customer says they paid",
    body: [
      "A customer says a payment was sent. This is not a receipt. Treasury is unchanged.",
      `Name: ${oneLine(input.name, 160)}`,
      `Their email: ${oneLine(input.email, 254)}`,
      `Reference: ${oneLine(input.reference, 20)}`,
      `Claimed: ${formatZar(input.cents)}`,
      "Confirm the money in the account before recording it. Open the ledger at https://vantage-ars.co.za/office/ledger",
    ].join("\n"),
  };
}

export function founderChatNotice(input: { name: string; excerpt: string }): FounderNotice {
  return {
    kind: "chat",
    subject: "Vantage-ARS · live chat",
    body: [
      "A customer opened live chat. No quote was given in the automatic reply.",
      `Name: ${oneLine(input.name, 80)}`,
      oneLine(input.excerpt, 500),
      "Open the chat desk at https://vantage-ars.co.za/office/chat",
    ].join("\n"),
  };
}

export function founderApprovalNotice(input: {
  gate: string;
  title: string;
  reason: string;
  amountCents: number;
  companyName: string;
}): FounderNotice {
  const amount = input.amountCents > 0 ? `Amount: ${formatZar(input.amountCents)}` : "Amount: none";
  return {
    kind: "approval",
    subject: "Vantage-ARS · approval required",
    body: [
      "The office is waiting on you. Nothing has been sent to the customer.",
      `Gate: ${oneLine(input.gate, 40)}`,
      `Title: ${oneLine(input.title, 140)}`,
      `Company: ${oneLine(input.companyName, 160) || "Not named"}`,
      amount,
      oneLine(input.reason, 500),
      "Open approvals at https://vantage-ars.co.za/office/approvals",
    ].join("\n"),
  };
}
