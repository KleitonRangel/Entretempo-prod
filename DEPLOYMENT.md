# Entretempo - Complete Deployment Guide

## Project Location
```
/c/Users/kleyt/Downloads/Entretempo
```

## Files Created for Deployment
- `vercel.json` - Vercel build configuration
- `.env.local` - Supabase credentials (placeholder values)
- `.gitignore` - Excludes node_modules, dist, .env, etc.
- `DEPLOYMENT.md` - Detailed deployment instructions

## Git Repository Setup

### 1. Initialize the repository
```bash
cd /c/Users/kleyt/Downloads/Entretempo
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/KleitonRangel/Entretimento.git
git push -u origin main
```

### 2. If the repository doesn't exist yet:
```bash
cd /c/Users/kleyt/Downloads/Entretempo
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/KleitonRangel/Entretimento.git
git push -u origin main
```

### 3. Configure Supabase credentials
Edit `.env.local` with your actual credentials:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key (from the Supabase dashboard)

## Deploy to Vercel

### Method 1: Via Vercel Dashboard
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **New Project** → **Import Git Repository**
3. Select your repository (main branch)
4. Configure Supabase integration:
   - In the deployment settings, add a new integration
   - Select **Supabase** from the list
   - Enter the `NEXT_PUBLIC_SUPABASE_ANON_KEY` 
5. Click **Deploy**

### Method 2: Via Command Line (if using GitHub)
```bash
cd /c/Users/kleyt/Downloads/Entretempo
git push origin main
```
Then go to Vercel dashboard and import from your GitHub repository.

## Supabase Integration Configuration
1. Go to [supabase.com](https://supabase.com) → New Project (or use existing)
2. Get your `SUPABASE_URL` and `SUPABASE_ANON_KEY`
3. Add them to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. In Vercel Dashboard → Settings → Integrations → Add Supabase integration
5. Use your anon key to authenticate with the Supabase backend

## Final Verification After Deploy
```bash
cd /c/Users/kleyt/Downloads/Entretempo
npm test
```

## Key Files Checklist
| File | Status | Notes |
|------|--------|-------|
| `vercel.json` | ✓ Created | Build command: npm run build, framework: nextjs |
| `.env.local` | ✓ Created | Contains placeholder Supabase credentials |
| `.gitignore` | ✓ Created | Excludes node_modules, dist, .env, etc. |
| `DEPLOYMENT.md` | ✓ Created | Full deployment guide |

## Post-Deployment Steps
1. Run `npm test` to verify nothing broke after deploy
2. Check Vercel dashboard for deployment status
3. Verify Supabase integration is working by checking API endpoints