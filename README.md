# TeamFlow — Smart Team Productivity & Project Manager

**MERNOVA X 2026 · Domain: AI Productivity**

TeamFlow is a shared workspace for student teams, clubs and small businesses. Managers plan projects and assign tasks on the **web**. Members update progress, attach photo proof and get notified on their **phone**. Both apps use **one Express API and one MongoDB**, so a change on one platform shows up on the other instantly.

**Standout feature: the Workload & Deadline Risk dashboard.** It shows:
- which members are overloaded, as a percentage of their weekly capacity
- which projects are likely to miss their deadline, with a forecast date and the reasons
- which tasks need attention right now
- one-click **rebalance suggestions** that move work from an overloaded member to someone with free capacity

## Architecture

```
 React web (client/)            Flutter app (mobile/)
   manager view                   member view
        │  REST + Socket.io            │  REST + Socket.io
        └──────────────┬───────────────┘
                       ▼
          Express API (server/)  ── JWT auth, validation (zod), roles,
                       │             risk engine, file uploads, live events
                       ▼
                 MongoDB (one shared database)
```

| Layer    | Tech                         | Role |
|----------|------------------------------|------|
| Database | MongoDB + Mongoose           | Users, Teams, Projects, Tasks, Activity |
| API      | Node.js + Express            | Auth, validation, business logic, risk engine, Socket.io |
| Web      | React 18 + Vite              | Risk dashboard, kanban board, projects, members, CSV reports |
| Mobile   | Flutter (Dart)               | My tasks, quick status/progress, camera proof, notifications, biometric lock |

## Repository layout

```
teamflow/
├── client/        React web app (Vite)
├── mobile/        Flutter app (lib/, pubspec.yaml)
├── server/        Shared Express API
│   ├── config/  controllers/  middleware/  models/  routes/
│   ├── services/  (risk engine, realtime, activity log)
│   ├── validators/  scripts/ (seed, in-memory dev DB)  tests/
├── package.json   (helper scripts)
└── README.md
```

## Quick start (local)

Requirements: Node 20+, Flutter 3.x, and MongoDB (local, Atlas, or none: see the demo mode below).

```bash
npm run install:all
```

### 1. API

Create a file `server/.env` (it is git-ignored, so it never gets uploaded) with these settings:

```ini
PORT=4000
# MongoDB Atlas connection string (keep "/teamflow" before the "?"), or a local one:
# mongodb://127.0.0.1:27017/teamflow
MONGO_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/teamflow?retryWrites=true&w=majority
# Long random string: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=7d
# Comma-separated web origins allowed to call the API ("*" = any, fine for local dev)
CORS_ORIGINS=*
NODE_ENV=development
```

If the API is hosted on a different domain from the website, also create `client/.env` with `VITE_API_URL=https://your-api-url`. For the mobile app, pass the API address at build time with `--dart-define=API_URL=https://your-api-url`, or set it in the app's Server settings.

Then run:

```bash
npm run seed                     # optional demo data
npm run server                   # http://localhost:4000/api
```

**No MongoDB installed?** Run `npm run server:demo`. It starts an in-memory MongoDB with demo data already loaded. The data resets when the server stops.

The server prints its LAN address on startup, e.g. `http://192.168.1.106:4000/api`. Use that address on a physical phone.

### 2. Web

```bash
npm run web                      # http://localhost:5173
```

Vite proxies `/api`, `/uploads` and `/socket.io` to `localhost:4000`.

### 3. Mobile

```bash
cd mobile
flutter run                      # emulator uses http://10.0.2.2:4000 automatically
```

On a real phone, tap the **server icon** on the login screen and enter `http://<laptop-LAN-IP>:4000`. The phone and laptop must be on the same Wi-Fi. To bake in a deployed API:

```bash
flutter build apk --release --dart-define=API_URL=https://your-api.onrender.com
```

The APK is written to `mobile/build/app/outputs/flutter-apk/app-release.apk`.

### Demo accounts (after seeding)

All three use the password `demo1234`. To add more people, Asha creates a one-time invite code on the **Members** page (codes look like `COD7K2`).

| Email | Role |
|---|---|
| asha@teamflow.dev | Owner (use on web) |
| rahul@teamflow.dev | Member, deliberately overloaded |
| priya@teamflow.dev | Member (use on mobile) |

## How the risk engine works (`server/services/risk.js`)

1. **Member workload.** Each open task adds `remaining hours × priority weight × urgency weight`.
   - Priority weights: low 0.8, medium 1, high 1.3, critical 1.6.
   - Urgency weights: overdue 1.5, due within 2 days 1.3, within 7 days 1.0, within 14 days 0.6, later 0.3, no due date 0.6.
   - Load % = total ÷ weekly capacity. ≥ 100% is *overloaded*, ≥ 75% *busy*, < 30% *available*, anything else *balanced*.
2. **Project deadline risk.**
   - Velocity = hours of work completed per day over the last 14 days. If fewer than 2 tasks were completed, it falls back to the assignees' capacity.
   - Projected days = remaining hours ÷ velocity.
   - Pace ratio = projected days ÷ days left.
   - Score = pace × 70 + overdue × 8 + unassigned × 3 + overloaded assignees × 10, capped at 100.
   - Levels: low, medium, high, critical. Each project gets human-readable reasons.
3. **Rebalance suggestions.** For each overloaded member, the engine moves their lowest-priority movable task to the least-loaded teammate who would stay under 85% load.

The engine is pure functions with unit tests: `npm test --prefix server`.

## API overview

All routes are under `/api`. Every route except register, login and health needs `Authorization: Bearer <token>`.

| Method | Route | Who |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | anyone |
| GET/PATCH | `/auth/me` | signed in |
| GET/POST | `/teams` · POST `/teams/join` | signed in |
| GET/PATCH/DELETE | `/teams/:teamId` | member / manager / owner |
| GET / POST | `/teams/:teamId/invites` | manager |
| DELETE | `/teams/:teamId/invites/:inviteId` | manager |
| PATCH/DELETE | `/teams/:teamId/members/:userId` | owner / manager (or self to leave) |
| GET | `/teams/:teamId/dashboard` | member: **risk dashboard** |
| GET | `/teams/:teamId/activity`, `/teams/:teamId/reports/tasks.csv` | member |
| GET/POST | `/teams/:teamId/projects` | member / manager |
| GET/PATCH/DELETE | `/projects/:projectId` | member / manager |
| GET | `/teams/:teamId/tasks` | member |
| POST | `/teams/:teamId/tasks` (create task) | manager |
| GET | `/tasks/mine` | signed in |
| GET/PATCH/DELETE | `/tasks/:taskId` | member (own tasks) / manager |
| POST/DELETE | `/tasks/:taskId/attachments[/:id]` | assignee / manager |

**Real-time events** (Socket.io, authenticated with the same JWT):
- `task:created`, `task:updated`, `task:deleted`
- `project:changed`, `team:updated`
- `activity:new`
- `notify`: personal "task assigned to you" message

**Security:**
- bcrypt password hashing and JWT auth
- zod validation on every body and query
- role checks for team owner, manager and member
- helmet and a rate limit on auth routes
- upload type and size limits
- CSV formula-injection escaping

## Demo script (for the jury)

1. Web: log in as **Asha** and open the **Risk dashboard**. Rahul is overloaded and the Hackathon project is critical.
2. Phone: log in as **Rahul**. "My tasks" shows his overdue tasks in red.
3. Phone: swipe a task to **Done**, or take a photo as proof. On the web, a toast appears, the activity feed shows a *MOBILE* badge, and the risk numbers recalculate live.
4. Web: click **Apply** on a rebalance suggestion. Priya's phone gets a notification and the task appears in her list.
5. Show validation (bad form input) and access control (a member trying to reassign someone else's task gets a 403).

## Deployment

- **Database:** MongoDB Atlas (free M0 cluster).
- **API:** Render or Railway. Set `MONGO_URI`, `JWT_SECRET`, `NODE_ENV=production` and `CORS_ORIGINS=https://<your-web-domain>`. Uploads are stored on local disk, so use a persistent disk or swap in Cloudinary/S3 for production.
- **Web:** Vercel or Netlify with `VITE_API_URL=https://<api-domain>`. Alternatively, build `client/` and let the API serve `client/dist` when `NODE_ENV=production`.
- **Mobile:** run `npm run build:apk` with `--dart-define=API_URL=...`.

## Future scope

- AI task assistant: suggest an assignee and an estimate from task text, and generate a weekly status summary.
- Google Calendar sync and email digests.
- Offline mode with sync queue on mobile; push notifications via FCM when the app is closed.
- Burndown charts and per-member velocity history.


npm run server
npm run web