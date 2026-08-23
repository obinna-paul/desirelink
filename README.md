# DesireLink

Real-time adult social marketplace connecting people, creators, communities, and offline experiences. Web-first, PWA-ready, mobile-responsive.

## Tech stack

- [Next.js 14](https://nextjs.org/) (App Router) + TypeScript
- [Supabase](https://supabase.com/) (PostgreSQL, Auth, Storage)
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- [Prisma ORM](https://www.prisma.io/) (optional, Supabase client used by default)
- [Zustand](https://github.com/pmndrs/zustand) for state management
- [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) for forms
- [date-fns](https://date-fns.org/) for date handling
- [next-pwa](https://github.com/shadowwalker/next-pwa) for PWA support (added later)

## Folder structure

```
app/          routes, layouts, pages (Next.js App Router)
components/   reusable UI (includes components/ui from shadcn)
lib/          utilities, API clients (e.g. lib/supabase)
hooks/        custom React hooks
types/        shared TypeScript types
supabase/     schema.sql and migrations/
```

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.local` (already scaffolded with placeholders) and fill in real values from your Supabase project (Project Settings > API):

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   DATABASE_URL=
   ```

3. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

4. **Apply the database schema**

   Run `supabase/schema.sql` in the Supabase SQL editor, or via the Supabase CLI:

   ```bash
   supabase db push
   ```

## Adding shadcn/ui components

```bash
npx shadcn@latest add <component>
```

## Scripts

- `npm run dev` – start the dev server
- `npm run build` – production build
- `npm run start` – start the production server
- `npm run lint` – run ESLint
