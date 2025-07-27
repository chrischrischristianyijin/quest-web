# Chrome Web Store Submission Guide

## Required Files for Submission

### 1. Extension Files (ZIP Package)
- `manifest.json` - Extension configuration
- `popup.html` - Main extension interface
- `popup.js` - Extension functionality
- `background.js` - Background service worker
- `content-script.js` - Content script for web page interaction
- `icons/` folder with icon files (16x16, 48x48, 128x128)

### 2. Privacy Policy
- **File**: `privacy-policy.html` (host this on your website)
- **URL**: [Your Website URL]/privacy-policy.html
- **Content**: Complete privacy policy covering data collection, usage, and user rights

### 3. Store Listing Information

#### Extension Details
- **Name**: Quest Insight Collector
- **Description**: Save insights from web pages to your Quest space
- **Category**: Productivity
- **Language**: English

#### Store Listing
- **Detailed Description**: 
  ```
  Quest Insight Collector helps you save and organize valuable insights from web pages directly to your Quest space.
  
  Features:
  • Save text selections from any webpage
  • Organize insights with tags and categories
  • Secure cloud storage with Supabase
  • Google OAuth login for easy access
  • Password-protected accounts
  • View all your insights in your Quest space
  
  Perfect for researchers, students, and anyone who wants to collect and organize web content efficiently.
  ```

#### Screenshots (Required)
- Create 1-5 screenshots showing the extension in action
- Recommended sizes: 1280x800 or 640x400
- Show the popup interface, saving process, and results

#### Promotional Images (Optional)
- Small tile (440x280)
- Large tile (920x680)

### 4. Privacy Policy Requirements

The privacy policy must cover:
- What data is collected
- How data is used
- Data storage and security
- User rights (access, deletion, etc.)
- Contact information
- GDPR/CCPA compliance

### 5. Submission Checklist

#### Technical Requirements
- [ ] Manifest V3 compliant
- [ ] All permissions justified
- [ ] No external scripts loaded
- [ ] HTTPS for all external requests
- [ ] Privacy policy URL provided

#### Content Requirements
- [ ] Clear description of functionality
- [ ] Screenshots showing the extension in use
- [ ] Privacy policy hosted and accessible
- [ ] No misleading information
- [ ] Appropriate category selection

#### Legal Requirements
- [ ] Privacy policy covers all data practices
- [ ] Terms of service (if applicable)
- [ ] Contact information provided
- [ ] Compliance with Chrome Web Store policies

### 6. Hosting the Privacy Policy

You need to host the `privacy-policy.html` file on a public website. Options:

1. **GitHub Pages**: Free hosting for the HTML file
2. **Your existing website**: Add the privacy policy page
3. **Vercel/Netlify**: Deploy the HTML file
4. **Google Sites**: Create a simple site with the privacy policy

### 7. Submission Steps

1. **Prepare the ZIP file**:
   ```bash
   cd quest-extension-release
   zip -r quest-extension.zip . -x "*.DS_Store" "*.git*"
   ```

2. **Host the privacy policy**:
   - Upload `privacy-policy.html` to your website
   - Note the URL for submission

3. **Create Chrome Web Store developer account**:
   - Go to https://chrome.google.com/webstore/devconsole
   - Pay the one-time $5 registration fee

4. **Submit the extension**:
   - Upload the ZIP file
   - Fill in all required information
   - Provide the privacy policy URL
   - Submit for review

### 8. Common Rejection Reasons

- **Missing privacy policy**: Must have a publicly accessible privacy policy
- **Insufficient description**: Description must clearly explain what the extension does
- **Missing screenshots**: Required to show the extension in action
- **Unjustified permissions**: All permissions must be clearly explained
- **External scripts**: Not allowed in Chrome Web Store extensions
- **Misleading information**: Description must match actual functionality

### 9. Review Process

- **Initial review**: 1-3 business days
- **Detailed review**: 1-2 weeks (if needed)
- **Re-submission**: If rejected, address feedback and re-submit

### 10. Post-Submission

- Monitor the review status in the developer console
- Respond to any feedback from Google reviewers
- Update the extension as needed
- Keep the privacy policy updated

## Important Notes

1. **Privacy Policy URL**: This is mandatory for extensions that collect user data
2. **Screenshots**: Show real functionality, not mockups
3. **Description**: Be clear and honest about what the extension does
4. **Permissions**: Only request permissions you actually need
5. **Testing**: Test thoroughly before submission

## Contact Information

For questions about this submission guide or the extension:
- Email: contact@myquestspace.com
- Website: https://quest-web-nu.vercel.app/ 