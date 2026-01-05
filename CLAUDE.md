# RolimBox

CrossFit Workout Management & Timer PWA for coaches and box owners.

## Tech Stack

- **Framework**: SvelteKit + Svelte 5 (runes-based reactivity)
- **Styling**: Tailwind CSS v4
- **Database**: Drizzle ORM + Turso (libSQL/SQLite)
- **Validation**: Zod v4
- **AI**: Vercel AI SDK + OpenAI
- **Runtime**: Bun

## Commands

```bash
bun dev          # Start dev server
bun run build    # Production build
bun run check    # TypeScript check
bun run lint     # ESLint + Prettier check
bun run test:e2e # Playwright E2E tests
bun run db:push  # Push schema changes
bun run db:studio # Open Drizzle Studio
```

## Key Concepts

- **WoD** (Workout of the Day): Has date, description, and multiple sections
- **Section**: Part of a WoD (warmup, skill, wod, cooldown, stretches, custom) with optional timer
- **Timer Types**: AMRAP, EMOM, FOR TIME, TABATA with audio cues
- **Workspace**: Multi-user support with roles (owner, coach, member)
- **PR**: Personal Records for exercises (weight, time, reps, distance)

## Project Structure

```
src/
├── lib/
│   ├── components/     # Svelte components
│   ├── server/db/      # Drizzle schema + server DB
│   ├── services/       # Business logic (timer-engine, audio, sync)
│   ├── stores/         # Svelte 5 stores (.svelte.ts files)
│   └── types/          # TypeScript types + Zod schemas
├── routes/
│   ├── (app)/          # Authenticated routes (dashboard, workouts, timers, prs)
│   ├── (auth)/         # Login/register
│   └── api/            # REST endpoints
```

## Conventions

- Use Svelte 5 runes (`$state`, `$derived`, `$effect`) - no legacy stores
- Stores use `.svelte.ts` extension with class-based pattern
- API routes return JSON with consistent error handling
- Types and Zod schemas co-located in `src/lib/types/`
- Local-first: IndexedDB cache with server sync
- Timer values stored in seconds, PR values in base units (grams, seconds, centimeters)

## Database Schema

Key tables: `user`, `session`, `workspace`, `workspaceMember`, `wod`, `section`, `exercise`, `personalRecord`

Section types: `'warmup' | 'skill' | 'wod' | 'cooldown' | 'stretches' | 'custom'`
Timer types: `'amrap' | 'emom' | 'fortime' | 'tabata'`
