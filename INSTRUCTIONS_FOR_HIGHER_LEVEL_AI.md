# Instructions for Higher-Level AI Model

## Task Overview
You need to solve a data persistence issue in a Quest web application where insights and stacks disappear after page refresh, despite implementing localStorage backup mechanisms.

## Problem Context
- **Application**: Quest web app for curating and organizing web content
- **Issue**: After a period of time, when the page is refreshed, both insights and stacks disappear completely
- **Expected Behavior**: Data should persist across page refreshes using localStorage backup
- **Current Implementation**: Has localStorage backup with 24-hour freshness check and auto-save every 30 seconds

## Files to Analyze
1. **`DEBUGGING_GUIDE.md`** - Comprehensive debugging guide with potential root causes
2. **`COMPLETE_CODE_ANALYSIS.md`** - Complete code files and analysis
3. **`src/client/js/my-space.js`** - Main application logic (50,000+ lines)
4. **`src/client/js/auth.js`** - Authentication and session management
5. **`src/client/js/api.js`** - API service layer
6. **`src/client/js/cache.js`** - Caching mechanism
7. **`src/client/js/config.js`** - Configuration settings

## Key Areas to Focus On

### 1. Data Persistence Chain
- **Primary Storage**: Backend API at `https://quest-api-edz1.onrender.com`
- **Backup Storage**: localStorage with keys:
  - `quest_user_session` - User authentication data
  - `quest_stacks` - Stack data (Map entries)
  - `quest_insights_backup` - Insights backup with timestamp
- **Cache Layer**: In-memory API cache with 5-minute TTL

### 2. Critical Functions to Analyze
- `initPage()` - Page initialization and data loading
- `loadUserInsights()` - Insights loading with fallback
- `loadUserStacks()` - Stacks loading with metadata merging
- `saveInsightsToLocalStorage()` - Insights backup saving
- `saveStacksToLocalStorage()` - Stacks backup saving
- `auth.restoreSession()` - Session restoration
- `auth.clearSession()` - Session clearing

### 3. Potential Failure Points
- **Session Expiration**: 24-hour session might clear localStorage
- **Authentication Errors**: 401/403 errors trigger data clearing
- **Cache Issues**: Stale cache data served
- **localStorage Issues**: Quota exceeded, corruption, or sync problems
- **Race Conditions**: API and localStorage operations conflict
- **Error Handling**: Silent failures in backup mechanisms

## Investigation Approach

### Phase 1: Data State Analysis
1. Check what's actually stored in localStorage before and after refresh
2. Monitor API responses for errors or unexpected data
3. Verify authentication state consistency
4. Check for console errors during data loading

### Phase 2: Timing Analysis
1. Determine when exactly the data disappears
2. Check if it's related to session expiration (24 hours)
3. Monitor auto-save operations (every 30 seconds)
4. Test different time intervals

### Phase 3: Error Handling Analysis
1. Check if errors are being caught and handled properly
2. Verify fallback mechanisms are working
3. Test network failure scenarios
4. Check for silent failures in localStorage operations

### Phase 4: Browser-Specific Testing
1. Test in different browsers
2. Check browser storage limits
3. Test with different localStorage policies
4. Verify cross-tab synchronization

## Debugging Commands to Use

### Check localStorage State
```javascript
// Run in browser console
console.log('Session:', localStorage.getItem('quest_user_session'));
console.log('Stacks:', localStorage.getItem('quest_stacks'));
console.log('Insights Backup:', localStorage.getItem('quest_insights_backup'));
```

### Monitor Data Loading
```javascript
// Add to browser console
const originalLoadInsights = window.loadUserInsights;
window.loadUserInsights = async function() {
    console.log('🔄 Loading insights...');
    const result = await originalLoadInsights();
    console.log('✅ Insights loaded:', result);
    return result;
};
```

### Check Authentication State
```javascript
// Check auth state
console.log('Auth Status:', auth.checkAuth());
console.log('Current User:', auth.getCurrentUser());
console.log('Token Valid:', auth.hasValidToken());
console.log('Token Expired:', auth.isTokenExpired());
```

## Expected Deliverables

### 1. Root Cause Analysis
- Identify the specific point of failure in the data persistence chain
- Explain why the current localStorage backup isn't working
- Determine if it's a timing, authentication, storage, or logic issue

### 2. Targeted Solution
- Provide a specific fix that addresses the root cause
- Ensure the solution works reliably across all scenarios
- Include proper error handling and fallback mechanisms

### 3. Implementation Details
- Provide the exact code changes needed
- Include any configuration changes
- Add debugging/logging improvements

### 4. Testing Strategy
- Provide steps to verify the fix works
- Include edge case testing scenarios
- Add monitoring to prevent future issues

## Success Criteria
The solution should ensure:
1. ✅ Data persists across page refreshes
2. ✅ Fallback mechanisms work reliably
3. ✅ No data loss occurs during normal operations
4. ✅ System gracefully handles edge cases
5. ✅ Authentication issues don't cause data loss
6. ✅ Network failures don't cause data loss

## Additional Context
- **Backend API**: `https://quest-api-edz1.onrender.com`
- **Frontend**: Static HTML/JS served locally
- **Data Types**: Insights (URLs with metadata) and Stacks (grouped insights)
- **User Flow**: Login → Add content → Create stacks → Refresh page → Data should persist
- **Current Issue**: Data disappears after refresh, despite localStorage backup implementation

## Priority
This is a critical issue affecting user experience. Users lose their curated content after page refresh, which defeats the purpose of the application. The solution must be robust and reliable.
