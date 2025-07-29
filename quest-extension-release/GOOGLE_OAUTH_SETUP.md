# Google OAuth Setup for Quest Extension

This guide will help you set up Google OAuth authentication for the Quest extension using the proper Chrome extension OAuth flow.

## Prerequisites

1. A Google Cloud Console account
2. Access to the Quest backend API

## Step 1: Create Google OAuth 2.0 Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API and Google OAuth2 API
4. Go to "Credentials" in the left sidebar
5. Click "Create Credentials" → "OAuth 2.0 Client IDs"
6. Choose "Chrome Extension" as the application type
7. Enter your extension ID: `jcjpicpelibofggpbbmajafjipppnojo`
8. Add the following redirect URI: `https://jcjpicpelibofggpbbmajafjipppnojo.chromiumapp.org/`
9. Save the client ID and client secret

## Step 2: Configure Backend Environment

1. Set the Google Client Secret as an environment variable:
   ```bash
   export GOOGLE_CLIENT_SECRET="your-actual-client-secret"
   ```
   
   Or add it to your `.env` file:
   ```
   GOOGLE_CLIENT_SECRET=your-actual-client-secret
   ```

2. The extension is already configured with your Google Client ID: `103202343935-s0f465oi9geq1jg2jdnvbmf4nn9en4l4.apps.googleusercontent.com`

## Step 3: Backend Implementation

The backend endpoints are already implemented:

### 1. Google OAuth Authentication Endpoint (`/api/v1/auth/google`)

This endpoint:
- Receives Google user info from the extension
- Creates or updates the user in your database
- Returns the user data to the extension

## Step 4: Extension Configuration

The extension is configured to use Chrome's `identity` API for OAuth:

1. **Manifest.json**: Includes `identity` permission and OAuth2 configuration
2. **popup.js**: Uses `chrome.identity.launchWebAuthFlow()` for OAuth
3. **Backend Integration**: Sends user data to `/api/v1/auth/google` endpoint

## Step 5: Testing

1. Make sure your backend is running:
   ```bash
   npm run dev
   ```

2. Load the extension in Chrome
3. Click the "Continue with Google" button
4. Complete the Google OAuth flow
5. Verify that the user is logged in and can save insights

## Troubleshooting

### Common Issues:

1. **"Invalid client" error**: 
   - Make sure your Google Client ID is correct
   - Verify the extension ID matches in Google Console
   - Check that the redirect URI is added correctly

2. **"Redirect URI mismatch" error**:
   - Add `https://jcjpicpelibofggpbbmajafjipppnojo.chromiumapp.org/` to your Google OAuth authorized redirect URIs

3. **"Client secret not found" error**:
   - Set the `GOOGLE_CLIENT_SECRET` environment variable
   - Restart your backend server

4. **"Permission denied" error**:
   - Make sure the `identity` permission is included in manifest.json
   - Check that the OAuth2 configuration is correct

### Debug Steps:

1. Check the browser console for error messages
2. Verify the OAuth flow launches correctly
3. Test the backend endpoint: `curl -X POST http://localhost:3001/api/v1/auth/google -H "Content-Type: application/json" -d '{"email":"test@example.com","name":"Test User"}'`
4. Check that the user session is saved correctly

## Security Considerations

1. **Client Secret**: Never commit your client secret to version control
2. **HTTPS**: Use HTTPS in production for secure OAuth flow
3. **Environment Variables**: Store sensitive data in environment variables
4. **Extension ID**: The extension ID is tied to your specific Chrome extension

## Next Steps

1. Get your Google Client Secret from Google Cloud Console
2. Set it as an environment variable: `export GOOGLE_CLIENT_SECRET="your-secret"`
3. Restart your backend server
4. Test the Google login flow

The implementation is now complete and ready for testing with your specific extension ID! 