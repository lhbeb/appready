# =====================================================
# VERCEL DEPLOYMENT GUIDE
# =====================================================

## Prerequisites
1. Vercel account (free tier available)
2. GitHub repository with your code
3. Supabase project configured

## Step 1: Remove .env from Repository
```bash
# IMPORTANT: Remove .env from git tracking
git rm --cached .env
git commit -m \"Remove .env from tracking\"
```

## Step 2: Configure Environment Variables in Vercel

1. Go to your Vercel dashboard
2. Import your GitHub repository
3. Go to Project Settings → Environment Variables
4. Add these variables:

```
VITE_SUPABASE_URL=https://vccijkvrptbtqpaghviq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjY2lqa3ZycHRidHFwYWdodmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMDQxMjUsImV4cCI6MjA3MjY4MDEyNX0.YoSj_YIwSj6ukuFUZgvEvKuio2xgQ3r7_5OqnF45GFw
```

## Step 3: Build Settings

- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

## Step 4: Domain Configuration

- Your app will be available at: `https://your-project-name.vercel.app`
- Custom domain can be configured in Project Settings

## Step 5: HTTPS Requirement

✅ Vercel automatically provides HTTPS
✅ This enables camera/webcam functionality
✅ Required for react-webcam to work properly

## Step 6: Performance Optimizations

- ✅ Vite automatically optimizes bundle size
- ✅ Image compression via compressorjs
- ✅ Code splitting and lazy loading

## Step 7: Monitoring

- Use Vercel Analytics for performance monitoring
- Supabase dashboard for database/storage monitoring
- Consider removing supabaseMonitor.ts in production

## Security Checklist

- ✅ Environment variables not in code
- ✅ Supabase RLS policies configured
- ✅ HTTPS enabled
- ✅ No sensitive data in client code

## Post-Deployment Testing

1. Test camera functionality (requires HTTPS)
2. Test file uploads to Supabase
3. Test form submissions
4. Test on mobile devices
5. Test video verification workflow

## Troubleshooting

Common issues:
- Camera not working: Ensure HTTPS is enabled
- Environment variables: Check Vercel project settings
- Build errors: Fix TypeScript/ESLint issues first
- CORS issues: Check Supabase CORS settings

## Performance Considerations

- First load: ~500KB (optimized)
- Images: Compressed via compressorjs
- Videos: WebM format for efficiency
- Database: Indexed queries for performance