# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Owners/admins and managers/team leads of a tele-calling team. They keep this dashboard open on a
laptop or desktop (1280–1920px) through the working shift to watch agents' calls, leads, follow-ups
and daily targets, and act on what they see (reassign leads, chase a low performer, export a report).
Agents do not use the dashboard; they use the CallTrack mobile app, which records their calls and
syncs them here. Phone access to the dashboard must work but is secondary.

## Product Purpose

CallTrack CRM turns every agent's phone call into tracked data: call logs synced from the agents'
own SIM, linked to leads, rolled up into per-agent, per-team and org-wide reports. Success is a
manager knowing, at a glance and at any moment of the shift, who is calling, who is not, which leads
are moving and which are slipping, without asking anyone.

## Positioning

Calls come from the agent's real phone (native call-log sync with SIM selection), not a dialer, so
the data reflects what actually happened on the floor. Access is team-scoped: a manager/TL sees only
employees whose TL name matches theirs; admins see every team.

## Operating Context

- Used in IST (Asia/Kolkata); "today" means the IST calendar day.
- Roles: admin (everything), manager/TL (own team only, read-mostly), employee (mobile app only).
- Core objects: call logs (incoming/outgoing/missed/rejected, duration, remark, status), leads
  (status pipeline, engagement band, attempts, follow-up date, source, tags), employees (TL name,
  daily call target, active/inactive), call scripts, downloads/exports.
- Daily rituals: watch live call feed, check targets vs actuals, work follow-ups, export reports.

## Capabilities and Constraints

- Next.js 14 app router, JavaScript (not TypeScript), Tailwind 3, framer-motion, recharts,
  lucide-react already installed. No new dependencies without need.
- All business logic, API calls and permissions are fixed; design work must not change them.
- Real data only; no mock data in shipped screens.

## Brand Commitments

- Product name: CallTrack CRM (mark: "CT").
- Light theme (white sidebar) with a single violet accent (#7C3AED); owner switched from blue in Nov 2026. Confirmed binding
  by the owner (Callyzer-like clarity was the original reference).

## Evidence on Hand

Live production data via the local backend; no testimonials, customers or metrics to invent.

## Product Principles

1. Glanceable first: the state of the floor is readable in seconds, details on demand.
2. Density over decoration: managers scan many rows and numbers all day.
3. Every number is actionable: a figure leads to the rows behind it.
4. Calm by default, loud only for problems (missed targets, no activity, failed sync).
