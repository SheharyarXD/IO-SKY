# AI Disclaimer

**Version:** 1.0
**Effective from:** 2026-05-25
**Document kind:** `ai-disclaimer`

The IO SKY platform uses artificial intelligence in several places. We believe AI is most useful when its limits are stated clearly. This disclaimer summarises what our AI can and cannot do and what your responsibilities are when you act on its output.

---

## 1. Where AI is used

| Surface | What the AI does | Who reviews it |
|---|---|---|
| **AI Scan** | Reads the structured intake answers you submit and produces a summary, a maturity score and a list of recommended next steps. | Output is shared with you and reviewed by an IO SKY operator before any commercial follow-up. |
| **AI Operations Agent** (Admin Portal) | Summarises platform telemetry, lead pipeline and operational alerts for IO SKY staff. | Internal staff; not customer-facing. |
| **AI Agents & IVR** | Drives optional voice and chat assistants on top of structured workflows. | Each interaction is audit-logged; a human is always reachable on request. |
| **Recommendation engine** (Client Portal) | Surfaces prioritised recommendations based on report findings. | Recommendations are advisory; clients decide what to implement. |
| **Automation copilots** | Drafts emails, suggested next actions and onboarding messages. | Drafts only; nothing is sent without explicit user action. |

---

## 2. What our AI is **not**

* **Not legal advice.** Outputs do not constitute advice from a lawyer or licensed professional and may not be relied upon for legal decisions.
* **Not medical, financial, accounting, or tax advice.** If your decision needs a regulated professional, consult one.
* **Not a guarantee of outcomes.** The AI may suggest a path that is plausible based on the inputs but is not guaranteed to succeed in your specific environment.
* **Not infallible.** Generative AI can produce inaccurate or outdated information ("hallucinations"). Always verify critical claims against authoritative sources.

---

## 3. Your responsibilities

By submitting an AI Scan, accepting AI-generated recommendations, or relying on automation drafts you confirm that:

1. You have reviewed the output and applied human judgement before acting on it.
2. You have authority to share the data you submit (no third-party personal data without a lawful basis).
3. You will not present AI output as if it were a binding professional opinion.
4. You will report mistakes, harmful content, or biased outputs to **ai@io.sky** so we can investigate and improve the system.

---

## 4. Data handling for AI

* AI Scan inputs and outputs are stored in our database as structured records linked to your account or organisation. Retention is documented in the [Privacy Policy](/privacy).
* We do not use your data to train foundation models without an explicit, separate written agreement.
* Inference calls to LLM providers are made over TLS with the smallest possible payload. Provider data-retention is governed by Standard Contractual Clauses; see the subprocessor list in the Privacy Policy.

---

## 5. Children, sensitive contexts, prohibited use

The AI Scan and other AI surfaces are intended for professional adults. Do not use them for:

* Decisions about minors.
* Medical, mental-health, or crisis-intervention scenarios.
* Profiling protected categories (race, religion, sexual orientation, etc.) or building automated decisions with legal or similarly significant effects under Art. 22 GDPR.

---

## 6. Acknowledgement

Before submitting an AI Scan, generating a recommendation, or activating an AI Agent, you will be asked to **acknowledge** this disclaimer. Each acknowledgement is recorded with a timestamp, IP address and the active version of this document in the `legal_acknowledgements` table.

---

## 7. Contact

* **AI feedback / mistakes / bias reports:** ai@io.sky
* **Privacy:** privacy@io.sky
* **Legal:** legal@io.sky
