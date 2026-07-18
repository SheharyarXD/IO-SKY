# IO SKY — Solutions / Ecosystem Page Master Spec (extracted notes)

Source: /home/ubuntu/upload/IO_SKY_SOLUTIONS_ECOSYSTEM_PAGE_10_10_MASTER_SPECIFICATION.pdf

## 1. Master purpose
Commercial conversion center of IO SKY. Premium operational intelligence infrastructure presentation — not a generic SaaS pricing table. Must guide visitors from strategic interest → ecosystem selection / custom discovery / proposal request / payment-checkout / AI Scan / strategy call. Every CTA wires to a real route, backend action, CRM event, admin notification, audit log.

## 2. Positioning
- Route: `/solutions`
- Core line: **Operational ecosystems engineered for scalable execution.**
- Hero subheadline: *IO SKY designs, automates and manages premium operational intelligence infrastructure for companies that need CRM systems, AI workflows, portals, reporting, cloud infrastructure, security and scalable execution systems.*

## 3. Navbar logic
Infrastructure · Intelligence · Enterprise · AI Scan · **Solutions** · About · Contact · Language · Login · Book Strategy Call. Do NOT add "Custom Software" as standalone navbar item — it belongs inside Solutions and Enterprise content.

## 4. Page structure (section order)
1. Hero
2. Ecosystem Overview
3. Ecosystem Cards: Growth / Elite / Custom Intelligence Infrastructure
4. Growth Ecosystem deep-dive
5. Elite Ecosystem deep-dive
6. Custom Intelligence Infrastructure deep-dive
7. AI Scan → Ecosystem Recommendation Flow
8. Custom Discovery Flow
9. Comparison / Fit Guide
10. What Happens After You Click
11. Security, Cloud, Automation Trust Section
12. Strategy Call CTA
13. FAQ
14. Footer

## 5. Pricing (use "Starting from" language)
| Ecosystem | Setup | Monthly | Best For | Primary CTA |
|---|---|---|---|---|
| Growth Ecosystem | Starting from EUR 15,000 | Starting from EUR 3,500/month | Ambitious startups, scale-ups, growing teams | Explore Growth |
| Elite Ecosystem | Starting from EUR 40,000 | Starting from EUR 8,000/month | Complex operations, multi-system organizations, enterprise teams | Explore Elite |
| Custom Intelligence Infrastructure | Custom scoped | Custom retainer | Custom software, mobile apps, portals, private AI systems, IVR, proprietary workflows | Start Custom Discovery |

Custom must NOT show fixed price. Language to use: Setup Investment, Monthly Operational Retainer, Infrastructure Management, Continuous Optimization, Operational Intelligence Layer. Avoid: Basic plan, Cheap package, Starter subscription, Buy now.

## 7. Hero copy
- Eyebrow: **IO SKY SOLUTIONS**
- H1: **Operational ecosystems engineered for scalable execution.**
- Body: *From AI-powered workflows to custom infrastructure, IO SKY builds the systems companies need to operate, grow and scale with intelligence.*
- Primary CTA: **Explore Ecosystems** → scroll to ecosystem cards (`/solutions#ecosystems`)
- Secondary CTA: **Start AI Scan** → `/ai-scan?source=solutions_hero`
- Tertiary link: **Need custom infrastructure?** → `/solutions/custom-intelligence-infrastructure`

## 8. Ecosystem overview copy
- Section H: *Choose the operational layer your company needs next.*
- Body: *Every IO SKY ecosystem combines strategy, automation, infrastructure, cloud systems, reporting, security and continuous optimization. The right ecosystem depends on your operational maturity, complexity and growth goals.*

## 9. Growth Ecosystem card
- Title: **Growth Ecosystem**
- Label: For ambitious startups and scale-ups
- Price: From EUR 15,000 setup + EUR 3,500/month
- Description: A premium operational foundation for companies that need CRM structure, workflow automation, reporting, AI-assisted processes and scalable execution systems.
- Inclusions: CRM and lead infrastructure · workflow automation · AI Scan integration · operational dashboards · reporting and recommendations · secure document and client portal foundations · monthly optimization and system oversight
- CTA: **Explore Growth Ecosystem** → `/solutions/growth-ecosystem`
- Backend: analytics event `solutions_growth_click`

## 10. Elite Ecosystem card
- Title: **Elite Ecosystem**
- Label: For advanced operations and enterprise infrastructure
- Price: From EUR 40,000 setup + EUR 8,000/month
- Description: A high-control operational intelligence layer for companies that need advanced automation, AI agents, portals, security monitoring, cloud infrastructure, integrations and executive visibility.
- Inclusions: advanced AI workflows and agent systems · custom dashboards and portals · enterprise integrations · cloud and backup architecture · security monitoring and audit systems · IVR/campaign/communication infrastructure when required · ongoing optimization, monitoring and operational support
- CTA: **Explore Elite Ecosystem** → `/solutions/elite-ecosystem`
- Backend: analytics event `solutions_elite_click`

## 11. Custom Intelligence Infrastructure card
- Title: **Custom Intelligence Infrastructure** (do NOT call "Custom Package")
- Label: For proprietary systems, custom software and enterprise-grade infrastructure
- Price: Custom scoped after discovery
- Description: For companies that need proprietary software, mobile apps, custom portals, private AI systems, IVR, integrations, internal tools or operational infrastructure built around their exact business model.
- Inclusions: custom software · mobile applications · private AI systems · internal dashboards · custom CRM or ERP layers · AI agents and IVR systems · enterprise integrations · custom reporting and analytics · security and cloud architecture
- CTA: **Start Custom Discovery** → `/solutions/custom-intelligence-infrastructure`
- Backend: analytics event `custom_discovery_start` + CRM lead draft when form begins

## 12. CTA route logic
- Explore Growth → `/solutions/growth-ecosystem` (detailed section, request proposal CTA, analytics event)
- Explore Elite → `/solutions/elite-ecosystem`
- Start Custom Discovery → `/solutions/custom-intelligence-infrastructure` (multi-step discovery, save progress on email, CRM lead, notify admin)
- Request Proposal → `/solutions/proposal-request` (create proposal request record, notify admin, send branded confirmation email)
- Book Strategy Call → `/book-strategy-call?source=solutions` (open native booking flow, pass selected ecosystem context)
- Start AI Scan → `/ai-scan?source=solutions` (track source)

## 13. Routes
- /solutions
- /solutions/growth-ecosystem
- /solutions/elite-ecosystem
- /solutions/custom-intelligence-infrastructure
- /solutions/proposal-request
- /solutions/custom-discovery
- /ai-scan?source=solutions
- /book-strategy-call?source=solutions
- /checkout/ecosystem/growth
- /checkout/ecosystem/elite

Custom Intelligence Infrastructure must NOT immediately force checkout — use discovery + strategy call + proposal logic.

## 14. Custom Discovery flow (multi-step, NOT a long form)
Steps:
1. Company and contact basics
2. What do you need built? (Software, mobile app, portal, AI system, CRM, IVR, integration, internal dashboard, automation layer, other)
3. Current systems and operational friction
4. Team size and growth stage
5. Compliance, security and data sensitivity
6. Integrations needed
7. Timeline and urgency
8. Preferred next step: AI Scan, strategy call, proposal request

After submit: create CRM lead · assign `custom_infrastructure` tag · notify admin · show premium confirmation state · recommend strategy call · store data in database.

## 15. AI Scan → ecosystem recommendation logic
- Lower complexity + growth needs → Growth Ecosystem
- Higher complexity + multi-system → Elite Ecosystem
- Custom software / proprietary needs → Custom Intelligence Infrastructure

When recommendation generated: save to DB · show on AI Scan results · show in Client Portal · notify admin · create CRM activity · CTA to Request Proposal or Book Strategy Call.

## 16. Payment logic
Growth + Elite may support checkout OR proposal-first depending on setting. Methods: Stripe (credit card, iDEAL, PayPal). On success: create invoice/receipt · update CRM status · unlock onboarding flow · create project draft · notify admin · send confirmation email · audit log. Custom Intelligence Infrastructure uses discovery/proposal-first, not instant checkout.

## 17. Database models needed
- `ecosystem_plans`
- `ecosystem_click_events`
- `ecosystem_proposal_requests`
- `custom_discovery_sessions`
- `custom_discovery_answers`
- `crm_leads`
- `organizations`
- `users`
- `invoices`
- `payments`
- `subscriptions`
- `ecosystem_recommendations`
- `notifications`
- `audit_logs`
- `analytics_events`

Every submission must store `source = solutions_page` and `selected_ecosystem` where relevant.

## 18. Admin notifications triggered when
- Request Proposal clicked
- Custom Discovery started
- Custom Discovery completed
- Growth/Elite checkout starts
- Payment succeeds / fails
- AI Scan recommends an ecosystem
- User books strategy call from Solutions

## 19. Cloud storage
Proposal PDFs / discovery exports / uploaded requirement documents / generated ecosystem roadmaps → encrypted cloud storage, signed temporary URLs only, no public buckets, audit logs on uploads/downloads, retention policy.

## 20. Design language
Deep navy-black atmosphere · premium glass surfaces · restrained orange hover accents · cinematic spacing · executive typography · subtle motion · controlled glow. Avoid cheap pricing tables.

## 21. Responsive
Mobile: cards stack vertically, pricing clear, large/touch-friendly CTA, custom discovery step-by-step, no overloaded comparison tables, sticky bottom CTA ("Book Strategy Call" or "Start AI Scan") after scroll.

## 23. Final rule
Not a static pricing page. Real business intake, recommendation and conversion system. Every action wires to DB records, CRM logic, admin notifications, analytics events, payment/proposal flows, Client Portal recommendations.
