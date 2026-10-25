# Online payment gateway readiness

**Status: online checkout is not implemented and must remain disabled.** The
site continues to use its existing manual/EFT invoice instructions and
founder-recorded payment flow. `PAYFAST_CHECKOUT_ENABLED=true` is not an
activation switch in this build; startup warns that checkout remains disabled.
The readiness helper reports missing or malformed settings by variable name
only and never returns credential values.

## Configuration checks

The optional settings are in `.env.example`:

- `PAYFAST_CHECKOUT_ENABLED` — explicit operator request; defaults to `false`
- `PAYFAST_MODE` — exactly `sandbox` or `live`
- `PAYFAST_MERCHANT_ID` — digits only
- `PAYFAST_MERCHANT_KEY` and `PAYFAST_PASSPHRASE` — required, bounded, and
  without control characters

Configuration validity is **not** evidence that PayFast is connected or that a
payment can be accepted. Keep all credentials in the deployment secret manager.
Do not put them in source control, client-side variables, URLs, logs, or support
messages. Do not change the public card-payment wording until a tested,
server-only integration is deployed.

## Blockers before an adapter can be safely enabled

No merchant account or provider credentials are configured, so sandbox account
setup, the actual PayFast notification contract for this merchant, and an
end-to-end verification cannot be completed. This change deliberately does not
create a checkout endpoint, payment table, or pretend-working adapter.

Before implementing that increment, settle and test all of the following:

1. Which specific, currently published **fixed-price** products may be bought
   directly. The catalogue also contains hourly rates, estimates, and
   scope-dependent offers; those are not valid arbitrary checkout amounts.
2. Whether invoice checkout is limited to the full, outstanding balance of an
   issued invoice. Partial payments and amounts supplied by the browser must
   not be accepted by default.
3. The provider notification and verification details for the merchant account,
   canonical public callback URLs, required payment statuses, and reconciliation
   handling.
4. A durable payment-attempt/notification record with unique provider and
   idempotency keys, safe replay handling, and an atomic connection to the
   existing invoice/receipt ledger and audit chain.

The future flow should be customer-initiated and use PayFast-hosted checkout so
the application never handles card numbers. It must re-read the published
catalogue price or authorized invoice balance on the server, verify provider
notifications before recognizing a receipt, and preserve the existing founder
delegation, anti-fraud, and audit controls. It must not trigger refunds,
payouts, recurring charges, or other automatic money movement. Quotes still
need written scope; this is not a quote or scope-approval mechanism.

Until those prerequisites are satisfied and the adapter's integration tests pass,
continue using the existing manual/EFT payment process.
