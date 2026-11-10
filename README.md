# RolimBox

**RolimBox** is a modern, high-performance web application designed for managing fitness **Workouts of the Day (WoDs)**. Built with the latest web technologies, it offers a seamless experience for coaches and athletes to create, track, and organize workouts.

## 🚀 Key Features

- **WoD Management**: Create, edit, duplicate, and organize daily workouts with ease.
- **AI-Powered Assistance**: Use the "Magic Wand" to automatically generate workout sections and descriptions, streamlining the programming process.
- **Local-First Architecture**: Built with offline support in mind. Your data is cached locally for instant access and synced when you're back online.
- **Integrated Timer**: Built-in timers to run workouts directly within the app.
- **Built for the box**: readable from two metres, big touch targets, light and dark grounds, and a full-screen placar mode.
- **Installable PWA**: opens and runs the timers with no signal.
- **English or Portuguese**: an EN | PT switch at the top of every screen. English is the default;
  the choice is kept in a cookie so pages render in the right language, online or off.

## 🛠️ Technology Stack

RolimBox is built on a cutting-edge stack focused on performance and developer experience:

- **Framework**: [Svelte 5](https://svelte.dev) & [SvelteKit](https://kit.svelte.dev)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com)
- **Database**: [Drizzle ORM](https://orm.drizzle.team) with [Turso (libSQL)](https://turso.tech)
- **Runtime & Package Manager**: [Bun](https://bun.sh) / Node.js
- **Validation**: [Zod](https://zod.dev)
- **AI Integration**: [Vercel AI SDK](https://sdk.vercel.ai)
- **Testing**: [Playwright](https://playwright.dev)

## 🎨 Design

The interface follows one direction, written down in [docs/design-direction.md](docs/design-direction.md):
**Placar da Casa**, a scoreboard hung on the wall of grandma's house. Read it before changing
anything visual. The tokens and shared classes live in `src/routes/layout.css`.

Before/after screenshots of every screen and state are in `screenshots/before` and
`screenshots/revamp` (phone 390x844 and desktop 1440x900).

## 🏁 Getting Started

### Run it locally, no accounts needed

```bash
bun install
cp .env.example .env          # then set DATABASE_URL="file:local.db"
bun run db:setup              # creates the tables and seeds a realistic box
bun dev
```

Log in as a coach with `davi@rolimbox.test` or as an athlete with `bia@rolimbox.test`
(password `rolimbox123` for every seeded account). The seed refuses to run against anything
that is not a local `file:` database.

The Magic Wand needs `OPENROUTER_API_KEY`. Without it the editor says so and everything else
works.

### With Turso

Set `DATABASE_URL` and `DATABASE_AUTH_TOKEN` in `.env` (see `.env.example`), then:

```bash
bun run db:push
bun dev
```

## 🗄️ Database Management

RolimBox uses Drizzle ORM for database management.

```bash
bun run db:push      # Push schema changes (development)
bun run db:generate  # Generate migrations
bun run db:migrate   # Run migrations (production)
bun run db:studio    # Open Drizzle Studio
bun run db:seed      # Wipe and reseed the LOCAL database
```

## 🧪 Testing

```bash
bun run check        # svelte-check (types)
bun run lint         # Prettier + ESLint
bun run test:unit    # pure helpers (bun test)
bun run test:e2e     # Playwright, against its own seeded e2e.db
bun run test         # unit + e2e
```

The e2e suite builds the app, seeds `e2e.db` and covers login, today's WoD, placar mode, WoD
create / edit / duplicate / delete, the Magic Wand without a key, the timers, PRs, and working
offline (including a WoD written offline and synced later).

Language screenshots (login, Today, editor, timer in EN and PT) are in `screenshots/i18n`; retake
them with `node scripts/screenshots-i18n.mjs --base http://localhost:4173`.

To retake the screenshots: `bun --bun run build && bun run preview`, then `bun run screenshots`
with `--base http://localhost:4173`.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
