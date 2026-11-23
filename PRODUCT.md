# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Primary: **small businesses** — small companies and startup teams where an owner or a few managers hand out work and staff carry it out, often away from a desk. Leaders mostly plan, assign and review on a laptop (web); team members mostly check their tasks, update progress and send proof from their phone (Android and iOS app).

Secondary (confirmed, not the focus): student teams and clubs, which the current login copy also names.

Jobs:
- Owner / manager: set up projects with deadlines, create and assign tasks, see who is overloaded and which deadline is in danger, rebalance work, talk to the team, run meetings.
- Member: see "my tasks" across teams, move a task forward, attach a photo as proof of work, chat about the project, join a meeting from the phone.

## Product Purpose

TeamFlow is a shared workspace that keeps a small team's work in one place on every device. Success means a change made on one device (for example a member marking a task done on their phone) is visible to the leader on the web instantly, and leaders see workload and deadline risk early enough to act.

## Positioning

**Web and phone in perfect sync.** The same team, the same accounts and the same data on laptop and phone, with every change pushed live to all devices (Socket.io), and the field work that phones are good at built in: proof photos from the camera, project chat, and video meetings that phone and web users can join together. Workload and deadline-risk prediction supports this but is secondary in positioning.

## Operating Context

- Leaders work on the React web app; members mainly on the Flutter app (Android today, iOS supported by the codebase).
- Typical flow: owner creates a team → creates single-use invite codes (prefix from the team name, e.g. `BIN7K2`) → staff join → managers create projects and tasks → members update status/progress and upload proof → everyone follows the live activity feed, chat and meetings.
- Built for the **MERNOVA X 2026** hackathon (Presidency University): the live demo must show data created on one platform appearing on the other. Deliverables: APK, project report, poster.

## Capabilities and Constraints

Confirmed functionality:
- Roles per team: **owner** (team head, exactly one), **manager** (team leader), **member**. Only owner/manager create projects, create/assign/delete tasks, create invite codes, schedule or start meetings. Members only change status and progress of tasks assigned to them and upload proof.
- Projects with deadlines and colours; tasks with status (to do / in progress / review / done), priority, due date, estimate hours, progress, proof attachments (images or PDF, max 8 MB each, one per upload, no per-task limit).
- Risk dashboard: member workload % vs weekly capacity, project deadline-risk score 0–100 with reasons, at-risk tasks, rebalance suggestions, team health score.
- Real-time sync of tasks, activity, chat and meetings (Socket.io); activity log records whether a change came from web or mobile.
- Project chat (text, any team member), scheduled meetings (optional Google Meet/Zoom/Teams link) and built-in live video calls (WebRTC mesh, max 8 people).
- Mobile extras: biometric lock, local notifications, camera/gallery proof upload.

Technical constraints:
- One shared Express API and one shared MongoDB (Atlas) for web and mobile, with shared accounts (hackathon rule).
- Browser camera/mic only on `https://` or `localhost`, so hosted web must use HTTPS. Strict networks may need a TURN server (not set up).
- Uploaded files live on the server disk (`server/uploads/`); moving to cloud storage is undecided.

Terminology: "team head" = owner, "team leader" = manager. The UI currently shows the words "owner" and "manager".

Undecided: hosting provider for the API and web; Play Store vs direct APK distribution; in-app update prompt; cloud file storage.

## Brand Commitments

- Name: **TeamFlow**. Tagline in the app: "Your tasks, always in sync."
- Logo: three cream task bars and a coral check badge on a navy rounded tile. Files: `mobile/assets/icon/logo.svg`, `mobile/assets/icon/icon.png`, `client/public/favicon.svg`.
- The user has asked for navy `#14213D`, cream `#F4EDE0`, and coral `#FF6B5B` across the web and mobile apps.

## Evidence on Hand

- Demo data only: seeded fictional team "Coding Club Core Team" with users asha@, rahul@, priya@teamflow.dev (`server/scripts/seed.js`). The user's own test teams ("Bindas", "Abc", "uyu") live in their Atlas database.
- No real customers, testimonials, usage numbers, pricing, press or case studies exist. Do not invent any.
- Automated checks: `npm run check --prefix server` (64 permission/invite/chat/meeting checks), risk engine unit tests (`npm test --prefix server`).

## Product Principles

1. **Same truth on every device.** Anything done on the phone shows on the web at once, and the other way round; never design a feature that only works on one side without a clear reason.
2. **Leaders decide, members do.** Creation and assignment belong to owners and managers; members get the fastest possible path to update their own work and send proof.
3. **Built for work away from the desk.** Phone flows must work one-handed and quickly: swipe to complete, camera proof, notifications, join a meeting in one tap.
4. **Warn before it's late.** Surface overload and deadline risk with plain reasons and a suggested action, not just numbers.
5. **Trust through visibility.** Show who changed what and from which device; keep permissions enforced on the server, not only hidden in the UI.
