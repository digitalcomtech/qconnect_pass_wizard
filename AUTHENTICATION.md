# Authentication System

This document explains the new authentication system implemented to protect sensitive API tokens and secure the QConnect PASS Wizard.

## 🔐 Overview

The authentication system provides:
- **User login/logout** functionality
- **JWT token-based** authentication
- **Protected API endpoints** that require valid authentication
- **Session management** with automatic token expiration
- **Role-based access control** (admin and installer roles)

## 👥 Default Users

### Admin User
- **Username:** `admin`
- **Password:** `admin123`
- **Role:** `admin` (full access)

### Installer User
- **Username:** `installer`
- **Password:** `installer123`
- **Role:** `installer` (standard access)

## 🚀 How It Works

### 1. Login Flow
1. User visits `/login.html`
2. Enters credentials
3. Server validates credentials and returns JWT token
4. Token is stored in `localStorage`
5. User is redirected to main application

### 2. Authentication Check
- Every page load checks for valid JWT token
- If no token or invalid token → redirect to login
- Token is automatically included in all API requests

### 3. API Protection
- All sensitive endpoints now require `Authorization: Bearer <token>` header
- Server validates token before processing requests
- Invalid/expired tokens return 401/403 errors

## 🛡️ Security Features

### Token Security
- **JWT tokens** with 24-hour expiration
- **HttpOnly cookies** for session management
- **Automatic token refresh** on valid requests
- **Secure logout** that invalidates tokens

### API Protection
- **No more exposed tokens** in network tab
- **Server-side token validation**
- **Role-based permissions**
- **Session timeout** after 24 hours

### Frontend Security
- **Authentication check** on every page load
- **Automatic redirect** to login if not authenticated
- **Secure token storage** in localStorage
- **Logout functionality** with proper cleanup

## 🔧 Implementation Details

### Backend Changes
- Added `users.js` - user management and authentication
- Added `auth.js` - JWT middleware and validation
- Updated `server.js` - protected all API endpoints
- Added login/logout endpoints

### Frontend Changes
- Added `/login.html` - login page
- Updated `index.html` - authentication checks and user info
- Added automatic token inclusion in all API calls
- Added user info display and logout button

### Dependencies Added
```json
{
  "bcrypt": "^5.1.1",           // Password hashing
  "express-session": "^1.17.3", // Session management
  "jsonwebtoken": "^9.0.2"      // JWT token handling
}
```

## 📱 User Interface

### Login Page (`/login.html`)
- Clean, modern design matching app theme
- Username/password fields
- Error handling and success messages
- Demo credentials display

### Main App
- User info displayed in sidebar
- Logout button for easy access
- Automatic authentication checks
- Seamless user experience

## 🔄 API Endpoints

### Public Endpoints
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - User logout

### Protected Endpoints (require authentication)
- `GET /api/auth/me` - Get current user info
- `GET /api/config` - App configuration
- `GET /api/health/pegasus` - Health check
- `POST /api/install` - Installation workflow
- `POST /api/verify-imei` - IMEI verification
- `POST /api/verify-sim` - SIM verification
- `POST /api/confirm-installation` - Final confirmation
- `GET /api/device-status` - Device status check
- `GET /api/installation-status/:id` - Installation status

## 🚨 Security Considerations

### Production Deployment
1. **Change default passwords** immediately
2. **Use environment variables** for JWT secrets
3. **Enable HTTPS** and secure cookies
4. **Implement proper user management** (database)
5. **Add rate limiting** for login attempts
6. **Enable CSRF protection**

### Token Management
- Tokens expire after 24 hours
- Users must re-authenticate after expiration
- Logout immediately invalidates tokens
- No token persistence across browser sessions

## 🧪 Testing

### Test Mode
- Authentication still works in test mode
- All API endpoints require valid tokens
- Test mode doesn't bypass authentication

### Development
- Use demo credentials for testing
- Check browser console for authentication errors
- Verify token inclusion in network requests

## 🔍 Troubleshooting

### Common Issues
1. **"Access token required"** - User not logged in
2. **"Invalid or expired token"** - Token expired, re-login needed
3. **"Insufficient permissions"** - User role doesn't have access

### Debug Steps
1. Check browser localStorage for `authToken`
2. Verify token expiration in JWT payload
3. Check server logs for authentication errors
4. Ensure all API calls include Authorization header

## 📈 Benefits

### Security Improvements
- ✅ **No more exposed API tokens** in network tab
- ✅ **User authentication required** for all operations
- ✅ **Session management** with automatic expiration
- ✅ **Role-based access control**

### User Experience
- ✅ **Single sign-on** for entire session
- ✅ **Seamless authentication** flow
- ✅ **User identification** in interface
- ✅ **Easy logout** functionality

### Development Benefits
- ✅ **Centralized authentication** logic
- ✅ **Easy to extend** with new roles
- ✅ **Standard security practices**
- ✅ **Better error handling**

## 🔮 Future Enhancements

### Planned Features
- **Password reset** functionality
- **Remember me** option
- **Multi-factor authentication**
- **User activity logging**
- **Advanced role permissions**

### Integration Options
- **LDAP/Active Directory** integration
- **OAuth 2.0** support
- **Single Sign-On (SSO)** integration
- **API key management** for external access
