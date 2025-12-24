# RolimBox

**RolimBox** is a modern, high-performance web application designed for managing fitness **Workouts of the Day (WoDs)**. Built with the latest web technologies, it offers a seamless experience for coaches and athletes to create, track, and organize workouts.

## 🚀 Key Features

- **WoD Management**: Create, edit, duplicate, and organize daily workouts with ease.
- **AI-Powered Assistance**: Use the "Magic Wand" to automatically generate workout sections and descriptions, streamlining the programming process.
- **Local-First Architecture**: Built with offline support in mind. Your data is cached locally for instant access and synced when you're back online.
- **Integrated Timer**: Built-in timers to run workouts directly within the app.
- **Modern UI/UX**: A sleek, responsive interface designed for both desktop and mobile use.

## 🛠️ Technology Stack

RolimBox is built on a cutting-edge stack focused on performance and developer experience:

- **Framework**: [Svelte 5](https://svelte.dev) & [SvelteKit](https://kit.svelte.dev)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com)
- **Database**: [Drizzle ORM](https://orm.drizzle.team) with [Turso (libSQL)](https://turso.tech)
- **Runtime & Package Manager**: [Bun](https://bun.sh) / Node.js
- **Validation**: [Zod](https://zod.dev)
- **AI Integration**: [Vercel AI SDK](https://sdk.vercel.ai)
- **Testing**: [Playwright](https://playwright.dev)

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) or [Bun](https://bun.sh/) installed on your machine.
- A [Turso](https://turso.tech/) account for the database (or use a local SQLite file).

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/DaviRolim/rolim-box.git
    cd rolim-box
    ```

2.  Install dependencies:
    ```bash
    npm install
    # or
    bun install
    ```

3.  Set up environment variables:
    Create a `.env` file in the root directory (copy from `.env.example` if available).
    ```bash
    DATABASE_URL=libsql://your-db-name.turso.io
    DATABASE_AUTH_TOKEN=your-auth-token
    # For local development:
    # DATABASE_URL=file:local.db
    ```

4.  Start the development server:
    ```bash
    npm run dev
    # or
    bun dev
    ```

## 🗄️ Database Management

RolimBox uses Drizzle ORM for database management.

```bash
# Push schema changes (Development)
bun run db:push

# Generate migrations
bun run db:generate

# Run migrations (Production)
bun run db:migrate

# Open Drizzle Studio to view data
bun run db:studio
```

## 🧪 Testing

We use Playwright for End-to-End (E2E) testing.

```bash
npm run test:e2e
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
