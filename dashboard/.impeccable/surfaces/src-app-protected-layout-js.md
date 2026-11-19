---
version: 1
slug: "src-app-protected-layout-js"
primary_target: "src/app/(protected)/layout.js"
related_targets: ["src/app/(protected)/dashboard/page.js"]
---

## Scope

Whole authenticated CallTrack dashboard (app shell + every page). Mode: Operate. Audience: admins and
managers/TLs on desktop all shift. Job: know who is on pace, who is behind, act on it.

## Direction contract

THESIS: Every count is a chase against a target. The day is an innings: done, target, need, required
rate versus current rate. Refuses the category default of a wall of rainbow KPI tiles plus donut.

OWN-WORLD: White content ground on a cool-grey rail; 1px hairline seams instead of shadows and
gradients. Blue #2563EB is the actual line and primary action; the target is a dashed slate line; red
appears only when behind the required rate, green only when a target is met. One sans (Inter) with
tabular figures, 13px dense rows, one fixed colour per status everywhere.

STORY: The manager reads the team's chase in one glance, sees which agents are behind the rate,
opens their rows and acts: reassign, chase, export.

FIRST VIEWPORT: Scorebar strip (Done/Target, Need, Required vs Current rate, Connected %), left 2/3
cumulative worm chart by IST hour against the target line with a now marker, right 1/3 "Behind the
rate" agent list; agent chase table below; date control top right.

FORM: Cricket chase scorecard; my list position 1 (Impeccable's pick card, chosen by the user over
the assigned shift board). seed:812bc158eea6c4cf. Raises kept from declined challengers: nothing
labelled twice (Saville), one status colour per status (transit diagram), hairline seams and isolated
destructive actions (developer console), one 8px grid (Crouwel), compared charts share one scale
(botanical folio).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Target for multi-day ranges: prorate daily target x working days (decide in build).
