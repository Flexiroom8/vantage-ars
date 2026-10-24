"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { submitPublicEnquiry } from "@/lib/office/api";
import { FormConfirmation } from "@/components/public/form-confirmation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SERVICE_PAGES } from "@/lib/site/services";
import { DIAGNOSTIC_DRAFT_KEY } from "@/lib/site/email-auth-check";
import { NETWORK_DIAGNOSTIC_DRAFT_KEY } from "@/lib/site/network-path-check";

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
    serviceLine: "",
    pbxModel: "",
    sipProvider: "",
    routerModel: "",
    startedAt: "",
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const diagnostics = [DIAGNOSTIC_DRAFT_KEY, NETWORK_DIAGNOSTIC_DRAFT_KEY]
          .map((key) => {
            const value = window.sessionStorage.getItem(key);
            if (value) window.sessionStorage.removeItem(key);
            return value;
          })
          .filter((value): value is string => Boolean(value));
        if (!diagnostics.length) return;
        setForm((current) => ({
          ...current,
          message: `${diagnostics.join("\n\n")}\n\n${current.message}`.slice(0, messageMaxLength),
        }));
      } catch {
        setError(
          "This browser blocked the saved diagnostic. Return to the checker and copy its result.",
        );
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [messageMaxLength]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const result = await submitPublicEnquiry({
        data: {
          ...form,
          ...(desk
            ? { desk: true }
            : {
                serviceLine: form.serviceLine || undefined,
                pbxModel: form.pbxModel || undefined,
                sipProvider: form.sipProvider || undefined,
                routerModel: form.routerModel || undefined,
                startedAt: form.startedAt || undefined,
              }),
        },
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
    <form id="enquiry-form" onSubmit={onSubmit} className="glass space-y-4 rounded-2xl p-5">
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
      {!desk && (
        <div>
          <Label htmlFor="enquiry-service-line">Service line</Label>
          <Select
            id="enquiry-service-line"
            className="mt-2"
            value={form.serviceLine}
            onChange={(event) => setForm({ ...form, serviceLine: event.target.value })}
          >
            <option value="">Not sure yet</option>
            {SERVICE_PAGES.map((page) => (
              <option key={page.slug} value={page.slug}>
                {page.title}
              </option>
            ))}
          </Select>
        </div>
      )}
      {!desk && form.serviceLine === "voip" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="enquiry-pbx-model">PBX model (if known)</Label>
            <Input
              id="enquiry-pbx-model"
              className="mt-2"
              maxLength={160}
              value={form.pbxModel}
              onChange={(event) => setForm({ ...form, pbxModel: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="enquiry-sip-provider">SIP provider (if known)</Label>
            <Input
              id="enquiry-sip-provider"
              className="mt-2"
              maxLength={160}
              value={form.sipProvider}
              onChange={(event) => setForm({ ...form, sipProvider: event.target.value })}
            />
          </div>
        </div>
      )}
      {!desk && form.serviceLine === "networking" && (
        <div>
          <Label htmlFor="enquiry-router-model">Router model (if known)</Label>
          <Input
            id="enquiry-router-model"
            className="mt-2"
            maxLength={160}
            value={form.routerModel}
            onChange={(event) => setForm({ ...form, routerModel: event.target.value })}
          />
        </div>
      )}
      {!desk && (
        <div>
          <Label htmlFor="enquiry-started-at">When did it start? (if known)</Label>
          <Input
            id="enquiry-started-at"
            className="mt-2"
            maxLength={160}
            value={form.startedAt}
            onChange={(event) => setForm({ ...form, startedAt: event.target.value })}
          />
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
