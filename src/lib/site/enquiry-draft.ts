export const ENQUIRY_DRAFT_KEY = "vantage-enquiry-draft";

export function stageEnquiryDraft(value: string): boolean {
  const draft = value.trim();
  if (!draft || draft.length > 2_800) return false;

  try {
    window.sessionStorage.setItem(ENQUIRY_DRAFT_KEY, draft);
    return true;
  } catch {
    return false;
  }
}
