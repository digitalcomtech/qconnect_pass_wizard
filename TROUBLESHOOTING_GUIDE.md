# QConnect PASS Wizard - Troubleshooting Guide

## Technical Issues

### JavaScript Errors

**Error: "Cannot set properties of null (setting 'textContent')"**
- **Cause**: Browser compatibility or page loading issue
- **Solution**: 
  1. Refresh the page (F5 or Ctrl+R)
  2. Clear browser cache
  3. Try a different browser
  4. Disable browser extensions temporarily
- **Impact**: Does not affect functionality, can be ignored

**Error: "Access token required"**
- **Cause**: Session expired or authentication issue
- **Solution**:
  1. Log out and log back in
  2. Clear browser cookies for this site
  3. Check internet connection
- **Impact**: Prevents API access, must be resolved

### Network Issues

**"Error connecting to verification service"**
- **Cause**: Network connectivity or server issues
- **Solution**:
  1. Check internet connection
  2. Try again in a few minutes
  3. Contact support if persistent
- **Impact**: Prevents IMEI/SIM verification

**"Search failed" or "No installations found"**
- **Cause**: Server connectivity or query issues
- **Solution**:
  1. Check internet connection
  2. Try different search terms
  3. Verify client name spelling
  4. Contact support if no results expected
- **Impact**: Cannot proceed to VIN selection

### Device-Related Issues

**IMEI Verification Fails**
- **Possible Causes**:
  - IMEI not on Pegasus platform
  - Device not powered or connected
  - Device already assigned to another installation
  - Incorrect IMEI entered
- **Solutions**:
  1. Double-check IMEI number
  2. Ensure device is powered and connected
  3. Verify device is on the platform
  4. Check if device is already assigned
  5. Contact support if device should be available

**Device Not Reporting Location**
- **Possible Causes**:
  - Device not powered
  - Poor GPS signal
  - Antenna not connected
  - Device not properly configured
  - Network connectivity issues
- **Solutions**:
  1. Check device power and connections
  2. Ensure antenna is properly connected
  3. Move to location with better GPS signal
  4. Wait up to 30 minutes for device to come online
  5. Use manual location entry if GPS fails
  6. Contact support if device should be reporting

**Location Age Too High**
- **Cause**: Device hasn't reported recent location
- **Solution**:
  1. Wait for device to send new location data
  2. Check device connectivity
  3. Ensure device is in good GPS coverage area
- **Impact**: Prevents proximity check

### Location and GPS Issues

**"Location permission denied"**
- **Cause**: Browser location access blocked
- **Solution**:
  1. Click location icon in browser address bar
  2. Select "Allow" for location access
  3. Refresh page after granting permission
  4. Try different browser if issue persists
- **Impact**: Prevents automatic proximity check

**"Location information unavailable"**
- **Cause**: GPS signal issues or browser limitations
- **Solution**:
  1. Move to location with better GPS signal
  2. Use manual coordinate entry
  3. Try different browser
  4. Check device location services
- **Impact**: Requires manual location entry

**Proximity Check Fails**
- **Cause**: Not within 200 meters of device
- **Solution**:
  1. Verify you're at the correct installation location
  2. Check device location coordinates
  3. Use manual coordinate entry with device location
  4. Contact support if location seems incorrect
- **Impact**: Cannot proceed to form completion

### Form and Completion Issues

**Form Doesn't Open**
- **Cause**: Pop-up blocker or browser settings
- **Solution**:
  1. Disable pop-up blocker for this site
  2. Allow pop-ups in browser settings
  3. Try opening in new tab manually
  4. Use different browser
- **Impact**: Cannot complete installation form

**"Installation confirmation failed"**
- **Cause**: Server communication or data issues
- **Solution**:
  1. Check internet connection
  2. Try again in a few minutes
  3. Verify all form data was submitted
  4. Contact support with installation details
- **Impact**: Installation may not be properly recorded

### Browser-Specific Issues

**Chrome Issues**
- Clear cache and cookies
- Disable extensions temporarily
- Update browser to latest version
- Try incognito mode

**Firefox Issues**
- Clear cache and cookies
- Disable add-ons temporarily
- Update browser to latest version
- Try private browsing mode

**Safari Issues**
- Clear website data
- Disable content blockers
- Update browser to latest version
- Try private browsing mode

**Edge Issues**
- Clear browsing data
- Disable extensions temporarily
- Update browser to latest version
- Try InPrivate mode

## Error Code Reference

| Error Code | Description | Solution |
|------------|-------------|----------|
| 400 | Bad Request | Check data format and try again |
| 401 | Unauthorized | Log out and log back in |
| 403 | Forbidden | Contact support for permissions |
| 404 | Not Found | Check URL and try again |
| 500 | Server Error | Try again later, contact support if persistent |
| 503 | Service Unavailable | Server maintenance, try again later |

## Performance Issues

**Slow Loading**
- Check internet connection speed
- Clear browser cache
- Close unnecessary browser tabs
- Try different browser
- Contact support if consistently slow

**Page Freezing**
- Refresh the page
- Clear browser cache
- Restart browser
- Try different browser
- Contact support if persistent

## Data Issues

**Incorrect Client Information**
- Verify client name spelling
- Try partial name or VIN
- Contact support for client lookup
- Check if client exists in system

**Missing VINs**
- Verify client selection
- Try different search terms
- Contact support for VIN lookup
- Check if installations exist for client

**Form Data Not Saving**
- Ensure all required fields are filled
- Check internet connection
- Try submitting form again
- Contact support if data is lost

## Prevention Tips

**Before Starting Installation**
- Test internet connection
- Clear browser cache
- Ensure location services are enabled
- Verify device information is correct
- Check that devices are powered

**During Installation**
- Don't close browser tabs
- Keep devices powered
- Maintain good internet connection
- Don't navigate away from the wizard
- Wait for each step to complete

**After Installation**
- Verify form submission
- Confirm final confirmation
- Test device communication
- Document any issues
- Report problems to support

## Contact Information

**Technical Support**
- Email: [Your support email]
- Phone: [Your support phone]
- Hours: [Your support hours]

**Emergency Contact**
- For urgent installation issues
- Phone: [Your emergency contact]
- Available: [Your emergency hours]

**Include in Support Requests**
- VIN number
- IMEI(s)
- Client name
- Error messages (screenshot if possible)
- Browser and version
- Steps taken before error occurred
