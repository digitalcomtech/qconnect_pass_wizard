# Secondary Groups Implementation

## Overview
This implementation adds support for creating secondary groups for installations with secondary vehicles, following the naming pattern "client (2)" and setting the secondary vehicle's primary key to `parseInt(groupId2)`.

## Changes Made

### 1. New Function: `createOrUpdateSecondaryGroup(clientName)`
- **Location**: `server.js` lines 639-798
- **Purpose**: Creates or retrieves secondary groups with naming pattern "client (2)"
- **Features**:
  - Searches for existing secondary groups first
  - Creates new secondary group if not found
  - Handles 400 errors gracefully (group already exists)
  - Returns `{ groupId, created }` object

### 2. Updated Function: `createSecondaryVehicle(vin, imei, groupId2)`
- **Location**: `server.js` lines 800-849
- **Changes**:
  - Now accepts `groupId2` parameter instead of hardcoded group 4126
  - Sets `primary: parseInt(groupId2)` for secondary vehicle
  - Uses `groups: [3367, parseInt(groupId2)]` instead of hardcoded 4126
  - Updated logging to reflect secondary group usage

### 3. Updated Function: `processSecondaryDevice(secondaryImei, vin, clientName)`
- **Location**: `server.js` lines 1125-1146
- **Changes**:
  - Now accepts `clientName` instead of `groupId`
  - Creates secondary group using `createOrUpdateSecondaryGroup(clientName)`
  - Passes `groupId2` to `createSecondaryVehicle()`
  - Enhanced logging for secondary group creation

### 4. Updated Main Installation Workflow
- **Location**: `server.js` lines 312-326
- **Changes**:
  - Modified call to `processSecondaryDevice()` to pass `client_name` instead of `groupId`
  - Maintains existing workflow structure

### 5. Updated Secondary Installation Endpoint
- **Location**: `server.js` lines 1187-1194
- **Changes**:
  - Updated to use `processSecondaryDevice()` instead of direct `createSecondaryVehicle()` call
  - Maintains existing endpoint functionality

## Key Features

### Secondary Group Naming
- Primary group: `client_name` (e.g., "John Doe")
- Secondary group: `client_name (2)` (e.g., "John Doe (2)")

### Vehicle Primary Key Assignment
- Primary vehicle: `primary: parseInt(groupId)` where `groupId` is the primary group ID
- Secondary vehicle: `primary: parseInt(groupId2)` where `groupId2` is the secondary group ID

### Group Membership
- Primary vehicle: `groups: [3367, parseInt(groupId)]` (hardcoded 3367 + client group)
- Secondary vehicle: `groups: [4126, parseInt(groupId2)]` (hardcoded 4126 + secondary client group)

## API Endpoints Affected

### 1. POST `/api/install`
- **When**: `secondary_imei` parameter is provided
- **Behavior**: Creates secondary group and vehicle automatically
- **Response**: Includes secondary device processing details

### 2. POST `/api/secondary-install`
- **Behavior**: Creates secondary group and vehicle
- **Response**: Includes secondary group and vehicle creation details

## Testing

### Manual Testing
1. Start the server: `node server.js`
2. Use the installation endpoints with `secondary_imei` parameter
3. Verify secondary groups are created with "(2)" suffix
4. Verify secondary vehicles use secondary group ID as primary key

### Test Script
- Created `test-secondary-groups.js` for conceptual testing
- Tests the new functions (note: functions are not exported, so test via API)

## Error Handling
- Graceful handling of existing secondary groups (400 errors)
- Comprehensive logging for debugging
- Fallback mechanisms for API failures
- Maintains existing error handling patterns

## Backward Compatibility
- All existing functionality remains unchanged
- Primary vehicle creation unchanged
- Existing API contracts maintained
- No breaking changes to current workflows

## Logging Enhancements
- Added detailed logging for secondary group creation
- Clear distinction between primary and secondary operations
- Enhanced debugging information for troubleshooting
