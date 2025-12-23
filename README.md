# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Database

This project uses [Turso](https://turso.tech) (libSQL) with Drizzle ORM.

### Environment Variables

Create a `.env` file with:

```sh
DATABASE_URL=libsql://your-db-name.turso.io
DATABASE_AUTH_TOKEN=your-auth-token
```

For local development, you can use a local SQLite file:

```sh
DATABASE_URL=file:local.db
```

### Database Commands

```sh
# Push schema changes directly (development)
bun run db:push

# Generate migrations
bun run db:generate

# Run migrations (production)
bun run db:migrate

# Open Drizzle Studio
bun run db:studio
```
