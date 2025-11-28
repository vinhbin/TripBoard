# TripBoard

Collaborative trip planner with auth, trips, availability voting, map pins, and AI itinerary suggestions.

## Stack

- Backend: Node.js/Express, MongoDB (Mongoose), sessions (connect-mongo), bcrypt, CORS
- Frontend: React (Vite), Axios, React Router, Google Maps (via `@react-google-maps/api`)
- AI: OpenAI Chat Completions (optional)
- DB: MongoDB Atlas (or local Mongo)

## Features

- User auth (session-based)
- Trips CRUD with members
- Availability voting per date (can/maybe/cannot)
- Interactive map pins (Google Maps) with place search/details
- AI itinerary suggestions appended to the trip plan
- Server-side stored plan text (CRUD)

## Prerequisites

- Node.js 20+ recommended
- MongoDB Atlas URI (or local Mongo)
- Google Maps JS API key (Maps + Places enabled)
- OpenAI API key (if using AI)

## Environment Variables

### Backend (`backend/.env`)

```
MONGODB_URI=...
SESSION_SECRET=...
NODE_ENV=development
PORT=5001
FRONTEND_URL=http://localhost:5173
OPENAI_API_KEY=...        # optional; leave unset to disable AI calls
```

### Frontend (`frontend/frontend/.env.local`)

```
VITE_API_URL=http://localhost:5001
VITE_GOOGLE_MAPS_API_KEY=...   # required for maps/search
```

## Run Locally

```bash
# Backend
cd backend
npm install
npm run dev   # uses PORT from .env (defaults 5001)

# Frontend
cd frontend/frontend
npm install
npm run dev   # default Vite port 5173
```

## Deployment (Render + Vercel)

1) Backend → Render
- Root dir: `backend`
- Build: `npm install`
- Start: `npm start`
- Env vars: `MONGODB_URI`, `SESSION_SECRET`, `NODE_ENV=production`, `FRONTEND_URL=<frontend URL>`, `OPENAI_API_KEY` (optional), `PORT` (Render provides).

2) Frontend → Vercel
- Root dir: `frontend/frontend`
- Build: `npm run build`
- Output: `dist`
- Env vars: `VITE_API_URL=<Render backend URL>`, `VITE_GOOGLE_MAPS_API_KEY`

3) Update backend `FRONTEND_URL` to your deployed frontend domain; redeploy backend.

## API Highlights (Backend)

- `POST /api/auth/register` | `POST /api/auth/login` | `POST /api/auth/logout` | `GET /api/auth/me`
- `GET /api/trips` | `POST /api/trips` | `GET /api/trips/:id` | `PUT /api/trips/:id` | `DELETE /api/trips/:id`
- Members: `POST /api/trips/:id/members` (owner), `DELETE /api/trips/:id/members/:memberId` (owner)
- Plan: `GET /api/trips/:id/plan` | `PUT /api/trips/:id/plan` | `DELETE /api/trips/:id/plan`
- Availability: `GET /api/trips/:id/availability` | `POST /api/trips/:id/availability` | `DELETE /api/trips/:id/availability`
- Pins: `GET /api/trips/:id/pins` | `POST /api/trips/:id/pins` | `PUT /api/pins/:pinId` | `DELETE /api/pins/:pinId`
- AI ideas: `POST /api/trips/:id/recommendations` (requires `OPENAI_API_KEY`; checks membership)

## Notes

- Sessions require HTTPS in production (`secure` cookies + `sameSite=none`).
- If OpenAI quota is exhausted, the AI endpoint will return an error.
- Google Maps requires billing-enabled key; restrict by HTTP referrer.
- Do not commit `.env` or `.env.local`; use hosting env vars.

## Scripts

- Backend: `npm run dev` (nodemon), `npm start`
- Frontend: `npm run dev`, `npm run build`, `npm run preview`

