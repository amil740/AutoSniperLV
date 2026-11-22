# AutoSniper LV

Latvian car market intelligence and deal-finder MVP built with Next.js,
TypeScript, Tailwind CSS, Supabase, and OpenAI.

## Setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Configure the Supabase and OpenAI variables in `.env.local`, then apply
`supabase/schema.sql` in the Supabase SQL editor.

## Render deployment

Push this repository to GitHub, then create a Render Blueprint from
`render.yaml`. In the Render dashboard, provide the environment variable values
listed in the blueprint.
