# Google OAuth Setup for Web Application

This guide explains how to set up Google OAuth for the Quest web application.

## Prerequisites

1. Google Cloud Console access
2. A Google Cloud Project
3. OAuth 2.0 credentials configured

## Step 1: Google Cloud Console Configuration

### 1.1 Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client IDs**

### 1.2 Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type
3. Fill in the required information:
   - App name: "Quest"
   - User support email: Your email
   - Developer contact information: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`

### 1.3 Create Web Application Credentials

1. In **Credentials**, click **Create Credentials** > **OAuth 2.0 Client IDs**
2. Choose **Web application**
3. Name: "Quest Web App"
4. Add authorized redirect URIs:
   - `http://localhost:3001/oauth-callback` (for development)
   - `https://yourdomain.com/oauth-callback` (for production)
5. Click **Create**

### 1.4 Get Client ID and Client Secret

After creating the credentials, you'll get:
- **Client ID**: `103202343935-6vlrt2vn73bbkalmoqmkgen6lumh7e3a.apps.googleusercontent.com`
- **Client Secret**: (Download the JSON file to get this)

## Step 2: Environment Configuration

### 2.1 Set Environment Variables

Add the following to your `.env` file:

```env
GOOGLE_CLIENT_ID=103202343935-6vlrt2vn73bbkalmoqmkgen6lumh7e3a.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

### 2.2 Update Client ID in Code

The client ID is already configured in the following files:
- `src/client/js/login.js` (line 15)
- `src/server/services/authService.js` (line 347)

## Step 3: Testing the OAuth Flow

### 3.1 Start the Server

```bash
npm start
```

### 3.2 Test the Login Flow

1. Go to `http://localhost:3001/login`
2. Click the **"Continue with Google"** button
3. Complete the Google OAuth flow
4. You should be redirected to your Quest space

## Step 4: Production Deployment

### 4.1 Update Redirect URIs

For production, update the redirect URIs in Google Cloud Console:
- Remove: `http://localhost:3001/oauth-callback`
- Add: `https://yourdomain.com/oauth-callback`

### 4.2 Update Environment Variables

Set production environment variables:
```env
GOOGLE_CLIENT_ID=103202343935-6vlrt2vn73bbkalmoqmkgen6lumh7e3a.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_production_client_secret
```

## Troubleshooting

### Common Issues

1. **"redirect_uri_mismatch" Error**
   - Ensure the redirect URI in Google Cloud Console matches exactly
   - Check for trailing slashes or protocol mismatches

2. **"invalid_client" Error**
   - Verify your client ID and client secret
   - Ensure environment variables are set correctly

3. **"access_denied" Error**
   - Check OAuth consent screen configuration
   - Verify required scopes are added

4. **"state parameter mismatch"**
   - This is handled automatically by the application
   - If it persists, clear browser session storage

### Debug Steps

1. Check browser console for JavaScript errors
2. Check server logs for backend errors
3. Verify Google Cloud Console configuration
4. Test with a fresh browser session

## Security Notes

1. **Never commit client secrets to version control**
2. **Use environment variables for sensitive data**
3. **Enable HTTPS in production**
4. **Regularly rotate client secrets**
5. **Monitor OAuth usage in Google Cloud Console**

## Files Modified

The following files were added/modified for OAuth support:

### Frontend
- `src/client/pages/login.html` - Added OAuth button and styling
- `src/client/js/login.js` - Added OAuth flow logic
- `src/client/pages/oauth-callback.html` - New OAuth callback page

### Backend
- `src/server/services/authService.js` - Added `handleWebGoogleOAuth` function
- `src/server/routes/auth.js` - Added `/google-oauth-web` route
- `src/server/index.js` - Added `/oauth-callback` route

## OAuth Flow Summary

1. User clicks "Continue with Google" button
2. User is redirected to Google OAuth consent screen
3. User authorizes the application
4. Google redirects to `/oauth-callback` with authorization code
5. Backend exchanges code for access token
6. Backend gets user info from Google
7. User is created/authenticated in Quest database
8. User is redirected to Quest space

The OAuth flow is now fully integrated with the existing authentication system and will work alongside email/password login. 