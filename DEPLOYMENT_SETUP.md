# Entretempo - Vercel Deployment Setup Complete

## Files Created/Updated:
- `vercel.json` - Build configuration for Vercel
- `.env.local` - Supabase credentials (replace with actual values)
- `.gitignore` - Excludes node_modules, dist, .env, .env.local

## Git Repository Setup
Run the following commands in your terminal:
```bash
cd /c/Users/kleyt/Downloads/Entretempo
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/KleitonRangel/Entretempo.git
git push -u origin main
```

## Vercel Deployment Steps:
1. Go to https://vercel.com and sign in
2. Create a new project → "Import Git Repository"
3. Select the `main` branch from the Entretengo repository
4. Configure Supabase integration using the anon key from `.env.local`
5. Click "Deploy"

## Supabase Configuration:
1. Go to https://supabase.com → New Project
2. Create a new project and note the URL and anonymous key
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`
4. In Vercel dashboard, configure Supabase integration using the anon key
5. Run `npm test` after deploy to confirm everything works

## Verification:
After deployment, run locally to verify nothing broke:
```bash
cd /c/Users/kleyt/Downloads/Entretempo
npm test
```

## Environment Variables (for local development):
- `NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`