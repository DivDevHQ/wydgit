# Wydgit Identity Assurance and Verifiable Minimal Disclosure Specification

**Status:** Proposed Architecture — Not Yet Implemented  
**Repository path:** `docs/wydgit-identity-assurance-spec.md`  
**Applies to:** VMD, AgePass, Wydgate, SEAM, Wydgine, WydClient, Applicert, DivDev Studio, and future credential services

## 1. Purpose

This specification defines a universal identity-assurance and **Verifiable Minimal Disclosure (VMD)** infrastructure for the Wydgit platform.

VMD enables applications to obtain trustworthy answers about a user's attributes or eligibility without unnecessarily obtaining, revealing, storing, or retaining the underlying personal information.

For example, a website may need to establish whether a visitor is at least 18 years old. It generally does not need the visitor's name, date of birth, address, or identity-document image.

The preferred response is a verifiable assertion about eligibility rather than disclosure of the underlying identity.

**Core principle: Prove what is necessary without disclosing what is unnecessary.**

VMD shall be a universal Wydgit service. It shall not be owned by, or restricted to, the Wydgate membership system.

AgePass is an age-assurance application of VMD. Wydgate is a potential consumer of VMD results. SEAM remains responsible for enforcing application authority.

## 2. Architectural principles

1. **Data minimization:** Request, process, disclose, and retain only information necessary for the authorized purpose.
2. **Separation of responsibilities:** Credential issuance, verification, membership, policy evaluation, and capability enforcement remain distinct operations.
3. **Interoperability:** Support multiple credential issuers, wallets, verification protocols, and jurisdiction-specific assurance mechanisms.
4. **User privacy:** Avoid exposing identity attributes when a verifiable eligibility assertion is sufficient.
5. **No universal tracking identifier:** Independent relying parties must not automatically receive a shared, correlatable subject identifier.
6. **Explicit trust:** Cryptographic validity, issuer recognition, issuer trust, evidence quality, and authorization are distinct.
7. **Fail closed:** Invalid, expired, unsupported, untrusted, or insufficient evidence must never silently produce a successful verified assertion.
8. **Consent and transparency:** Users should understand the requested claim and the disclosure being made, subject to applicable law and protocol requirements.
9. **Least privilege:** VMD verification does not automatically grant application capabilities.
10. **Portable integration:** Both server-side Wydgine applications and supported browser workflows may use VMD through controlled interfaces.
11. **Standards-first:** Prefer interoperable established standards rather than inventing proprietary credential cryptography.
12. **Jurisdiction awareness:** Applicable age thresholds, assurance levels, and permitted evidence methods must be configurable under policy.

VMD must not become a centralized database of everyone who visits a Wydgit-powered application.

---

## 3. Architectural boundaries

The platform distinguishes five primary responsibilities.

| Component | Responsibility |
|---|---|
| **VMD** | Validate evidence and produce narrowly scoped verification assertions |
| **AgePass** | Obtain or issue eligible age-assurance credentials or assertions |
| **Wydgate** | Membership, accounts, sessions, authentication, and access-policy decisions |
| **SEAM** | Enforce permissions and capabilities governing Wydgit execution and resources |
| **Wydgine / WydClient** | Execute authorized application behavior and consume appropriate results |

These boundaries are fundamental.

VMD is not a replacement for Wydgate authentication.

A verified age threshold does not establish a named identity or prove ownership of an existing account.

Wydgate may require authentication independently of any VMD eligibility proof.

Likewise, successful VMD verification does not bypass SEAM.

## 4. Universal VMD service

VMD shall expose a versioned canonical service through Wydgit's controlled service interface.

The exact service registration syntax and API transport contract remain implementation decisions.

The conceptual service identity is:

`vmd`

Initial operations may include:

| Operation | Purpose |
|---|---|
| `describeRequirements` | Return supported claim requirements and acceptable evidence categories |
| `beginVerification` | Establish a scoped verification challenge |
| `verifyPresentation` | Validate a supplied credential or supported assurance signal |
| `evaluateAssertion` | Determine whether verified evidence satisfies a specified requirement |
| `getVerificationStatus` | Check the status of an authorized pending verification |
| `invalidateVerification` | Invalidate a local verification session or assertion |
| `getProviderCapabilities` | Discover supported evidence adapters without exposing provider secrets |

These names are proposed, not implemented.

### 4.1 Conceptual verification request

```json
{
  "schema": "vmd.request/0.1",
  "claim": "age.at_least",
  "parameters": {
    "years": 18
  },
  "purpose": "restricted_content_access",
  "audience": "example-site",
  "requiredAssurance": "policy:age-high"
}
```

The request identifies what must be proven, why it is required, and the relying-party context.

Claim vocabulary, assurance identifiers, audience binding, and policy identifiers require formal definitions before implementation.

### 4.2 Conceptual verification result

```json
{
  "schema": "vmd.result/0.1",
  "claim": "age.at_least",
  "parameters": {
    "years": 18
  },
  "verified": true,
  "assurance": "policy:age-high",
  "audience": "example-site",
  "expiresAt": "2027-01-01T00:00:00.000Z"
}
```

This example is illustrative.

A production result must be bound to its actual request and verification context, and must not be accepted merely because a caller supplies JSON containing `verified: true`.

A verifiable assertion requires trusted origin and integrity, and where applicable proof of possession, freshness, challenge binding, audience binding, and replay protection.

Any assertion expiry must derive from the verified evidence and applicable policy rather than an arbitrary client-provided value.

### 4.3 Verification outcomes

The system must distinguish at least:

- **Verified:** The requested claim has been established to the required assurance level.
- **Not satisfied:** Valid evidence establishes that the claim is not met.
- **Insufficient evidence:** Available evidence does not support the required conclusion.
- **Untrusted evidence:** The issuer, credential, presentation, or method fails trust requirements.
- **Expired or revoked:** Evidence is no longer acceptable.
- **Verification error:** A technical failure prevented a reliable determination.

A failure to prove adulthood must not automatically be interpreted as proof that someone is a minor.

---

## 5. AgePass integration

AgePass shall be a reusable age-assurance provider and consumer of VMD functionality.

It may support document-based verification, privacy-preserving age credentials, or approved external assurance methods.

Its responsibilities include:

- Establishing age eligibility from authorized evidence.
- Protecting sensitive evidence during processing.
- Issuing or obtaining appropriately scoped credentials or assertions.
- Supporting required expiry, renewal, and revocation behavior.
- Avoiding unnecessary retention of identity documents.
- Interoperating with the universal VMD verification interface.

### 5.1 Document handling

If AgePass processes identity-document images, the architecture should minimize processing and retention.

Deletion of the uploaded image after verification is a preferred policy, subject to applicable legal, fraud-prevention, and operational obligations.

The architecture must not claim that deleting an uploaded image guarantees that no copies remain in upstream providers, backups, logs, or processing systems.

Any permitted retention must be explicitly documented and appropriately protected.

### 5.2 No mandatory AgePass monopoly

A Wydgit application must not be required to use AgePass when an acceptable external credential or assurance signal is available.

VMD should be able to verify evidence from independent trusted providers.

AgePass should compete through reliability, privacy, usability, interoperability, and assurance quality—not exclusive control of Wydgit identity verification.

---

## 6. Wydgate integration

Wydgate consumes VMD assertions to make membership and access decisions.

For example, Wydgate may require:

- Authenticated membership.
- Verified age eligibility.
- An approved assurance level.
- An unexpired session.
- Additional application-specific conditions.

These requirements remain separate.

A member may be authenticated without having proven the required age.

A visitor may prove adulthood without creating an account.

A user may meet an age requirement without disclosing a legal identity.

### 6.1 Pseudonymous membership

Where supported, Wydgate may associate a verification with a relying-party-scoped pseudonymous membership identity.

The same user must not automatically receive a globally correlatable identifier across unrelated sites.

Stable pseudonyms should be introduced only when needed for legitimate application functionality, such as maintaining an account or enforcing authorized account restrictions.

Unlinkability should be evaluated against the actual credential and issuer architecture, including timing, reuse, metadata, network identifiers, and collusion risks.

### 6.2 Assertion reuse

A successful verification may be reusable within an authorized scope and lifetime.

Reuse must respect:

- Audience restrictions.
- Verification expiry.
- Issuer revocation or status changes.
- Assurance requirements.
- Relying-party policy.
- Replay protections.
- User privacy expectations.

A reusable result must not become an unrestricted cross-site tracking token.

---

## 7. SEAM integration

SEAM remains the final authority for application capabilities.

VMD establishes facts or eligibility assertions.

Wydgate and other authorized policy consumers decide what those assertions permit.

SEAM enforces the resulting resource and operation permissions.

For example:

1. An application requests access to age-restricted content.
2. Its access policy requires an acceptable 18+ assertion.
3. VMD validates the necessary evidence.
4. The policy engine evaluates the verified result.
5. SEAM enforces access to the protected operation or resource.

A third-party Wydgit must not be able to bypass the age gate by calling an unprotected alternate method, reading raw verification records, or forging a result object.

### 7.1 Capability restrictions

VMD verification must not grant unrestricted:

- File access.
- Database access.
- Membership administration.
- Network access.
- Cross-site identity correlation.
- Access to identity documents.
- Credential issuance authority.
- Issuer trust-store management.

These remain separately authorized capabilities.

### 7.2 Trusted enforcement boundary

For protected server resources, final authorization must occur within a trusted server-side enforcement boundary.

A browser-side assertion or display control alone is insufficient to protect server-side data.

---

## 8. Credential and evidence adapters

VMD should support multiple independently versioned evidence adapters.

An adapter translates a supported external credential or assurance signal into a validated internal evidence result.

Proposed adapter categories include:

| Category | Example |
|---|---|
| Cryptographic age credentials | EU-compatible age attestations and wallet presentations |
| Independent verification | AgePass or comparable providers |
| Device or app-store signals | Jurisdictionally recognized age-bracket signals |
| Institutional credentials | Future Applicert qualifications |
| Other attribute credentials | Future authorized identity or eligibility assertions |

### 8.1 Adapter responsibilities

An adapter must define:

- Credential format and supported protocol versions.
- Trust-anchor and issuer verification mechanisms.
- Proof validation.
- Audience and challenge binding where applicable.
- Expiration and revocation checking.
- Assurance properties and limitations.
- Attribute-disclosure requirements.
- Privacy implications.
- Error handling.
- Applicable platform capabilities.

Adapters cannot unilaterally declare themselves trusted.

### 8.2 No arbitrary trust escalation

Evidence from a low-assurance mechanism must not be automatically upgraded into a high-assurance result.

For example, a self-reported age band must not silently become equivalent to an independently verified government-document credential.

Policy must distinguish evidence strength from the conclusion being evaluated.

---

## 9. European Union considerations

VMD should be designed for compatibility with relevant European age-assurance and digital-identity standards.

The architecture should accommodate:

- Privacy-preserving age-threshold proofs.
- Trusted issuer and verifier roles.
- European Digital Identity Wallet interoperability where applicable.
- Selective disclosure or unlinkable presentation mechanisms when supported.
- Credential validity, revocation, and audience restrictions.
- Data-minimization and privacy obligations.
- Applicable platform and content-specific age-assurance requirements.

The EU's age-verification approach is a useful interoperability target, not permission to claim automatic compliance.

The exact credential formats, trust lists, certification requirements, and implementation obligations must be confirmed against authoritative specifications when this integration is scheduled.

VMD must not presume that every EU wallet credential is automatically appropriate for every relying-party purpose.

---

## 10. Australia considerations

VMD should support jurisdiction-specific age requirements, including thresholds below 18.

Australian requirements may apply differently to social-media platforms, restricted content, and other services.

A covered application may require evidence that a user meets a 16+ threshold, depending on the applicable legal obligation.

The verification policy must specify:

- The relevant threshold.
- The category of regulated service.
- Accepted assurance methods.
- Required confidence or assurance.
- User privacy protections.
- Applicable recordkeeping and retention rules.
- Treatment of inconclusive verification.

No single universal age-pass rule should be assumed to satisfy every Australian obligation.

---

## 11. California considerations

VMD should support age-bracket signals where required or accepted by applicable California law.

Age-bracket signals may originate from operating systems, app stores, or other regulated providers.

These signals are not necessarily equivalent to cryptographically verified age credentials.

The adapter must preserve the evidence's original assurance properties and provenance.

A California-specific policy can determine whether the received signal is sufficient for a particular application requirement.

Implementation planning must verify the law's effective dates, applicability, technical interfaces, litigation status, and current regulatory guidance.

The system must not silently promote an age-bracket signal into a verified legal identity.

---

## 12. Generalized VMD claim model

VMD should not be restricted to age verification.

Potential claims include:

```text
age.at_least
age.within_band
credential.valid
qualification.held
membership.eligible
residency.requirement_met
authorization.requirement_met
```

These are prospective claim names, not an implemented registry.

Every claim type requires formally specified semantics.

A claim must define:

- Permitted input evidence.
- Evaluation rules.
- Required assurance properties.
- Disclosure and retention requirements.
- Expiration and revocation behavior.
- Supported relying-party contexts.
- Failure and uncertainty handling.

A Boolean result is appropriate only when the underlying requirement can safely be represented by a Boolean.

VMD must not reduce complex or legally nuanced decisions to misleading unqualified `true`/`false` responses.

### 12.1 Applicert

Applicert may use VMD to prove that an individual possesses an acceptable qualification without revealing unrelated educational or employment history.

For example, an application might require proof of a particular certification rather than a complete résumé.

Verification of a credential must not automatically establish that the individual is suitable or legally authorized for every activity associated with it.

### 12.2 MedPass and sensitive credentials

Any future health-related credential integration requires substantially stricter privacy analysis.

VMD must not treat sensitive medical attributes as ordinary public profile fields.

Claims involving medical records, diagnoses, prescriptions, or disabilities require explicit legal, security, consent, and purpose-limitation review.

Such integrations are deferred.

---

## 13. Privacy and data lifecycle

VMD must distinguish between:

1. Raw identity or credential evidence.
2. Verified attributes.
3. Derived eligibility assertions.
4. Membership/session identifiers.
5. Security and operational audit records.

These categories should not be collapsed into one general user profile.

### 13.1 Data minimization

Raw evidence should be processed only when necessary.

Whenever technically and legally possible, the relying party should receive only the final necessary assertion.

Third-party Wydgits must not receive identity-document images merely because they requested age verification.

### 13.2 Storage and retention

Retention rules must be explicit for every evidence category.

Policies must address:

- Temporary processing.
- Storage encryption.
- Key management.
- Log redaction.
- Backup retention.
- Deletion and expiry.
- Credential status checks.
- Access auditing.
- Incident response.

Avoid recording reusable personal identifiers in general application logs.

### 13.3 Consent and user experience

Verification workflows should clearly explain:

- What is being requested.
- Why it is required.
- Which attributes will be disclosed.
- Whether the resulting assertion will be retained.
- The available alternative methods.
- The consequences of declining where applicable.

User consent is not a substitute for an appropriate lawful processing basis or other mandatory protections.

---

## 14. Threat model

The implementation must consider at least these threats:

| Threat | Required architectural response |
|---|---|
| Forged verification result | Trusted result provenance and integrity |
| Credential replay | Freshness, nonce/challenge, and audience controls |
| Cross-site tracking | Scoped pseudonyms and unlinkable mechanisms |
| Untrusted issuer | Explicit trust-policy enforcement |
| Revoked credential | Status validation under applicable policy |
| Downgraded assurance | Preserve actual evidence quality |
| Library privilege laundering | SEAM enforcement independent of VMD |
| Malicious third-party Wydgit | Deny raw evidence and unauthorized verification APIs |
| Excessive disclosure | Claim-specific minimization rules |
| Compromised provider | Revocation, isolation, monitoring, and incident handling |
| Verification denial of service | Bounded work, quotas, and controlled external calls |
| Misleading Boolean results | Explicit inconclusive and error states |

A successful signature check alone must not be treated as a complete identity-assurance decision.

---

## 15. Auditing and accountability

The platform needs sufficient auditability to demonstrate enforcement and investigate abuse without creating a universal record of user identity checks.

Security audit records should emphasize:

- Relying-party identity.
- Requested claim category.
- Applicable policy and version.
- Provider category.
- Verification outcome.
- Time and expiry.
- Relevant security failures.

Raw document images, full credential contents, and unnecessary personal attributes should not appear in ordinary audit logs.

Audit retention must be purpose-limited, access-controlled, and subject to applicable legal requirements.

Cryptographic verification, policy evaluation, and capability authorization should be independently observable for troubleshooting without exposing sensitive evidence.

---

## 16. Package and service architecture

The core VMD engine should use Wydgit's versioned canonical service infrastructure.

Supporting providers and adapters may be distributed as appropriate Wydgit packages, subject to:

- Publisher provenance.
- Dependency validation.
- Explicit permissions.
- SEAM authorization.
- Package integrity and trust.
- Adapter-specific security requirements.

Future static Wydgit libraries may expose convenient APIs over VMD.

For example, a proposed facade might eventually provide:

```vb
WITH LIBRARY divdev/vmd

DIM result = VMD.VerifyAge(18)
```

This is illustrative, not currently supported syntax or a finalized API.

**A static library facade must not replace the trusted verifier or become the authority deciding whether evidence is acceptable.**

The service must remain protected even when called through convenient WBasic wrappers.

Browser applications may participate in wallet presentation workflows, but privileged trust decisions must remain in trusted enforcement contexts.

---

## 17. Standards and interoperability

Before implementation, evaluate applicable versions of:

- W3C Verifiable Credentials Data Model.
- W3C or OpenID-based credential presentation protocols.
- OpenID for Verifiable Credential Issuance.
- OpenID for Verifiable Presentations.
- SD-JWT and SD-JWT VC where suitable.
- EU age-verification and EUDI Wallet interoperability specifications.
- Applicable ISO standards for mobile identity documents.
- Jurisdiction-specific operating-system and app-store age-signal interfaces.

This list identifies standards to evaluate, not a requirement to implement every protocol.

Use established cryptographic libraries and conformant protocol implementations wherever practical.

Do not invent a new cryptographic signature scheme, selective-disclosure algorithm, or wallet transport merely to give VMD its own branded protocol.

VMD's distinct contribution is the common application-facing abstraction and policy-enforcement integration.

---

## 18. Testing and conformance

The eventual implementing milestone must cover:

### Verification correctness

- Valid and invalid credentials.
- Trusted and untrusted issuers.
- Expired and revoked evidence.
- Incorrect audiences.
- Expired challenges.
- Replay attempts.
- Insufficient assurance.
- Inconclusive outcomes.

### Privacy

- No unnecessary identity disclosure.
- No uncontrolled cross-site identifiers.
- Log redaction.
- Data expiry.
- Credential minimization.
- Adapter isolation.

### SEAM and Wydgate

- Verification does not grant arbitrary capabilities.
- Membership and assurance remain distinct.
- Denial of unauthorized raw-evidence access.
- Server-side protection cannot be bypassed through WydClient.
- Session and verification expiry are enforced independently.

### Provider interoperability

- Compatible credential formats.
- Invalid signatures.
- Unsupported protocol versions.
- Missing trust anchors.
- Provider failures.
- Inconsistent or conflicting evidence.
- Jurisdiction-policy mismatches.

### Application compatibility

- Applications without identity-assurance requirements remain unaffected.
- Existing Wydgate authentication continues to function.
- Existing SEAM resource permissions remain authoritative.
- Guestbook and Taskboard regressions remain unaffected.
- Multiple independent Wydgit sites cannot automatically correlate users through VMD.

Tests must avoid real identity documents and personal information. Use synthetic fixtures.

---

## 19. Implementation roadmap

### Phase A — Contracts and policy vocabulary

Define:

- Claim types.
- Evidence categories.
- Verification outcomes.
- Assurance descriptions.
- Trust-policy inputs.
- Audience and challenge semantics.
- Service API versioning.

No live identity provider is required for this phase.

### Phase B — Trusted VMD verification core

Implement:

- Canonical VMD service.
- Policy evaluation.
- Trust-anchor configuration.
- Request and result binding.
- Expiration and replay handling.
- Structured errors.
- SEAM integration.
- Audit redaction.

Use synthetic credential providers for initial tests.

### Phase C — AgePass integration

Connect AgePass as an evidence provider and compatible issuer or verifier, as appropriate to the chosen credential protocols.

Preserve existing AgePass workflows only after their behavior and security assumptions have been reviewed.

### Phase D — Wydgate access policies

Allow Wydgate to consume verified VMD assertions for membership and access decisions.

Maintain separation between identity, authentication, and eligibility.

### Phase E — Jurisdiction-specific interoperability

Implement independently tested adapters and policies for relevant EU, Australian, and Californian requirements.

Do not represent a jurisdiction as supported until its actual requirements and selected mechanisms have been verified.

### Phase F — Generalized credential applications

Extend the verified claim model to Applicert and other suitable credential systems.

Handle particularly sensitive categories through separate security and legal reviews.

These phases are planning boundaries, not assigned SEWN milestone numbers.

---

## 20. Open design decisions

Before implementation, resolve:

1. Exact VMD canonical service identity and versioning.
2. Formal claim registry and parameter schemas.
3. Internal representation of verified, denied, inconclusive, and errored claims.
4. Which credential and presentation standards to implement first.
5. Trusted issuer registration and governance.
6. Assurance evaluation and downgrade rules.
7. Revocation and status-check architecture.
8. Challenge, audience, session, and replay-binding design.
9. User consent and disclosure presentation.
10. Pseudonym derivation, scope, rotation, and unlinkability guarantees.
11. Credential retention and deletion policies.
12. Separation of AgePass issuer, holder, and verifier roles.
13. Browser-versus-server verification responsibilities.
14. Whether Wydgate or an independent policy service performs specific eligibility decisions.
15. How VMD integrates with Wydgit's existing service registry.
16. Exact jurisdiction-policy configuration model.
17. California and Australian signal-adapter contracts.
18. Versioned trust-store and provider update mechanisms.
19. Applicert and MedPass extension requirements.
20. Regulatory assessment and conformance criteria for any claimed jurisdictional support.

Do not silently resolve these questions through incidental implementation choices.

---

## 21. Acceptance criteria

The universal VMD architecture is ready for implementation when:

1. VMD is specified as an independent canonical Wydgit service.
2. AgePass and Wydgate have separate responsibilities.
3. SEAM remains the capability-enforcement authority.
4. Verification requests disclose no more information than the intended claim requires.
5. Trust, validity, assurance, and authorization are treated as distinct concepts.
6. Unsupported or insufficient evidence fails closed.
7. Multiple credential adapters can coexist under explicit trust policies.
8. Relying-party isolation and anti-correlation requirements are specified.
9. Server-side enforcement is required for protected server resources.
10. Sensitive data retention and audit boundaries are defined.
11. Synthetic security and interoperability conformance tests are designed.
12. Existing Wydgit and Wydgate workflows remain compatible.
13. The proposed architecture does not depend on static Wydgits being instantiated.
14. Legal and standards conformance is evaluated independently before claiming jurisdictional compliance.

---

## Architectural summary

**VMD is the universal Wydgit verification service.**

**AgePass provides age assurance.**

**Wydgate manages identity, membership, authentication, and access policies.**

**SEAM enforces application capabilities.**

Applications receive narrowly scoped, trustworthy assertions rather than unrestricted access to personal information.

This separation supports privacy-preserving age verification while establishing a reusable foundation for future credential systems.

The platform should consume trusted third-party credentials where appropriate rather than forcing every user through a proprietary identity system.

**Verify the claim. Minimize the disclosure. Enforce the policy. Protect the person.**

**End of draft specification.**
