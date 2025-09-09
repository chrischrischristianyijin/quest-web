# Quest Web App - Data Persistence Issue Debugging Guide

## Problem Description
**Issue**: After a period of time, when the page is refreshed, both insights and stacks disappear completely. This happens despite implementing localStorage backup mechanisms.

## Current Architecture Overview

### Data Storage Layers
1. **Database (Primary)**: Backend API at `https://quest-api-edz1.onrender.com`
2. **localStorage (Backup)**: Browser local storage with keys:
   - `quest_user_session` - User authentication data
   - `quest_stacks` - Stack data (Map entries)
   - `quest_insights_backup` - Insights backup with timestamp
3. **Memory Cache**: In-memory API cache with 5-minute TTL
4. **Session Storage**: Not used

### Key Data Flow Points

#### 1. Page Initialization (`initPage()`)
```javascript
// Parallel loading of all data
const [profileResult, insightsResult, tagsResult, stacksResult] = await Promise.allSettled([
    loadUserProfile(),
    loadUserInsights(),
    loadUserTags(),
    loadUserStacks()
]);
```

#### 2. Insights Loading (`loadUserInsights()`)
- **Primary**: API call to `/api/v1/insights/all?include_tags=true`
- **Fallback**: localStorage backup with 24-hour freshness check
- **Filtering**: Removes insights that have `stack_id` (already in stacks)

#### 3. Stacks Loading (`loadUserStacks()`)
- **Primary**: API call to get all insights, then group by `stack_id`
- **Fallback**: localStorage backup for stack metadata
- **Synchronization**: Merges database data with localStorage preferences

#### 4. Auto-Save System
- **Frequency**: Every 30 seconds
- **Triggers**: After any data modification
- **Storage**: Both insights and stacks saved to localStorage

## Critical Code Sections to Analyze

### 1. Authentication & Session Management
**File**: `src/client/js/auth.js`

**Key Functions**:
- `restoreSession()` - Restores user session from localStorage
- `clearSession()` - Clears all session data
- `isTokenExpired()` - Checks if session is older than 24 hours

**Potential Issues**:
- Session expiration might clear localStorage data
- Token validation failures might trigger data clearing
- Multiple localStorage keys might cause conflicts

### 2. API Service Layer
**File**: `src/client/js/api.js`

**Key Functions**:
- `request()` - Generic API request handler
- `getInsights()` - Fetches insights with tags
- Cache management with 5-minute TTL

**Potential Issues**:
- Cache invalidation might serve stale data
- Authentication errors (401/403) clear localStorage
- Network timeouts might not trigger fallback properly

### 3. Data Persistence Functions
**File**: `src/client/js/my-space.js`

**Key Functions**:
- `saveInsightsToLocalStorage()` - Saves insights with timestamp
- `saveStacksToLocalStorage()` - Saves stack data
- `loadUserInsights()` - Loads with fallback mechanism
- `loadUserStacks()` - Loads with metadata merging

**Potential Issues**:
- localStorage quota exceeded
- Data corruption during save/load
- Race conditions between API and localStorage
- Timestamp validation might be too strict

### 4. Cache Management
**File**: `src/client/js/cache.js`

**Key Features**:
- 5-minute TTL for API responses
- Pattern-based cache clearing
- In-memory storage only

**Potential Issues**:
- Cache might serve stale data after modifications
- Cache clearing might not be comprehensive enough

## Debugging Steps for Higher-Level AI

### Step 1: Check localStorage State
```javascript
// Run in browser console
console.log('Session:', localStorage.getItem('quest_user_session'));
console.log('Stacks:', localStorage.getItem('quest_stacks'));
console.log('Insights Backup:', localStorage.getItem('quest_insights_backup'));
```

### Step 2: Monitor Data Loading
```javascript
// Add to browser console to monitor
const originalLoadInsights = window.loadUserInsights;
window.loadUserInsights = async function() {
    console.log('🔄 Loading insights...');
    const result = await originalLoadInsights();
    console.log('✅ Insights loaded:', result);
    return result;
};
```

### Step 3: Check API Responses
```javascript
// Monitor API calls
const originalFetch = window.fetch;
window.fetch = function(...args) {
    console.log('🌐 API Call:', args[0]);
    return originalFetch.apply(this, args).then(response => {
        console.log('📡 API Response:', response.status, response.url);
        return response;
    });
};
```

### Step 4: Verify Authentication State
```javascript
// Check auth state
console.log('Auth Status:', auth.checkAuth());
console.log('Current User:', auth.getCurrentUser());
console.log('Token Valid:', auth.hasValidToken());
console.log('Token Expired:', auth.isTokenExpired());
```

## Potential Root Causes

### 1. Session Expiration
- **Issue**: 24-hour session expiration clears localStorage
- **Evidence**: Data disappears after extended periods
- **Fix**: Extend session lifetime or implement token refresh

### 2. localStorage Quota Exceeded
- **Issue**: Browser localStorage limit reached
- **Evidence**: Save operations fail silently
- **Fix**: Implement data compression or cleanup

### 3. Race Conditions
- **Issue**: API and localStorage operations conflict
- **Evidence**: Inconsistent data state
- **Fix**: Implement proper synchronization

### 4. Cache Invalidation Issues
- **Issue**: Stale cache data served
- **Evidence**: Old data persists after modifications
- **Fix**: Improve cache invalidation strategy

### 5. Authentication Token Issues
- **Issue**: Token expiration causes data clearing
- **Evidence**: 401/403 errors trigger cleanup
- **Fix**: Implement token refresh mechanism

### 6. Data Corruption
- **Issue**: localStorage data becomes corrupted
- **Evidence**: JSON parsing errors
- **Fix**: Add data validation and recovery

## Recommended Investigation Approach

### Phase 1: Data State Analysis
1. Check localStorage contents before and after refresh
2. Monitor API responses for errors
3. Verify authentication state consistency
4. Check for console errors during data loading

### Phase 2: Timing Analysis
1. Measure time between data creation and disappearance
2. Check if issue occurs at specific intervals
3. Monitor auto-save operations
4. Verify session expiration timing

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

## Key Questions to Answer

1. **When exactly does the data disappear?**
   - After specific time intervals?
   - After certain user actions?
   - After browser events?

2. **What is the state of localStorage when data disappears?**
   - Is it empty?
   - Is it corrupted?
   - Is it outdated?

3. **Are there any error messages in the console?**
   - API errors?
   - localStorage errors?
   - Authentication errors?

4. **Is the issue consistent across different scenarios?**
   - Different browsers?
   - Different users?
   - Different time periods?

## Files to Examine in Detail

1. **`src/client/js/my-space.js`** - Main data management logic
2. **`src/client/js/auth.js`** - Authentication and session management
3. **`src/client/js/api.js`** - API communication layer
4. **`src/client/js/cache.js`** - Caching mechanism
5. **`src/client/js/config.js`** - Configuration settings

## Expected Outcome

The higher-level AI should identify the specific point of failure in the data persistence chain and provide a targeted fix that ensures:
1. Data persists across page refreshes
2. Fallback mechanisms work reliably
3. No data loss occurs during normal operations
4. The system gracefully handles edge cases

## Additional Context

- **Backend API**: `https://quest-api-edz1.onrender.com`
- **Frontend**: Static HTML/JS served locally
- **Data Types**: Insights (URLs with metadata) and Stacks (grouped insights)
- **User Flow**: Login → Add content → Create stacks → Refresh page → Data should persist
- **Current Issue**: Data disappears after refresh, despite localStorage backup implementation
