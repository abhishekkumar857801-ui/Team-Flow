---
name: TeamFlow
description: "Your tasks, always in sync: a bus-ticket task world shared by the React web app and the Flutter phone app."
colors:
  ground: "#ffffff"
  surface-2: "#eef1f6"
  surface-3: "#e2e7f0"
  border: "#d9dfea"
  border-soft: "#e8ecf3"
  border-strong: "#b8c2d6"
  ink: "#1a2340"
  ink-2: "#3a4466"
  muted: "#5b6585"
  conductor-navy: "#1a2340"
  navy-raised: "#263159"
  navy-ink: "#d5dcf0"
  navy-muted: "#9aa6cc"
  ticket-red: "#c62828"
  ticket-red-deep: "#a61f1f"
  ticket-red-text: "#b42121"
  ticket-red-soft: "#fbe3e3"
  danger-ink: "#8e1414"
  signal-green: "#1f9d55"
  signal-green-soft: "#ddf3e6"
  signal-green-on-navy: "#4ade80"
  fare-critical: "#f6b5c8"
  fare-high: "#f7e27a"
  fare-medium: "#a8ddb5"
  fare-low: "#9ec9f0"
  success: "#1f7a4d"
  success-soft: "#ddf1e5"
  warn: "#9a5a06"
  warn-soft: "#fdf0d5"
  info: "#1e5aa8"
  info-soft: "#e1ecf8"
  logo-blue: "#2563eb"
  logo-blue-deep: "#1d4ed8"
  logo-yellow: "#facc15"
typography:
  display:
    fontFamily: "Chivo, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Chivo, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Chivo, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  ticket-title:
    fontFamily: "Chivo, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15.5px"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "Chivo, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  meta:
    fontFamily: "Chivo, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.45
  label:
    fontFamily: "Chivo, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.3
  mono-serial:
    fontFamily: "Chivo Mono, ui-monospace, Menlo, monospace"
    fontSize: "12.5px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.02em"
    fontFeature: "tnum"
  mono-stamp:
    fontFamily: "Chivo Mono, ui-monospace, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.08em"
  mono-figure:
    fontFamily: "Chivo Mono, ui-monospace, Menlo, monospace"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  full: "9999px"
spacing:
  xxs: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "28px"
  page-x: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ticket-red}"
    textColor: "{colors.ground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 15px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.ticket-red-deep}"
  button-secondary:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 15px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 15px"
  button-danger:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ticket-red}"
    rounded: "{rounded.sm}"
    padding: "8px 15px"
  button-phone:
    backgroundColor: "{colors.ticket-red}"
    textColor: "{colors.ground}"
    rounded: "{rounded.sm}"
    height: "48px"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.ground}"
    rounded: "{rounded.md}"
    padding: "18px 20px"
  ticket-critical:
    backgroundColor: "{colors.fare-critical}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px 10px"
  ticket-high:
    backgroundColor: "{colors.fare-high}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px 10px"
  ticket-medium:
    backgroundColor: "{colors.fare-medium}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px 10px"
  ticket-low:
    backgroundColor: "{colors.fare-low}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px 10px"
  ticket-done:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "12px 14px 10px"
  punch-cell:
    textColor: "{colors.ink-2}"
    typography: "{typography.mono-stamp}"
    rounded: "{rounded.xs}"
    height: "30px"
  punch-cell-punched:
    backgroundColor: "{colors.conductor-navy}"
    textColor: "{colors.ground}"
    typography: "{typography.mono-stamp}"
    rounded: "{rounded.xs}"
  punch-cell-phone-interactive:
    height: "48px"
  shell-sidebar:
    backgroundColor: "{colors.conductor-navy}"
    textColor: "{colors.navy-ink}"
    width: "252px"
    padding: "18px 12px"
  nav-item:
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.sm}"
    padding: "9px 10px"
  nav-item-hover:
    backgroundColor: "{colors.navy-raised}"
    textColor: "{colors.ground}"
  nav-item-active:
    backgroundColor: "{colors.ticket-red}"
    textColor: "{colors.ground}"
  phone-app-bar:
    backgroundColor: "{colors.conductor-navy}"
    textColor: "{colors.ground}"
  phone-nav-bar-selected:
    backgroundColor: "{colors.conductor-navy}"
    textColor: "{colors.ground}"
  badge:
    rounded: "{rounded.xs}"
    padding: "2px 8px"
  level-critical:
    backgroundColor: "{colors.ticket-red}"
    textColor: "{colors.ground}"
    typography: "{typography.mono-stamp}"
    rounded: "{rounded.xs}"
    padding: "2px 7px"
  toast:
    backgroundColor: "{colors.conductor-navy}"
    textColor: "{colors.ground}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
---

# Design System: TeamFlow

## Overview

**Creative North Star: "The Conductor's Ticket Rack"**

Every task is a city-bus ticket. It carries a permanent serial (TF-####), its priority is the fare class and colours the whole ticket, and a punch row along its foot records each stage it has passed: To do, Doing, Review, Done, always in the same four positions so any two tickets compare at a glance. The shell around the tickets is the conductor: a deep navy rail on web (sidebar) and phone (app bar), with ticket red reserved for the one thing to press, the current place in the nav, and critical risk.

The ground is plain white, chosen for daylight use on shop floors and phones outdoors. Density is that of a working instrument: compact rows, tabular mono figures for every serial, hour, percentage, date and count, and short plain sentences. Depth is a quiet navy-tinted shadow, never glow. Perforated dashed rules mark where a ticket's body tears from its stub.

Web (React, `client/src/styles.css`) and phone (Flutter, `mobile/lib/main.dart` + `mobile/lib/widgets/common.dart`) share one palette and one type pairing; the values in the frontmatter are the single source both must match.

**Key Characteristics:**
- White ground, conductor-navy shell, ticket-red action.
- Priority owns the whole ticket field in one of four fare tints.
- Chivo for words, Chivo Mono for every number and code.
- The punch row: four fixed stage cells, navy when punched.
- Dashed perforation rules, 4/6/8px corners, flat navy-tinted shadows.

## Colors

A white, daylight palette: one navy that both inks the text and paints the shell, one red that means "act here", four fare tints that carry priority, and a signal green that only ever means "live".

### Primary
- **Ticket Red** (ticket-red): primary buttons, the active nav item, selection caret and focus ring, critical level stamps, overload fill. Hover deepens to **Ticket Red Deep**. Links and red text on white use **Ticket Red Text** for contrast; red text on a fare-tinted ticket ("Overdue", "Due within 2 days") uses **Danger Ink**, the only red that passes AA on every tint.
- **Ticket Red Soft** (ticket-red-soft): drop-target column, danger badges, error boxes.

### Secondary
- **Conductor Navy** (conductor-navy): the web sidebar, the phone app bar, punched punch cells, toasts, the selected phone nav indicator, input focus border, progress bars, the 100% capacity mark. It is the same value as the body ink, so shell and text read as one material.
- **Navy Raised** (navy-raised): hover rows inside the navy shell.
- **Navy Ink** / **Navy Muted** (navy-ink, navy-muted): text and secondary labels on navy.

### Tertiary: the fare classes
- **Critical Pink** (fare-critical), **High Yellow** (fare-high), **Medium Green** (fare-medium), **Low Blue** (fare-low): the whole background of a ticket at that priority. A done ticket returns to white.

### Live
- **Signal Green** (signal-green, signal-green-soft): real-time state only, the "Live sync on" dot and live toasts. On navy it brightens to **Signal Green On Navy** for contrast.

### States
- **Success** (success / success-soft), **Warn** (warn / warn-soft), **Info** (info / info-soft): badges, level stamps, capacity fills (available green, balanced blue, busy amber, overloaded red) and info notes. Always a dark ink on its own soft tint.

### Neutral
- **Ground** (ground): page and card background.
- **Surface 2 / Surface 3** (surface-2, surface-3): board columns, hover rows, capacity and ring tracks, disabled inputs.
- **Border / Border Soft / Border Strong**: card outlines, row dividers, and the outlined secondary button respectively.
- **Ink / Ink 2 / Muted** (ink, ink-2, muted): headings and body, ticket meta, captions.

### Brand
- **Logo Blue, Logo Blue Deep, Logo Yellow** (logo-blue, logo-blue-deep, logo-yellow): the TeamFlow logo only (blue rounded tile, three white task bars, yellow check badge; `mobile/assets/icon/logo.svg`, `client/public/favicon.svg`). It is a binding brand asset and sits on navy with a white ring where it needs separation.

### Named Rules
**The Fare Owns the Field Rule.** Priority is shown by filling the entire ticket with its fare tint, never by a side stripe, dot or border colour. A done ticket goes white.

**The One Red Rule.** Ticket red marks the one action, the current place, or critical risk. Two red buttons in one view is a defect.

**The Live Green Rule.** Signal green means "this is live right now" and nothing else. Success uses its own deeper green.

**The Logo Blue Stays in the Logo Rule.** Blue from the logo is never used as a UI accent; interface blue is limited to the low fare tint and the info state.

## Typography

**Display Font:** Chivo (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif)
**Body Font:** Chivo
**Label/Mono Font:** Chivo Mono (with ui-monospace, Menlo, monospace)

Both are self-hosted: variable woff2 in `client/public/fonts/` (weights 100–900, latin + latin-ext) and static TTFs bundled in `mobile/assets/fonts/` (Chivo 400/600/700/800, ChivoMono 500/700). Tabular numerals are on globally.

**Character:** A sturdy grotesque with a matching monospace, like the printed face and the stamped numbers on a transit ticket.

### Hierarchy
- **Display** (800, 40px, 1.1): the sign-in hero headline only; 30px under 960px.
- **Headline** (800, 28px, 1.2): page greeting / page title; 23px at phone width. Flutter app bar title is Chivo 800 20px.
- **Title** (700, 17px, 1.2): panel and section headings ("Who has room this week").
- **Ticket Title** (700, 15.5px web / 16px phone, 1.3–1.35): the task name on a ticket.
- **Body** (400, 15px, 1.5): running text; page intros capped at 70ch.
- **Meta** (500, 13px): who, where, when lines on tickets and rows.
- **Label** (600, 13–14px): field labels and button text (buttons 600 14px web, 700 15px phone).
- **Mono Serial** (700, 12.5px web / 13px phone, +0.02em): TF-#### serials.
- **Mono Stamp** (700, 11px, uppercase, +0.08em on fare labels): fare class, punch cells, level stamps, project status.
- **Mono Figure** (700, 32px risk score; 17px load percentage): the numbers a leader scans.

### Named Rules
**The Mono for Numbers Rule.** Serials, hours, percentages, dates, times and counts are set in Chivo Mono; words are set in Chivo. Never set prose in mono.

**The Stamp Case Rule.** Uppercase is reserved for mono stamps (fare class, punch cells, levels) and table headers, never for Chivo headings or labels above headings.

## Layout

Web is a two-column shell: a sticky 252px navy sidebar (brand, current team with live status, nav, user pinned at bottom) and a main column padded 28px 32px 56px, capped at 1440px. Page heads align the title left and actions right, wrapping when narrow. The dashboard leads with a three-up ticket grid (14px gap), then a two-column panel grid (1.1fr / 1fr, 18px gap) that stacks under 1200px. The board is four fixed stage columns (min 260px each, 14px gap) that scroll horizontally rather than reflow.

At 900px and below the sidebar collapses into a compact sticky navy top bar (logo mark, team name with live dot, 44px menu button); the nav and user block open from the menu. Main padding becomes 18px 16px 40px; ticket grid, capacity rows and form grids go single-column.

The phone app uses a navy app bar, a white scroll body with tickets inset 16px horizontally and 12px apart, a three-cell summary strip (Open / Late / Done), section headings with mono counts ("Overdue · 1"), and a white bottom navigation bar with a navy pill indicator.

Spacing runs on small steps (4, 6, 8, 12, 16, 20, 28, 32px); cards pad 18px 20px, tickets 12px 14px 10px, list rows 10–12px vertically with soft hairline dividers.

Breakpoints: 1200px (dashboard stacks), 960px (sign-in stacks), 900px (shell becomes top bar), 700px (video call grid narrows).

## Elevation & Depth

Mostly flat, lifted slightly. Surfaces sit on white with a 1px border and a faint navy-tinted shadow; hover on an interactive ticket or tile raises it one step and moves it up 1px. Modals and toasts use the one deep shadow. All shadows are tinted with conductor navy, never pure black, and none glow. Flutter tickets and cards are elevation 0 with a border; only the FAB keeps elevation 2.

### Shadow Vocabulary
- **Resting** (`box-shadow: 0 1px 2px rgba(26, 35, 64, 0.06)`): cards, panels, tickets at rest.
- **Lifted** (`box-shadow: 0 1px 2px rgba(26, 35, 64, 0.05), 0 6px 16px -8px rgba(26, 35, 64, 0.16)`): hover on clickable tickets and tiles.
- **Overlay** (`box-shadow: 0 18px 40px -16px rgba(26, 35, 64, 0.35)`): modals and toasts.

### Named Rules
**The Navy Shadow Rule.** Shadows are navy-tinted and soft; there are no hard offset shadows and no coloured glows.

## Shapes

Small, practical corners: 8px for cards, tickets, panels, modals and toasts; 6px for buttons, inputs, nav items, chips and segmented buttons; 4px for badges, stamps, punch cells and inline code. Avatars and status dots are full circles; the logo tile is about 23% rounded. Borders are 1px for containers and 1.5px for controls (buttons, inputs). The recurring silhouette is the ticket's perforation: a 1.5px dashed rule at 30% navy separating the ticket body from its punch row, also used for the sidebar sub-nav rail, empty-state outlines and empty avatars. Over-capacity is shown with a diagonal red hatch beyond the 100% mark.

## Components

### Buttons
Firm, outlined, unfussy.
- **Shape:** gently squared (6px), 40px minimum height on web, 48px on phone.
- **Primary:** ticket red fill, white 600 text, 8px 15px padding; hover deepens to ticket red deep. One per view.
- **Secondary (default):** white fill, 1.5px border-strong outline, ink text; hover fills surface 2 and darkens the border.
- **Ghost:** transparent, hover surface 2. **Danger:** white with red text and pale red border; hover fills ticket red soft.
- **Small:** 32px high, 13px text. **Active:** nudges down 1px. **Focus:** 2px ticket red outline, 2px offset.

### Chips and Stamps
- **Badges:** 4px corners, 11.5px 700 text on a soft state tint (success, info, warn, danger) or navy for primary.
- **Level stamps:** mono 11px uppercase; critical is solid ticket red with white text, others soft tints.
- **Device tag:** grey for web, navy for mobile, so the source of each change is visible.
- **Phone chips / segmented buttons:** 6px corners, border-strong outline, selected state navy with white text.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** white; board columns use surface 2.
- **Shadow Strategy:** Resting; Lifted on hover for clickable tiles.
- **Border:** 1px border.
- **Internal Padding:** 18px 20px. Panel headings may carry a 30px square tinted icon tile.

### Inputs / Fields
- **Style:** white, 1.5px border, 6px corners, 9px 12px padding, 40px minimum; label above in 600 13px ink 2.
- **Focus:** border turns conductor navy with a 3px navy ring at 14% (phone: 2px navy border).
- **Error / Disabled:** errors in a ticket-red-soft box with red text; disabled fields fill surface 2.

### Navigation
- **Web sidebar:** navy rail; items 600 15px navy ink, 6px corners; hover navy raised with white text; active solid ticket red with white text. Task board and Projects open as dropdowns whose sub-items hang from a dashed rail. Team block shows name and live-sync dot.
- **Web mobile:** compact navy top bar with logo mark, team name and live dot, menu button opening the full nav.
- **Phone:** navy app bar (Chivo 800 20px white) with live dot; white bottom nav bar, selected item in a navy pill with white icon and bold label.

### Ticket (signature)
The task as a bus ticket, on both platforms.
- **Stub:** mono serial TF-#### left, fare class in uppercase mono right.
- **Field:** the whole ticket filled with its fare tint, 1px border at 16% navy, 8px corners, 12px 14px 10px padding; done tickets go white with ink 2 title.
- **Body:** ticket title, then meta line (project colour dot and name, mono due date with calendar icon, proof count, mono hours, assignee avatar). Late dates and risk reasons are danger ink, bold, with an alert icon.
- **Foot:** dashed perforation rule, then the punch row.
- **States:** clickable tickets lift on hover; dragging fades to 45%; drop columns show a dashed red outline on ticket red soft.

### Punch Row (signature)
Four equal cells in fixed order (To do, Doing, Review, Done), 4px gap, 4px corners, mono 11px uppercase. Stages passed are punched: solid conductor navy with white text (on web a small hole marker takes the fare colour). Unpunched cells are an 8% navy wash with ink 2 text. On the phone, when the member may move the ticket, each cell is a real 48dp button labelled "Move to …"; otherwise cells are 30dp read-only.

### Capacity Strip
14px track on surface 2 with a 2px navy mark at the 100% point; fill coloured by load state; past 100% a red diagonal hatch continues to the right. Percentage sits beside it in 17px mono, red when overloaded.

### Toast
Navy, white 500 14px text, 8px corners, Overlay shadow, sliding up 10px on entry; live toasts carry a signal-green icon.

## Do's and Don'ts

### Do:
- **Do** draw every task as a ticket: serial, fare class, title, meta, perforation, punch row, on web and phone alike.
- **Do** fill the whole ticket with its fare tint (critical pink, high yellow, medium green, low blue) and return it to white when done.
- **Do** set serials, hours, percentages, dates, times and counts in Chivo Mono with tabular figures.
- **Do** keep the punch row's four stages in fixed positions so tickets compare at a glance; make phone punch cells 48dp when they are tappable.
- **Do** use danger ink (#8e1414) for red text on fare-tinted tickets, and ticket red text (#b42121) for red text on white.
- **Do** change a colour in both `client/src/styles.css` and `mobile/lib/widgets/common.dart` (AppColors) together, matching this file.
- **Do** keep the logo exactly as supplied: blue tile, white bars, yellow check.

### Don't:
- **Don't** mark priority with a side stripe, coloured border or lone dot; the fare tint owns the field.
- **Don't** use signal green for anything but live state.
- **Don't** use the logo blue as an interface accent, or a grey SaaS shell with a single blue accent.
- **Don't** add decorative gradients or glows; the only patterned fill is the red over-capacity hatch.
- **Don't** set uppercase eyebrows or kickers above headings; uppercase belongs to mono stamps and table headers.
- **Don't** round containers beyond 8px or make buttons pill-shaped; the phone bottom-nav indicator is the one stadium shape.
