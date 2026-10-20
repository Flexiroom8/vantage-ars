"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { submitPublicEnquiry } from "@/lib/office/api";
import { FormConfirmation } from "@/components/public/form-confirmation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type EnquiryFormProps = {
  /** When true, the enquiry is marked as a desk ticket (support page). */
  desk?: boolean;
  /** Initial matter value when desk mode is on. */
  initialMatter?: string;
  /** Matter options rendered in desk mode. */
  matters?: readonly { value: string; label: string }[];
  /** Submit button label. */
  submitLabel?: string;
  /** Success panel heading. */
  doneTitle?: string;
  /** Success panel body text. */
  doneBody?: string;
  /** Error message shown when submission throws. */
  errorMessage?: string;
  /** Name field min length. */
  nameMinLength?: number;
  /** Name field max length. */
  nameMaxLength?: number;
  /** Email field max length. */
  emailMaxLength?: number;
  /** Message field min length. */
  messageMinLength?: number;
  /** Message field max length. */
  messageMaxLength?: number;
  /** Message textarea rows. */
  messageRows?: number;
  /** Message field placeholder. */
  messagePlaceholder?: string;
};

export function EnquiryForm({
  desk = false,
  initialMatter = "fault",
  matters = [],
  submitLabel = "Request a quote",
  doneTitle = "Received.",
  doneBody = "Your enquiry is recorded. You will get a written quote before any work is agreed.",
  errorMessage = "The enquiry could not be sent. Try again in a moment.",
  nameMinLength = 2,
  nameMaxLength = 160,
  emailMaxLength = 254,
  messageMinLength = 5,
  messageMaxLength = 3000,
  messageRows = 5,
  messagePlaceholder = "What stopped working, or what you want set up.",
}: EnquiryFormProps) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    message: "",
    website: "",
    matter: initialMatter,
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const result = await submitPublicEnquiry({
        data: { ...form, ...(desk ? { desk: true } : {}) },
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDone(true);
    } catch {
      setError(errorMessage);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <FormConfirmation>
        <p className="font-serif text-3xl text-ok">{doneTitle}</p>
        <p className="mt-3 text-sm text-muted">{doneBody}</p>
      </FormConfirmation>
    );
  }

  return (
    <form onSubmit={onSubmit} className="glass space-y-4 rounded-2xl p-5">
      <div>
        <Label htmlFor="enquiry-name">Your name</Label>
        <Input
          id="enquiry-name"
          className="mt-2"
          autoComplete="name"
          required
          minLength={nameMinLength}
          maxLength={nameMaxLength}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="enquiry-email">Email</Label>
        <Input
          id="enquiry-email"
          type="email"
          className="mt-2"
          autoComplete="email"
          required
          maxLength={emailMaxLength}
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
      </div>
      {desk && matters.length > 0 && (
        <div>
          <Label htmlFor="enquiry-matter">What is this about?</Label>
          <Select
            id="enquiry-matter"
            className="mt-2"
            value={form.matter}
            onChange={(event) => setForm({ ...form, matter: event.target.value })}
          >
            {matters.map((matter) => (
              <option key={matter.value} value={matter.value}>
                {matter.label}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div>
        <Label htmlFor="enquiry-message">What do you need?</Label>
        <Textarea
          id="enquiry-message"
          className="mt-2"
          required
          minLength={messageMinLength}
          maxLength={messageMaxLength}
          rows={messageRows}
          placeholder={messagePlaceholder}
          value={form.message}
          onChange={(event) => setForm({ ...form, message: event.target.value })}
        />
      </div>
      <div className="h-0 overflow-hidden" aria-hidden="true">
        Leave this field empty
        <input
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(event) => setForm({ ...form, website: event.target.value })}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="cta w-full border-0 sm:w-auto">
        {pending ? "Sending…" : submitLabel}
      </Button>
    </form>
  );
}
