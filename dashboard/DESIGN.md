---
name: CallTrack CRM
description: The chase — a light working surface where every count is read against its target.
colors:
  primary: "#7C3AED"
  primary-pressed: "#6D28D9"
  primary-wash: "#F5F3FF"
  primary-tint: "#EDE9FE"
  ground: "#FAFAFC"
  surface: "#FFFFFF"
  surface-quiet: "#FAF9FC"
  rail: "#FFFFFF"
  seam: "#E9E7EF"
  seam-soft: "#F1F0F5"
  seam-strong: "#D5D2DE"
  scrollbar-hover: "#B4B0C2"
  ink-avatar: "#524F63"
  ink-deep: "#3D3A4D"
  ink-soft: "#F4F3F8"
  primary-soft: "#C4B5FD"
  call-incoming-wash: "#F0FDF9"
  ink: "#1A1726"
  ink-secondary: "#4A4658"
  ink-meta: "#6B6880"
  ink-faint: "#A19DB2"
  target-line: "#A19DB2"
  met: "#079455"
  met-wash: "#ECFDF3"
  behind: "#D92D20"
  behind-wash: "#FEF3F2"
  behind-line: "#FBD5D0"
  behind-line-strong: "#F9B4AC"
  caution: "#B54708"
  caution-wash: "#FFFAEB"
  call-outgoing: "#7C3AED"
  call-incoming: "#0E9384"
  call-missed: "#D92D20"
  call-rejected: "#B54708"
typography:
  page-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "-0.02em"
  score:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  panel-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
  unit:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  meta:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
rounded:
  badge: "6px"
  control: "8px"
  segment: "9px"
  popover: "10px"
  panel: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-pressed}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  button-ghost:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 12px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  badge:
    rounded: "{rounded.badge}"
    height: "22px"
    padding: "0 8px"
  table-row:
    height: "44px"
    padding: "8px 16px"
---

# Design System: CallTrack CRM

## Overview

**Creative North Star: The Chase.** A tele-calling floor's day is an innings: calls done, the target,
how many are still needed, and whether the current rate will get there. The interface reads every
count against its target, so the first thing a manager sees is pace, not a wall of numbers.

It is an Operate surface. Managers keep it open on a desktop all shift, so it is calm, dense and
familiar: standard controls, white panels on a soft white ground, hairline seams instead of
shadows. Colour is spent only where it carries a meaning, which is why a red number always means
someone is behind and a green one always means a target was met.

**Key characteristics:** pace-first dashboard (scorebar → worm chart against a dashed target line →
"behind the rate" list → agent table); one violet ink; Indian digit grouping (1,21,124); IST
throughout; nothing labelled twice.

## Colors

One accent and a set of meaning colours, on white and near-white neutrals tinted faintly toward the violet.

- **Primary (#7C3AED, "Floor Violet")**: the *actual* line on charts, primary actions, selection,
  the current nav item's icon, progress fills. Owner-chosen (Nov 2026) over the earlier blue.
- **Target line (#A19DB2)**: always dashed. The thing the actual line chases.
- **Met (#079455)** only when a target is reached. **Behind (#D92D20)** only when someone is short
  of pace, a call was missed, or a follow-up is overdue. **Caution (#B54708)** for due-today and unsaved state.
- **Call types**: outgoing violet (the agent's own work), incoming teal, missed red, rejected amber —
  identical on every badge, chart and legend.
- **Lead statuses**: the nine automatic talk-time bands are one violet ramp from light (cold) to deep
  (hot); manual outcomes use fixed meaning colours (amber follow-up, green booked/converted,
  red not interested, grey lost). Source of truth: `src/lib/leadStatus.js`.
- **Neutrals**: ground #FAFAFC, rail #FFFFFF (white sidebar with a seam; active item violet tint), panels #FFFFFF,
  seams #E9E7EF / #F1F0F5, text #1A1726 / #4A4658 / #6B6880 (meta, 4.8:1 on white).

**The One Ink Rule.** Violet is the only decorative-weight colour. Every other hue must name what it means.

## Typography

One workhorse family, Inter (self-hosted through `next/font`), on a tight fixed scale:
page title 20/28 semibold, score 26/32 semibold with tabular figures, panel title 14 semibold,
body 13, labels 12.5 medium, meta 12. Sentence case everywhere; no uppercase tracked labels.
All numbers in tables and scores use tabular figures. Phone numbers use tabular figures too,
never monospace.

## Layout

- App shell: 232px rail (64px collapsed) + 56px top bar; content max 1480px, 32px side padding
  on desktop, 16px on phones. Sizes live in CSS variables (`--sidebar-w`, `--topbar-h`) so the rail,
  bar and content can never disagree.
- 4px grid. Panels 20px inner padding (16px compact); 24px between sections; 12px between controls.
- One page header pattern (`PageHeader`): title, one-line description, actions on the right.
  The top bar shows the breadcrumb from the nav's own labels; the page never repeats it.
- Scorebars are one panel divided by hairline seams, not rows of separate cards.
- Every page has one home in the navigation. Reports live under Reports only.
- Tables scroll horizontally on phones (minimum 720px); panels stack; the drawer replaces the rail.

## Elevation & Depth

Flat. Panels are separated by 1px seams; Tailwind's `shadow`, `shadow-sm` and `shadow-md` resolve to
none. Shadow is reserved for things that float: dropdowns, the sidebar fly-out, dialogs, toasts
(`--shadow-pop`).

## Shapes

Panels 12px, controls 8px, badges 6px, pills only for small controls and status dots.
No coloured side stripes, no nested cards.

## Components

- **Buttons**: 36px (32px small). Primary violet, secondary white with a seam, ghost, danger outline.
  Every button presses to scale 0.97 in 140ms.
- **Inputs**: 36px, seam border, violet 3px focus ring, `aria-invalid` turns the ring red, errors sit
  directly under the field.
- **Segmented control (`.seg`)**: the filter of choice for 2–6 options (status, period, call type).
- **Tabs**: underline indicator that slides between tabs (250ms, strong ease-in-out).
- **DataTable**: 44px rows, sentence-case 36px header, sort arrow on hover, column filters, footer pager
  with range, rows-per-page and prev/next. Skeleton rows while loading; empty states say what to do next.
- **Badges**: 22px, tinted background, coloured dot; quiet by default.
- **Score**: label, number, one line of context; colour only for met/behind.

## Do's and Don'ts

**Do**
- Do show a number against its target or its comparison whenever one exists.
- Do keep IST hours as they come from the API (`callsPerHour` is already IST).
- Do use `en-IN` number formatting.
- Do animate with transform/opacity, `cubic-bezier(0.23,1,0.32,1)`, 140–260ms; respect reduced motion.

**Don't**
- Don't add icon tiles, gradient blocks or decorative circles to scores.
- Don't put a kicker/eyebrow or breadcrumb above a page title.
- Don't show the same data twice on one screen (tiles + chart + donut of the same counts).
- Don't use emoji as icons; use lucide-react or inline SVG at one stroke weight.
- Don't add page-load entrance animations; content is visible on arrival.
- Don't add a second decorative hue, `transition: all`, or `ease-in`.
