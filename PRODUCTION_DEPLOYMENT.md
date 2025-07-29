# Production Deployment Guide for Quest Extension

This guide will help you deploy the Quest extension and backend to production.

## Prerequisites

1. Vercel account
2. Google Cloud Console access
3. Supabase project

## Step 1: Update Google OAuth for Production

### 1.1 Update Google OAuth Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to your project → APIs & Services → Credentials
3. Find your OAuth 2.0 Client ID
4. **Add production redirect URI:**
   ```
   https://quest-jmzuj65mw-chris-jins-projects.vercel.app/api/v1/auth/google/callback
   ```

### 1.2 Update Extension Manifest

The extension manifest already includes the correct production host permissions.

## Step 2: Set Up Environment Variables in Vercel

### 2.1 Required Environment Variables

Set these in your Vercel project dashboard:

```bash
# Supabase Configuration
SUPABASE_URL=https://wlpitstgjomynzfnqkye.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGl0c3Rnam9teW56Zm5xa3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMzMyNzIsImV4cCI6MjA1OTcwOTI3Mn0.7HpEjNdnfOIeYn4nnooaAhDUqrA8q07nWtxFzVwzHck
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGl0c3Rnam9teW56Zm5xa3llIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDEzMzI3MiwiZXhwIjoyMDU5NzA5MjcyfQ.dttyUPithJWr51dtpkJ6Ln5XnxZssHBI1tW-OCcbLKw

# Google OAuth
GOOGLE_CLIENT_SECRET=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


### 2.2 How to Set Environment Variables

**Option A: Vercel Dashboard**
1. Go to your Vercel project
2. Navigate to Settings → Environment Variables
3. Add each variable with the Production environment selected

**Option B: Vercel CLI**
```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add GOOGLE_CLIENT_SECRET
vercel env add JWT_SECRET
```

## Step 3: Deploy to Production

### 3.1 Deploy Backend

```bash
# Make sure you're in the project root
cd /path/to/quest-web

# Deploy to Vercel
npm run deploy
```

Or manually:
```bash
vercel --prod
```

### 3.2 Verify Deployment

1. Check your Vercel dashboard for the deployment URL
2. Test the health endpoint: `https://quest-jmzuj65mw-chris-jins-projects.vercel.app/api/v1/health`
3. Verify Google OAuth: `https://quest-jmzuj65mw-chris-jins-projects.vercel.app/api/v1/auth/google/login?extension=true`

## Step 4: Update Extension for Production

### 4.1 Update Extension Files

The extension is already configured for production with:
- ✅ Production API URL: `https://quest-jmzuj65mw-chris-jins-projects.vercel.app/api/v1`
- ✅ Google OAuth configuration
- ✅ Proper host permissions

### 4.2 Package Extension

```bash
# Create production extension package
cd quest-extension-release
zip -r quest-extension-production.zip . -x "*.DS_Store" "*.git*"
```

## Step 5: Test Production Deployment

### 5.1 Test Backend Endpoints

```bash
# Test health endpoint
curl https://quest-jmzuj65mw-chris-jins-projects.vercel.app/api/v1/health

# Test Google OAuth endpoint
curl https://quest-jmzuj65mw-chris-jins-projects.vercel.app/api/v1/auth/google/login?extension=true
```

### 5.2 Test Extension

1. Load the production extension in Chrome
2. Test Google OAuth login
3. Test saving insights
4. Verify all functionality works

## Step 6: Publish Extension (Optional)

### 6.1 Chrome Web Store

1. Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Upload the extension package
3. Fill in store listing details
4. Submit for review

### 6.2 Manual Distribution

For internal use, you can:
1. Share the extension files directly
2. Use Chrome's "Load unpacked" feature
3. Distribute via your own website

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Make sure your Vercel domain is in the extension's host permissions
2. **OAuth Errors**: Verify redirect URIs in Google Console match your production domain
3. **Environment Variables**: Check that all variables are set in Vercel dashboard
4. **Database Issues**: Ensure Supabase is accessible from production

### Debug Steps:

1. Check Vercel deployment logs
2. Test endpoints individually
3. Verify environment variables are loaded
4. Check browser console for errors

## Security Considerations

1. **Environment Variables**: Never commit secrets to version control
2. **HTTPS**: Production uses HTTPS by default
3. **CORS**: Properly configured for extension
4. **OAuth**: Secure token exchange on backend

## Monitoring

1. **Vercel Analytics**: Monitor API usage and performance
2. **Supabase Dashboard**: Monitor database usage
3. **Google Cloud Console**: Monitor OAuth usage
4. **Extension Analytics**: Track user engagement

## Rollback Plan

If issues occur:
1. Revert to previous Vercel deployment
2. Update extension to use previous API URL
3. Test thoroughly before re-deploying

---

**Production URL**: `https://quest-jmzuj65mw-chris-jins-projects.vercel.app`
**Extension ID**: `jcjpicpelibofggpbbmajafjipppnojo`
**Google OAuth Client ID**: `103202343935-5dkesvf5dp06af09o0d2373ji2ccd0rc.apps.googleusercontent.com` 