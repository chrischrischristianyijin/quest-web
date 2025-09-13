# How to Access Email Preferences Page

## Quick Access Methods

### 1. **From My Space Page (Main Method)**
- Go to `/my-space` (or click "My Space" in navigation)
- Click on your avatar in the top-right corner
- Select "Email Preferences" from the dropdown menu

### 2. **Direct URL (For Testing)**
- Navigate directly to `/email-preferences`
- This will work even without authentication (for testing purposes)

## What You'll See

The email preferences page includes:

- **Weekly Digest Toggle**: Enable/disable weekly digest emails
- **Delivery Schedule**: Choose preferred day and hour
- **Timezone Settings**: Select your timezone
- **No Activity Policy**: Choose what happens when you have no activity
- **Preview Function**: See what your digest will look like
- **Test Email**: Send a test email to verify configuration

## Features

### Email Preferences
- ✅ Enable/disable weekly digest
- ✅ Choose delivery day (Sunday-Saturday)
- ✅ Choose delivery hour (6 AM - 10 PM)
- ✅ Select timezone
- ✅ Configure no-activity behavior

### Preview & Testing
- ✅ Preview digest content before subscribing
- ✅ Send test emails to verify configuration
- ✅ View HTML and text versions
- ✅ See raw data structure

### User Experience
- ✅ Responsive design for mobile and desktop
- ✅ Real-time form validation
- ✅ Success/error messaging
- ✅ Loading states and feedback

## Technical Notes

### File Structure
```
src/client/
├── pages/
│   └── email-preferences.html    # Main page
├── js/
│   └── email-preferences.js      # JavaScript functionality
├── styles/
│   └── email-preferences.css     # Styling
└── js/
    └── paths.js                  # Updated with EMAIL_PREFERENCES path
```

### API Endpoints Used
- `GET /api/v1/email/preferences` - Get user preferences
- `PUT /api/v1/email/preferences` - Update preferences
- `POST /api/v1/email/digest/preview` - Preview digest
- `POST /api/v1/email/test` - Send test email

### Authentication
- Requires user to be logged in
- Uses existing authentication system
- Automatically redirects to login if not authenticated

## Troubleshooting

### If the page doesn't load:
1. Check that you're logged in
2. Verify the file exists at `/src/client/pages/email-preferences.html`
3. Check browser console for JavaScript errors
4. Ensure the API endpoints are working

### If preferences don't save:
1. Check API connectivity
2. Verify user authentication
3. Check browser console for errors
4. Ensure backend email system is set up

### If preview doesn't work:
1. Check that you have some insights in your account
2. Verify the preview API endpoint is working
3. Check browser console for errors

## Development Notes

- The page uses the existing Quest design system
- All styling is in `email-preferences.css`
- JavaScript functionality is in `email-preferences.js`
- Uses the existing API client and authentication system
- Fully responsive and accessible

## Next Steps

1. **Test the page** by accessing it through any of the methods above
2. **Configure your preferences** to test the functionality
3. **Try the preview** to see what your digest will look like
4. **Send a test email** to verify the email system works
5. **Set up the backend** following the EMAIL_SYSTEM_SETUP.md guide

The email preferences page is now fully integrated into your Quest application and ready to use!
