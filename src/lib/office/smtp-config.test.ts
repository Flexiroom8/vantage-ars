import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { genericSmtpConfig, gmailSmtpConfig, hasGenericSmtpSettings } from "./smtp-config.ts";

describe("SMTP configuration", () => {
  it("uses a verified public sender with implicit TLS", () => {
    const env = {
      SMTP_HOST: "mail.example.co.za",
      SMTP_USER: "smtp-user@example.co.za",
      SMTP_PASSWORD: "long-password",
      SMTP_FROM: "hello@example.co.za",
    };

    assert.equal(hasGenericSmtpSettings(env), true);
    assert.deepEqual(genericSmtpConfig(env), {
      host: "mail.example.co.za",
      port: 465,
      user: "smtp-user@example.co.za",
      password: "long-password",
      from: "hello@example.co.za",
    });
  });

  it("rejects partial and non-TLS generic settings", () => {
    assert.equal(hasGenericSmtpSettings({ SMTP_HOST: "mail.example.co.za" }), true);
    assert.equal(
      genericSmtpConfig({
        SMTP_HOST: "mail.example.co.za",
        SMTP_USER: "smtp-user@example.co.za",
        SMTP_PASSWORD: "long-password",
      }),
      null,
    );
    assert.equal(
      genericSmtpConfig({
        SMTP_HOST: "mail.example.co.za",
        SMTP_PORT: "587",
        SMTP_USER: "smtp-user@example.co.za",
        SMTP_PASSWORD: "long-password",
        SMTP_FROM: "hello@example.co.za",
      }),
      null,
    );
  });

  it("retains the legacy Gmail configuration without changing its sender", () => {
    assert.deepEqual(gmailSmtpConfig("founder@example.com", "app password"), {
      host: "smtp.gmail.com",
      port: 465,
      user: "founder@example.com",
      password: "apppassword",
      from: "founder@example.com",
    });
    assert.equal(gmailSmtpConfig("not-an-address", "long-password"), null);
  });
});
