# Google OAuth Setup for Chrome Extension

## 🚨 Current Issue: OAuth Client Deleted

Your current OAuth client has been deleted from Google Cloud Console. You need to create a new one.

## Step-by-Step Setup

### 1. Create New OAuth Client

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/
   - Select your project

2. **Navigate to Credentials:**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"

3. **Configure OAuth Client:**
   - **Application type:** Chrome Extension
   - **Name:** Quest Chrome Extension (or any name you prefer)
   - **Item ID:** Leave this empty for now (we'll get it in the next step)

4. **Save the new client ID**

### 2. Get Your Extension ID

1. **Open Chrome:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Find your Quest extension
   - Copy the Extension ID (it looks like: `abcdefghijklmnopqrstuvwxyz123456`)

### 3. Update OAuth Client with Extension ID

1. **Go back to Google Cloud Console:**
   - Find your newly created Chrome Extension OAuth client
   - Click on it to edit
   - In the "Item ID" field, paste your extension ID
   - Save the changes

### 4. Update Your Extension Code

1. **Update the client ID in your extension:**
   - Open `quest-extension-release/popup.js`
   - Find line with `GOOGLE_CLIENT_ID`
   - Replace with your new client ID

2. **Update the manifest:**
   - Open `quest-extension-release/manifest.json`
   - Find the `oauth2.client_id` field
   - Replace with your new client ID

### 5. Test the OAuth Flow

1. **Reload your extension:**
   - Go to `chrome://extensions/`
   - Click the refresh icon on your Quest extension

2. **Test Google OAuth:**
   - Open your extension
   - Click "Continue with Google"
   - Should now work without the "deleted_client" error

## Important Notes

- **Wait time:** Changes in Google Cloud Console may take 2-3 minutes to propagate
- **Extension ID:** Must match exactly in Google Cloud Console
- **Client ID format:** Should end with `.apps.googleusercontent.com`
- **Redirect URI:** Automatically generated as `https://[extension-id].chromiumapp.org/`

## Troubleshooting

### If you still get errors:
1. **Check the console logs** in your extension for the exact redirect URI
2. **Verify the extension ID** matches exactly in Google Cloud Console
3. **Wait 3-5 minutes** for changes to propagate
4. **Clear browser cache** and try again

### Common Issues:
- **Wrong application type:** Make sure you selected "Chrome Extension" not "Web application"
- **Wrong extension ID:** Double-check the ID from `chrome://extensions/`
- **Timing:** Wait for Google's servers to update

## Debug Information

To see your extension's debug info, check the browser console when you open your extension. You should see:
- Extension ID
- Generated redirect URI
- Client ID being used 