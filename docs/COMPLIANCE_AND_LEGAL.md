# COMPLIANCE AND LEGAL — Uganda Launch Checklist and Policy Skeletons

| Field | Value |
| :--- | :--- |
| **Status** | v1.1 working baseline — **not legal advice** |
| **Version** | 1.1.0 |
| **Date** | 2026-10-29 |
| **Owner** | Founders |
| **Required review** | Qualified Ugandan legal counsel and tax adviser before launch |
| **Related** | `AUDIT_REPORT.md` §12, `DECISIONS.md`, `OPERATIONS_RUNBOOK.md`, `ACCESSIBILITY.md` |

> **Important.** This document is an engineering compliance checklist and a set of policy skeletons. It is not a legal opinion. Every item marked `[[...]]` or “verify with counsel” must be completed and reviewed by a qualified Ugandan lawyer and, for tax items, a Ugandan tax adviser before the service accepts real customer payments. Do not publish the policy skeletons as-is.

---

## 1. Scope and legal inventory

The service is a direct-to-consumer food ordering, delivery, dine-in, and cash-reconciliation platform for **Bazaar Flame & Grill** in Kampala, Uganda. It processes customer contact data, delivery addresses, coarse and precise location, order history, payment references, staff identity data, rider telemetry, and SMS content.

### 1.1 Laws and regulators to confirm

| Area | Instrument / regulator | Applies to | Status |
| :--- | :--- | :--- | :--- |
| Data protection | Data Protection and Privacy Act, 2019; Data Protection and Privacy Regulations, 2021; Personal Data Protection Office (PDPO) | Customer, staff, rider, and vendor personal data | **Verify with counsel** |
| Electronic transactions | Electronic Transactions Act, 2011 | Online orders, electronic records, electronic signatures | **Verify with counsel** |
| Cybercrime | Computer Misuse Act, 2011 (as amended) | Unauthorised access, interception, abuse | **Verify with counsel** |
| Consumer sales | Sale of Goods and Supply of Services Act, Cap. 82; any consumer-protection legislation in force | Menu accuracy, delivery, refunds, complaints | **Verify with counsel** |
| Payments | National Payment Systems Act, 2020; Bank of Uganda rules; Flutterwave merchant terms | Mobile money, cards, settlement, refunds | **Verify with counsel** |
| Tax | VAT Act, Cap. 349; Tax Procedures Code Act, 2014; Income Tax Act, Cap. 340; URA guidance | VAT, EFRIS, receipts, records, withholding | **Verify with accountant** |
| AML / cash | Anti-Money Laundering Act, 2013 (as amended) and regulations | Cash handling, thresholds, record keeping | **Verify with counsel** |
| Food safety | Food and Drugs Act, Cap. 278; Public Health Act, Cap. 281; local authority rules | Kitchen, storage, delivery hygiene, permits | **Verify with counsel** |
| Licensing | Local Government Act; trade licensing; fire and health permits | Premises, signage, operations | **Verify with local authority** |
| Disability access | Persons with Disabilities Act, 2020 | Physical and digital access | **Verify with counsel** |
| Employment | Employment Act, 2006; NSSF Act; Occupational Safety and Health Act, 2006 | Staff and rider engagement | **Verify with counsel** |
| Intellectual property | Trademarks Act, 2010; Copyright and Neighbouring Rights Act, 2006 | Brand, photos, menu copy, software | **Verify with counsel** |

### 1.2 Launch legal gate

No production launch until all of the following are true:

- [ ] The legal entity, TIN, and trade licence are confirmed.
- [ ] Privacy policy, terms of service, refund policy, and delivery policy are reviewed and published.
- [ ] Data protection registration and DPO position are confirmed.
- [ ] VAT/EFRIS position is confirmed and receipt fields are implemented.
- [ ] Flutterwave merchant onboarding and settlement account are live.
- [ ] Vendor data-processing terms and cross-border transfer position are documented.
- [ ] Staff/rider contracts, confidentiality terms, and monitoring notices are signed.
- [ ] Insurance and food-safety permits are in place.
- [ ] A breach-response contact and escalation path are tested.

---

## 2. Data protection (DPPA) compliance

### 2.1 Roles and registrations

| Question | Required answer | Owner |
| :--- | :--- | :--- |
| Who is the data controller / data collector? | `[[legal entity]]` | Founder |
| Is registration with the PDPO required? | `[[yes/no + registration reference]]` | Founder + counsel |
| Is a Data Protection Officer required or appointed? | `[[name, contact, scope]]` | Founder |
| Who is the data processor for hosting, payments, SMS, maps, and caching? | See §9 vendor register | Founder + engineer |
| Is a DPIA required for location tracking, COD verification, or profiling? | `[[yes/no + summary]]` | Founder + counsel |
| Where is the record of processing activities kept? | `[[path / system]]` | Founder |

### 2.2 Lawful basis

| Processing | Proposed basis | Notes |
| :--- | :--- | :--- |
| Creating and fulfilling an order | Contract | Name, phone, address, order details, payment status. |
| Delivery and rider tracking | Contract / legitimate interest | Precise location only while an order is `OUT_FOR_DELIVERY`. |
| COD fraud prevention and OTP | Legitimate interest / legal obligation | Phone verification, blacklist, PIN attempts. |
| Transactional SMS | Contract / legitimate interest | Status updates; not marketing. |
| Marketing SMS or WhatsApp | Consent | Separate opt-in; never pre-ticked; withdrawal honoured. |
| Staff authentication and audit | Contract / legal obligation | Staff phone, role, login metadata, audit logs. |
| Tax and accounting records | Legal obligation | Retained for the statutory period. |
| Security logs and rate limiting | Legitimate interest | Minimised; hashed IP where possible. |

If consent is the basis, it must be freely given, specific, informed, unambiguous, and recorded with a timestamp and the exact wording shown.

### 2.3 Privacy notice — minimum content

The published privacy policy must state:

1. The legal entity, trading name, physical address, and contact details.
2. The categories of personal data collected.
3. The purposes and lawful basis for each category.
4. Whether providing data is required to fulfil an order.
5. Recipients and categories of recipients (payment, SMS, hosting, maps, support).
6. Cross-border transfer details and safeguards.
7. Retention periods or the criteria used to determine them.
8. Data-subject rights and how to exercise them.
9. The right to complain to the PDPO and the complaint contact.
10. Security measures in plain language.
11. Children’s data position.
12. Cookie and analytics position.
13. The date of the last update and how changes are notified.

### 2.4 Data inventory and retention

| Data category | Examples | Purpose | Proposed retention | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Customer identity | Name, phone | Order fulfilment, support | 7 years for financial records; shorter for marketing | `[[confirm]]` |
| Delivery data | Address text, area, coordinates | Delivery, dispute resolution | 2 years, then aggregate | `[[confirm]]` |
| Order data | Items, amounts, status, feedback | Fulfilment, accounting, analytics | 7 years | `[[confirm tax period]]` |
| Payment data | Provider reference, amount, status | Reconciliation, refunds, chargebacks | 7 years | Never store PAN/CVV. |
| Rider telemetry | Latest location, timestamp, order link | Live tracking, delivery proof | 30 days after delivery, then delete | `[[confirm]]` |
| PIN attempts | Success/failure, IP hash, user agent | Security, lockout, audit | 90 days | No raw PIN. |
| OTP records | Phone, code hash, expiry, attempts | COD verification | 24 hours after expiry | No plaintext code. |
| Staff data | Name, phone, role, plate, login metadata | Employment, access control | Employment + 7 years | `[[confirm]]` |
| Audit logs | Actor, action, before/after | Security, finance, disputes | 7 years | `[[confirm]]` |
| SMS outbox | Recipient, template, payload, status | Delivery, support | 90 days | Minimise content. |
| Device/security logs | IP hash, user agent, rate-limit events | Abuse prevention | 90 days | Hash where feasible. |
| Marketing consent | Phone, wording, timestamp, source | Consent evidence | Until withdrawal + 2 years | `[[confirm]]` |

A retention job or documented manual procedure must delete or anonymise data when the period ends. “Keep everything forever” is not a policy.

### 2.5 Data-subject rights procedure

| Right | Process | Target response |
| :--- | :--- | :--- |
| Access | Verify identity; export the customer’s orders and contact data | `[[30 days]]` — confirm statutory period |
| Correction | Correct name/phone/address; preserve audit trail | `[[30 days]]` |
| Deletion | Delete or anonymise where no legal retention obligation applies | `[[30 days]]` |
| Objection / restriction | Stop marketing or non-essential processing | Promptly |
| Consent withdrawal | Record withdrawal; stop the relevant processing | Promptly |
| Complaint | Provide PDPO contact and internal escalation | Acknowledge within `[[2 business days]]` |

Requests go to `[[privacy@domain]]` or the support WhatsApp. Staff must log the request, the verification method, the action taken, and the response date.

### 2.6 Consent wording (draft — counsel to review)

**Checkout / order fulfilment**

> I agree that Bazaar Flame & Grill may use my name, phone number, delivery address, and order details to prepare and deliver my order, and may share the minimum necessary details with the assigned rider and payment/SMS providers. I have read the Privacy Policy.

**Location**

> I agree that the rider app may use my device location while I am on an active delivery so the customer can see the rider’s latest position. Location is not collected when I am not on an active delivery. I can stop sharing by ending the delivery or closing the app, but the customer will then see only the last known location.

**Transactional SMS**

> I agree to receive order-status SMS messages on the phone number provided. These are not marketing messages.

**Marketing (separate, optional)**

> I agree to receive occasional offers and menu updates by SMS/WhatsApp. I can opt out at any time by replying STOP or contacting support. This does not affect order-status messages.

Do not bundle marketing consent with the terms of service. Do not pre-tick the marketing box.

### 2.7 Cross-border transfers

Supabase, Vercel, Flutterwave, Africa's Talking, MapTiler, Upstash, and the OSRM host may process or store data outside Uganda. Before launch:

- [ ] List each vendor’s processing region and sub-processors.
- [ ] Confirm the transfer mechanism and contractual safeguards.
- [ ] Record the position in the privacy policy.
- [ ] Prefer vendors and regions that minimise transfers.
- [ ] Confirm whether customer consent or a contract safeguard is required.

### 2.8 Security safeguards

- Encryption in transit (TLS) and at rest where the provider supports it.
- Deny-by-default database access; service-role key server-only.
- Staff least privilege and prompt deactivation on departure.
- Hashed IP addresses in security logs where feasible.
- No card data, CVV, or full PINs in logs.
- Audit trail for admin, refund, settlement, and PIN-reset actions.
- Backup and restore drills.
- Vendor access reviewed at least annually.
- Incident response tested at least once before launch.

### 2.9 Personal-data breach response

1. **Detect and contain** — revoke keys, disable the affected path, preserve evidence.
2. **Assess** — what data, how many people, likelihood of harm, whether the data was encrypted.
3. **Notify** — inform the founders and counsel immediately. Notify the PDPO and affected data subjects as required by law. Internal target: within 72 hours of confirmation; confirm the statutory deadline with counsel.
4. **Record** — timeline, facts, decisions, notifications, remediation.
5. **Review** — root cause, control changes, and a follow-up test.

Do not delete logs or rows to “clean up” before the facts are established.

### 2.10 Children and vulnerable customers

The service is intended for adults ordering food. Do not knowingly collect data from children. If a minor orders, require a parent or guardian to place the order. Do not use children’s data for marketing.

### 2.11 Cookies and analytics

- MVP uses only essential cookies/local storage for cart, session, and security.
- No advertising trackers.
- If analytics is added, use a consent banner that blocks non-essential scripts until consent.
- Document each cookie: name, purpose, duration, provider, essential/non-essential.
- Do not use session replay or heatmaps on checkout, payment, or staff pages.

---

## 3. Consumer protection and e-commerce

### 3.1 Pre-contract disclosure

Before the customer pays, show:

- Legal entity / trading name and physical address.
- Support phone/WhatsApp and hours.
- Item name, description, quantity, unit price, and line total in UGX.
- Modifiers and their prices.
- Delivery fee and packaging fee separately.
- Total payable, including taxes.
- Payment methods accepted.
- Estimated preparation and delivery time.
- Cancellation and refund policy link.
- Delivery area/zone and any restrictions.
- Whether the price includes VAT and how a receipt is issued.

### 3.2 Electronic contract

- The order confirmation page and SMS are the record of acceptance.
- Store the order token, timestamp, price snapshot, and terms version accepted.
- Do not change the price after acceptance except by an explicit, audited correction.
- Keep electronic records in a form that can be reproduced.

### 3.3 Fairness rules

- No hidden fees at the final step.
- No fake “only 1 left” urgency.
- No pre-ticked paid extras.
- No misleading “free delivery” if packaging or another fee applies.
- Show sold-out items as unavailable; do not accept an order you cannot fulfil.
- Honour the displayed price if the error is obvious and the customer relied on it; escalate to a founder.

### 3.4 Delivery terms

State clearly:

- Delivery zones and the maximum radius.
- Fee formula and free-delivery radius.
- COD availability and maximum COD radius.
- Estimated time is an estimate, not a guarantee.
- What happens if the customer is unreachable.
- Who bears the risk of loss after handover.
- Address-change rules and any additional fee.
- Rider handover PIN requirement.

### 3.5 Cancellation and refund matrix

| Stage | Customer cancellation | Refund | Notes |
| :--- | :--- | :--- | :--- |
| Before payment | Allowed | No charge | Order not created or cancelled. |
| Paid, before kitchen accept | Allowed | Full refund | Refund to original method. |
| Kitchen accepted, before cooking | Case-by-case | Full or partial | Food-cost review. |
| Cooking started | Not normally allowed | Founder approval | Document reason. |
| Out for delivery | Not allowed | Case-by-case | Failed delivery policy applies. |
| Delivered, wrong/missing item | Report within `[[2 hours]]` | Replacement or partial refund | Photo/evidence may be requested. |
| Duplicate charge | Allowed | Full duplicate refund | Verify with provider. |
| Provider outage | Order not confirmed | No charge / full refund | Do not mark paid manually. |

Refund timelines must be realistic: mobile money and card refunds depend on Flutterwave and the issuer. State “up to `[[N]]` business days after approval” and do not promise instant settlement unless the provider confirms it.

### 3.6 Complaints and disputes

- First response target: `[[2 business hours]]` during opening hours.
- Resolution target: `[[2 business days]]` for order issues; `[[10 business days]]` for payment investigations.
- Escalation: `[[manager name/phone]]`.
- If unresolved, the customer may complain to the relevant regulator; provide the contact.
- Governing law: `[[Uganda]]`; courts: `[[competent courts of Uganda]]`.
- Do not use a clause that removes the customer’s statutory rights.

### 3.7 Accessibility

The product targets **WCAG 2.2 AA** as an engineering standard (`ACCESSIBILITY.md`). This is a quality commitment, not a claim of legal certification. Confirm whether the Persons with Disabilities Act, 2020 imposes additional duties on the business or premises.

---

## 4. Payments, cash, and financial controls

### 4.1 Flutterwave merchant requirements

- [ ] Merchant account approved for the correct legal entity.
- [ ] Settlement bank account verified in the business name.
- [ ] Live public/secret keys and webhook hash stored in the hosting secret manager.
- [ ] Webhook endpoint uses HTTPS and verifies `verif-hash`.
- [ ] Every successful webhook is verified with `/v3/transactions/{id}/verify`.
- [ ] Refund and chargeback contacts recorded.
- [ ] Settlement report reconciled to orders daily.
- [ ] Payment fees and FX treatment understood.

### 4.2 PCI DSS position

The MVP uses Flutterwave hosted checkout / redirect. The intended scope is **SAQ A** (card data never enters the application). Confirm with Flutterwave and the acquirer.

Hard rules:

- Never store, log, or transmit card numbers, CVV, or full track data.
- Never accept card details in a custom form.
- Use provider-hosted pages or provider tokens only.
- Redact payment payloads in logs.
- Restrict access to the Flutterwave dashboard.
- Review the SAQ A attestation annually or when the integration changes.

### 4.3 Mobile money

- Confirm MTN MoMo and Airtel Money availability and limits.
- Show the customer the exact amount and currency before redirect.
- Treat the provider’s verification response as the source of truth.
- Do not mark an order paid from a redirect alone.
- Reconcile provider fees and settlement amounts.
- Handle pending, failed, abandoned, and reversed transactions.

### 4.4 Cash handling

- Issue a receipt for every cash order.
- Record the amount collected and change given.
- Reconcile each rider at the end of the business day (`Africa/Kampala`).
- Investigate every variance before releasing the rider.
- Set a maximum cash-in-hand limit and a drop/settlement schedule.
- Confirm AML/CFT cash thresholds and reporting duties with counsel.
- Do not allow a rider to “carry over” an unexplained shortage without an approved note.

### 4.5 Pricing and tax display

- All prices are integer UGX.
- State whether displayed prices include VAT.
- Show delivery and packaging separately.
- Do not add a fee that was not disclosed before payment.
- If VAT applies, the receipt must show the VAT amount and the VAT registration number.
- If EFRIS applies, the receipt must show the EFRIS details required by URA.

### 4.6 Fraud controls

- COD OTP and blacklist.
- Velocity limits per phone/IP.
- Handover PIN lockout and geofence.
- Admin approval for refunds above `[[amount]]`.
- Duplicate-payment detection.
- Chargeback evidence pack: order, delivery proof, PIN verification, customer communication, refund history.
- Rider cash-shortage and collusion investigation procedure.

---

## 5. Tax and EFRIS

> Confirm every item in this section with a Ugandan tax adviser. Tax law and URA operational guidance change.

### 5.1 Registration and treatment

| Question | Answer / placeholder | Owner |
| :--- | :--- | :--- |
| Legal entity and TIN | `[[...]]` | Founder |
| VAT registration status | `[[registered / not registered]]` | Founder + accountant |
| VAT number | `[[...]]` | Founder |
| VAT rate | `[[18% / other]]` | Accountant |
| Are menu prices VAT-inclusive? | `[[yes/no]]` | Founder |
| EFRIS onboarding status | `[[not started / in progress / live]]` | Founder + accountant |
| EFRIS invoice fields | `[[...]]` | Accountant |
| Credit-note process for refunds | `[[...]]` | Accountant |
| Record-retention period | `[[5/6/7 years]]` | Accountant |
| Withholding tax obligations | `[[...]]` | Accountant |
| Digital-service tax / other levies | `[[...]]` | Accountant |
| Monthly/quarterly filing owner | `[[name]]` | Founder |

### 5.2 Receipt fields (draft)

- Legal entity name and trading name.
- TIN and VAT number (if registered).
- EFRIS invoice number / QR / verification code as required.
- Date and time in EAT.
- Order number and order token (not the PIN).
- Item descriptions, quantities, unit prices, line totals.
- Modifiers and their prices.
- Delivery fee and packaging fee.
- VAT amount and taxable amount (if applicable).
- Total paid and payment method.
- “Thank you” and support contact.
- Refund/returns statement.

### 5.3 EFRIS operating rules

- Every VAT sale must generate a valid EFRIS receipt.
- Refunds and cancellations require a credit note or the URA-approved correction.
- Do not issue a receipt for an order that was not paid.
- Do not reuse an invoice number.
- Keep the EFRIS response and the order linked.
- If EFRIS is down, follow URA’s fallback procedure; do not invent a receipt.
- Reconcile EFRIS totals to the order ledger monthly.

---

## 6. Employment, riders, and workplace

### 6.1 Rider engagement

- Decide whether riders are employees or independent contractors, with counsel.
- Written agreement covering pay, hours, safety, equipment, cash handling, confidentiality, and termination.
- Valid riding licence, motorcycle registration, and insurance.
- Helmet and safety equipment.
- Training on food hygiene, customer conduct, PIN handover, and cash.
- No unlawful deduction from pay; document any cash-shortage recovery.
- GPS/location monitoring notice and consent.
- Incident and injury reporting.

### 6.2 Staff

- Written employment or contractor terms.
- Confidentiality and IP assignment.
- Background checks only where lawful and necessary.
- Unique staff accounts; no shared logins.
- Prompt deactivation on departure.
- PIN rotation after suspected compromise.
- Monitoring/CCTV notice where applicable.
- Payroll, NSSF, and statutory deductions as advised.

### 6.3 Food safety and premises

- Valid food-handling permits and health certificates.
- Pest control, cleaning, and temperature logs.
- Allergen matrix and cross-contamination controls.
- Packaging suitable for hot food and delivery.
- Delivery bag cleaning schedule.
- Recall/withdrawal procedure and customer communication.
- Fire safety, gas, electrical, and first-aid controls.
- Waste disposal and oil disposal.

---

## 7. Intellectual property and brand

- [ ] Trademark search and filing for the name and logo.
- [ ] Logo ownership and designer assignment.
- [ ] Photo releases for dish images and staff photos.
- [ ] Font licences (or use Google Fonts under their terms).
- [ ] Open-source licence review for all dependencies.
- [ ] Map attribution and provider terms.
- [ ] Domain, DNS, social handles, and GitHub organisation owned by the business.
- [ ] Menu copy and recipes owned by or licensed to the business.
- [ ] No use of another restaurant’s images or trademarks.

---

## 8. Vendor and contract register

| Vendor | Service | Personal data | Region | Contract / DPA | Owner | Renewal | Exit plan |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Supabase | Postgres, Auth, Storage, Realtime | Customer, staff, orders, telemetry | `[[region]]` | `[[status]]` | Founder | `[[date]]` | Export + restore |
| Vercel | Hosting, edge, logs | IP, request metadata | `[[region]]` | `[[status]]` | Founder | `[[date]]` | Redeploy elsewhere |
| Flutterwave | Payments, refunds | Name, phone, amount, transaction | `[[region]]` | `[[status]]` | Founder | `[[date]]` | Reconcile + switch provider |
| Africa's Talking | SMS, OTP | Phone, message content | `[[region]]` | `[[status]]` | Founder | `[[date]]` | Switch SMS provider |
| MapTiler | Map tiles | IP, map requests | `[[region]]` | `[[status]]` | Founder | `[[date]]` | Self-host / switch |
| Upstash | Redis rate limits | IP hash, counters | `[[region]]` | `[[status]]` | Founder | `[[date]]` | DB-backed fallback |
| OSRM host | Routing | Coordinates | `[[region]]` | `[[status]]` | Engineer | `[[date]]` | Rebuild container |
| GitHub | Source control | Staff identity | `[[region]]` | `[[status]]` | Founder | `[[date]]` | Export repository |
| Domain registrar | DNS / TLS | None | `[[region]]` | `[[status]]` | Founder | `[[date]]` | Transfer domain |
| Monitoring | Errors / uptime | Logs, IP | `[[region]]` | `[[status]]` | Engineer | `[[date]]` | Export + replace |

---

## 9. Policy skeletons

These are drafting aids. Replace every placeholder, then have counsel review.

### 9.1 Privacy Policy — skeleton

1. **Who we are** — `[[legal entity]]`, trading as `[[name]]`, `[[address]]`, `[[TIN]]`.
2. **Contact** — `[[privacy contact]]`, `[[phone]]`, `[[email]]`.
3. **Scope** — website, ordering, delivery, dine-in, rider, support.
4. **Data we collect** — identity, contact, order, payment reference, location, device, feedback, staff/rider data.
5. **Why we collect it** — fulfil orders, deliver, verify COD, prevent fraud, support, tax, improve the service.
6. **Lawful basis** — contract, legal obligation, legitimate interest, consent.
7. **Who we share it with** — payment, SMS, hosting, maps, rider, professional advisers, regulators.
8. **Cross-border transfers** — `[[vendors/regions/safeguards]]`.
9. **Retention** — `[[periods or criteria]]`.
10. **Your rights** — access, correction, deletion, objection, withdrawal, complaint.
11. **Security** — `[[summary]]`.
12. **Cookies** — `[[essential/non-essential]]`.
13. **Children** — not directed to children; guardian required.
14. **Changes** — date, notice method.
15. **Complaints** — PDPO contact and internal escalation.

### 9.2 Terms of Service — skeleton

1. **Acceptance** — by ordering, you agree to these terms.
2. **The service** — ordering, delivery, dine-in, availability, service area.
3. **Eligibility** — 18+ or guardian; accurate information.
4. **Account / order token** — customer is responsible for the token; staff accounts are individual.
5. **Prices and payment** — UGX, taxes, fees, payment methods, authorization.
6. **Order acceptance** — order is confirmed when accepted; we may refuse unlawful, abusive, or unfulfillable orders.
7. **Delivery** — estimates, zones, COD limits, handover PIN, failed delivery.
8. **Cancellation and refunds** — link to the policy.
9. **Food and allergens** — descriptions, allergen information, cross-contamination.
10. **Acceptable use** — no fraud, abuse, scraping, interference, or false orders.
11. **Intellectual property** — ownership and limited licence.
12. **Liability** — to the extent permitted by law; do not exclude non-excludable rights.
13. **Indemnity** — `[[counsel to draft]]`.
14. **Governing law and disputes** — Uganda; `[[courts]]`.
15. **Contact** — `[[...]]`.
16. **Changes** — notice and effective date.

### 9.3 Refund and Cancellation Policy — skeleton

- **Before payment** — no charge.
- **After payment, before acceptance** — full refund.
- **After acceptance, before cooking** — `[[full/partial]]`.
- **After cooking** — `[[case-by-case]]`.
- **Out for delivery** — `[[case-by-case]]`.
- **Delivered, wrong/missing** — report within `[[2 hours]]`; replacement or refund.
- **Failed delivery** — `[[redelivery/refund]]`.
- **Payment failure** — no order; retry.
- **Duplicate charge** — full refund of the duplicate.
- **Refund method** — original payment method where possible; cash refunds `[[process]]`.
- **Timeline** — `[[N]]` business days after approval.
- **How to request** — `[[support channel]]`.
- **Escalation** — `[[manager/regulator]]`.

### 9.4 Delivery Policy — skeleton

- Delivery zones and map.
- Fee formula, free radius, maximum radius.
- COD availability and maximum radius.
- Preparation and delivery estimates.
- Handover PIN requirement.
- Customer responsibilities: reachable phone, correct address, change ready.
- Failed delivery: waiting time, redelivery fee, refund.
- Address changes: before dispatch only; `[[fee]]`.
- Rider safety and conduct.
- Risk/title transfer.
- Weather/traffic/force majeure.

### 9.5 Cookie Policy — skeleton

| Cookie / storage | Purpose | Duration | Essential? |
| :--- | :--- | :--- | :--- |
| `cart` | Cart contents | Session | Yes |
| `order_token` | Order tracking capability | `[[...]]` | Yes |
| `staff_session` | Staff authentication | 12 hours | Yes |
| `[[analytics]]` | Usage analytics | `[[...]]` | No — consent required |
| `[[marketing]]` | Advertising | `[[...]]` | No — consent required |

MVP should have no non-essential cookies. If analytics is added, update this table and the consent banner.

### 9.6 Data Retention Policy — skeleton

- State each category and period from §2.4.
- State the deletion method (hard delete, anonymise, aggregate).
- State who approves exceptions (legal hold, dispute, tax).
- State the review cadence (annual).
- State how backups are handled (retention window, restore then delete).

### 9.7 Incident and Breach Policy — skeleton

- Roles: incident lead, technical lead, communications lead, legal counsel.
- Severity levels.
- Detection and containment.
- Evidence preservation.
- Assessment and notification decision.
- PDPO/data-subject notification.
- Customer communication template.
- Post-incident review and control changes.
- Regulatory and insurer notification.

### 9.8 Staff and Rider Privacy Notice — skeleton

- What data is collected: identity, contact, role, plate, login, location, cash records.
- Why: employment/contract, access control, safety, payroll, audit.
- Monitoring: GPS while on delivery, CCTV `[[areas]]`, device logs.
- Who sees it: admin, payroll, accountant, regulators.
- Retention.
- Rights and contact.
- Confidentiality and acceptable use.

---

## 10. Legal action register (founder-owned)

| ID | Action | Owner | Blocks | Status |
| :--- | :--- | :--- | :--- | :--- |
| L-01 | Confirm legal entity, trading name, TIN, address | Founder | Launch | Open |
| L-02 | Confirm trade, food, fire, and liquor licences | Founder | Launch | Open |
| L-03 | Confirm insurance cover | Founder | Launch | Open |
| L-04 | Confirm VAT registration and EFRIS onboarding | Founder + accountant | Phase 6 / launch | Open |
| L-05 | Approve tax-inclusive pricing and receipt fields | Founder + accountant | Phase 6 | Open |
| L-06 | Confirm record-retention periods | Founder + accountant | Phase 6 | Open |
| L-07 | Confirm PDPO registration and DPO position | Founder + counsel | Launch | Open |
| L-08 | Review and publish privacy policy | Founder + counsel | Launch | Open |
| L-09 | Review and publish terms of service | Founder + counsel | Launch | Open |
| L-10 | Review and publish refund/cancellation policy | Founder + counsel | Launch | Open |
| L-11 | Review and publish delivery policy | Founder + counsel | Launch | Open |
| L-12 | Confirm cross-border transfer position and vendor DPAs | Founder + counsel | Launch | Open |
| L-13 | Approve breach-response and notification procedure | Founder + counsel | Launch | Open |
| L-14 | Confirm AML/cash-handling policy | Founder + counsel | Launch | Open |
| L-15 | Confirm PCI/SAQ A position with Flutterwave | Founder | Phase 6 | Open |
| L-16 | Approve chargeback/refund authority limits | Founder | Phase 6 | Open |
| L-17 | Sign staff/rider contracts and confidentiality terms | Founder | Launch | Open |
| L-18 | Approve monitoring/CCTV/GPS notices | Founder + counsel | Launch | Open |
| L-19 | Confirm allergen/dietary information | Founder + kitchen | Phase 2 | Open |
| L-20 | Confirm brand/IP ownership and licences | Founder | Launch | Open |
| L-21 | Confirm governing law and dispute clause | Founder + counsel | Launch | Open |
| L-22 | Complete final legal review sign-off | Founder + counsel | Launch | Open |

---

## 11. Launch legal checklist

- [ ] Entity, TIN, address, and licences verified.
- [ ] Insurance verified.
- [ ] VAT/EFRIS position implemented and tested.
- [ ] Receipt fields match URA requirements.
- [ ] Privacy policy published and linked at checkout.
- [ ] Terms of service published and linked at checkout.
- [ ] Refund/cancellation policy published and linked at checkout.
- [ ] Delivery policy published.
- [ ] Cookie/analytics position implemented.
- [ ] Consent wording implemented and logged.
- [ ] Data-subject request channel live.
- [ ] Retention/deletion job configured.
- [ ] Vendor DPAs and cross-border position recorded.
- [ ] Breach-response contacts tested.
- [ ] Staff/rider contracts and notices signed.
- [ ] PCI/SAQ A position confirmed.
- [ ] AML/cash policy approved.
- [ ] Chargeback/refund limits configured.
- [ ] Brand/IP licences recorded.
- [ ] Legal review sign-off recorded in the launch ticket.

---

## 12. Revision history

| Version | Date | Change |
| :--- | :--- | :--- |
| 1.1.0 | 2026-10-29 | Created; Uganda compliance checklist, data inventory, policy skeletons, and legal action register. |
