# Alzooka Deployment Guide

## Prerequisites
- A Supabase account with your database set up
- A Vercel account (free tier works great)
- Your environment variables from `.env.local`

## Quick Deploy to Vercel

### Method 1: GitHub Integration (Recommended)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Deploy on Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings

3. **Configure Environment Variables:**
   - In the Vercel dashboard, go to: Project Settings → Environment Variables
   - Add the following variables from your `.env.local`:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Click "Deploy"

### Method 2: Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login and Deploy:**
   ```bash
   vercel login
   vercel
   ```

3. **Follow the prompts:**
   - Set up environment variables when prompted
   - Vercel will deploy your app

## Post-Deployment Steps

### 1. Update Supabase Authentication Settings
After deployment, you need to whitelist your Vercel domain in Supabase:

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to: Authentication → URL Configuration
3. Add your Vercel URL to "Site URL": `https://your-app.vercel.app`
4. Add to "Redirect URLs":
   - `https://your-app.vercel.app/**`
   - `http://localhost:3000/**` (for local development)

### 2. Update CORS Settings (if needed)
If you have custom API routes, ensure Supabase allows requests from your Vercel domain.

### 3. Storage Bucket Permissions
Ensure your Supabase storage buckets (`avatars`, `post-images`) have the correct RLS policies:
- Public read access for images
- Authenticated write access

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key | ✅ Yes |

## Troubleshooting

### Authentication Issues
- ✅ Check that your Vercel URL is in Supabase redirect URLs
- ✅ Verify environment variables are set correctly
- ✅ Clear browser cache and cookies

### Database Connection Issues
- ✅ Verify Supabase project is active
- ✅ Check that RLS (Row Level Security) policies are configured
- ✅ Ensure API keys are correct

### Image Upload Issues
- ✅ Check Supabase storage bucket policies
- ✅ Verify bucket names match: `avatars` and `post-images`
- ✅ Ensure authenticated users have upload permissions

## Development vs Production

Your `.env.local` is for local development only. In production (Vercel), environment variables are set through the Vercel dashboard.

**Never commit `.env.local` to git!** (It's already in `.gitignore`)

## Useful Commands

```bash
# Run locally
npm run dev

# Build for production
npm run build

# Start production server locally
npm start

# Run linter
npm run lint

# Deploy to Vercel
vercel --prod
```

## Need Help?

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Supabase Docs](https://supabase.com/docs)
