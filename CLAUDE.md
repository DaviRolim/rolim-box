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
bun run test:unit # Unit tests (bun test, pure helpers in unit/)
bun run test:e2e # Playwright E2E tests (builds, seeds e2e.db, never touches local.db)
bun run db:setup # Create tables + seed a LOCAL file: database
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

## Design

- Follow `docs/design-direction.md` ("Placar da Casa"). Tokens and shared classes are in
  `src/routes/layout.css`: `display`, `legend`, `sign`, `btn`, `tag`, `input`, `module`, `notice`, `led`.
- Colours are semantic tokens (`bg-bg`, `text-ink`, `text-dim`, `bg-pink` + `text-on-fill`, ...).
  Both grounds (Sol / Noite) must stay readable; never hard-code a ground colour.
- Pink means move. One painted (Londrina) phrase per screen. No shadows, gradients or rounded cards.
- Modals use `ui/Sheet.svelte`; confirmations use `ui/ConfirmDialog.svelte`.

## Conventions

- Screens under `(app)` have no server `load`: they read the layout data and `wodStore`, so
  navigation works offline. Keep it that way.
- Links and `goto()` use `resolve()` from `$app/paths` (dynamic routes need the full id, e.g.
  `resolve('/(app)/workouts/[id]', { id })`).

- Every user-facing string goes through `t` from `$lib/i18n` (English default, pt-BR second).
  Add the key to `src/lib/i18n/en/<area>.ts` and `pt/<area>.ts`; pt is typed as en's shape, so a
  missing key fails `bun run check`. Read `t` in markup, a function or `$derived` (never freeze it
  in a top-level const) so the EN | PT switch updates live. Server code uses
  `dictFor(locals.locale)`. Dates go through `$lib/date` (Intl with the active locale).
  Painted Londrina phrases ("Vai doer", "Bora!", "Acabou!") stay Portuguese in both languages;
  CrossFit terms (WoD, AMRAP, EMOM, For Time, PR...) stay English in both.

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
