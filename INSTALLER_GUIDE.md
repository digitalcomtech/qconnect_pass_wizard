# QConnect PASS Wizard - Installer Guide

## Overview
The QConnect PASS Wizard is a streamlined tool for field installers to complete device installations efficiently. This guide will walk you through each step of the installation process.

## Prerequisites
- Valid installer credentials (username/password)
- Device IMEI(s) ready for installation
- SIM card information (if applicable)
- Access to the installation location

## Getting Started

### 1. Access the Application
- Open your web browser
- Navigate to the QConnect PASS Wizard URL
- Log in with your installer credentials

### 2. Environment Indicator
- **PROD** (Purple): Production environment - for live installations
- **QA** (Orange): Testing environment - for practice/testing

---

## Step-by-Step Installation Process

### Step 1: Client Selection
**Purpose**: Find and select the client/vehicle for installation

1. **Enter Client Information**
   - Type the client name or VIN start in the input field
   - Example: "John Smith" or "1GKS27KL1RR"
   - Click **"Submit ▶ Load VINs"**

2. **What Happens**
   - System searches for matching installations
   - Status bar shows: "Found X installation(s) for [client name]"
   - Proceed to Step 2

### Step 2: VIN Selection
**Purpose**: Choose the specific vehicle for device installation

1. **Select VIN**
   - Choose the correct VIN from the dropdown list
   - Each option shows: "VIN — Client Name"
   - Click **"Next ▶ Enter IMEI & SIM"**

2. **Status Updates**
   - Status bar updates to show selected VIN
   - Proceed to Step 3

### Step 3: Device Setup
**Purpose**: Enter and verify device information

1. **Primary Device IMEI**
   - Enter the primary device IMEI
   - Click **"Verify IMEI"** to confirm device is on the platform
   - Wait for verification confirmation (✅ or ❌)
   - Retype the IMEI in the confirmation field

2. **SIM Card (Optional)**
   - Enter SIM card number if applicable
   - Click **"Verify SIM"** to confirm SIM status
   - Retype SIM number in confirmation field
   - Leave blank if no SIM card is used

3. **Secondary Device (Optional)**
   - Check **"Add Secondary Unit (IMEI)"** if installing a second device
   - Enter secondary IMEI when the field appears

4. **Location Verification Notice**
   - The app will verify your location is within 200 meters of the device
   - This ensures you're at the correct installation site

5. **Test Mode (Optional)**
   - Check **"🧪 Enable Test Mode"** for location spoofing during testing
   - Only use in non-production environments

6. **Start Installation**
   - Click **"Start Installation ▶"** when all information is verified
   - Proceed to Step 4

### Step 4: Location Check
**Purpose**: Verify device is online and reporting location

1. **Automatic Monitoring**
   - System automatically checks device status every 60 seconds
   - Status bar shows: "Monitoring device location..."
   - Wait for device to come online and report location

2. **Device Status Requirements**
   - Device must be online and connected
   - Recent location data (within 60 seconds)
   - Valid GPS coordinates
   - Recent communication activity

3. **Proximity Verification**
   - System verifies you're within 200 meters of the device
   - Uses GPS location or manual coordinate entry

4. **Manual Location Entry (If Needed)**
   - If GPS fails, enter your coordinates manually
   - Use the device's reported coordinates as reference
   - Click **"Check Proximity"** to verify distance

5. **Success Confirmation**
   - When device is ready, you'll see proximity confirmation
   - Proceed to Step 5

### Step 5: Form Completion
**Purpose**: Complete the installation form with device details

1. **Automatic Form Opening**
   - Installation form opens in a new browser tab
   - Form is pre-filled with client and vehicle information
   - Status bar shows: "Form opened - Complete installation details"

2. **Form Completion**
   - Fill in any remaining required fields
   - Verify all information is correct
   - Submit the form when complete

3. **Secondary Device (If Applicable)**
   - Secondary device form opens automatically
   - Device name will be: "VIN(2)" (e.g., "1GKS27KL1RR148321(2)")
   - Complete the secondary device form

4. **Return to Wizard**
   - Close the form tab when complete
   - Return to the main wizard
   - Proceed to Step 6

### Step 6: Final Confirmation
**Purpose**: Confirm installation completion in the system

1. **Final Confirmation**
   - Click **"Confirm Installation Complete"**
   - System sends final confirmation to Pegasus
   - Status bar shows: "Installation confirmed successfully! 🎉"

2. **Success Message**
   - Installation is now complete
   - All steps are marked as completed
   - You can start a new installation

---

## Status Bar Reference

The horizontal status bar at the top shows your current progress:

| Field | Description | Example |
|-------|-------------|---------|
| **Step** | Current workflow step | 1, 2, 3, 4, 5, 6 |
| **VIN** | Selected vehicle VIN | 1GKS27KL1RR148321 |
| **Primary** | Primary device IMEI | 863427042305913 |
| **Secondary** | Secondary device IMEI | 357159085674321 |
| **Status** | Current action/status | "Monitoring device location..." |

---

## Troubleshooting

### Common Issues

**IMEI Verification Fails**
- Ensure IMEI is correct and device is on the platform
- Check if device is properly powered and connected
- Verify device is not already assigned to another installation

**Location Check Fails**
- Ensure device is powered and has GPS signal
- Check device antenna connections
- Wait up to 30 minutes for device to come online
- Use manual location entry if GPS fails

**Form Doesn't Open**
- Check if pop-up blockers are enabled
- Ensure browser allows pop-ups for this site
- Try opening form in a new tab manually

**Proximity Check Fails**
- Ensure you're within 200 meters of the device
- Check GPS permissions in your browser
- Use manual coordinate entry if needed

### Error Messages

**"Cannot set properties of null"**
- This is a technical error that doesn't affect functionality
- Refresh the page and continue
- Contact support if it persists

**"Device not reporting"**
- Device may be offline or not properly connected
- Check power and antenna connections
- Wait for device to come online (up to 30 minutes)

**"Location permission denied"**
- Allow location access in your browser
- Click the location icon in the address bar
- Select "Allow" for location access

---

## Best Practices

### Before Starting
- Verify all device information is correct
- Ensure you have good GPS signal
- Check that devices are properly powered
- Confirm you're at the correct installation location

### During Installation
- Don't close the browser tab during the process
- Keep the device powered throughout the installation
- Wait for each step to complete before proceeding
- Use the status bar to track your progress

### After Installation
- Verify the installation form is submitted
- Confirm final confirmation is sent
- Test device communication if possible
- Document any issues or special circumstances

---

## Support

If you encounter issues not covered in this guide:

1. **Check the status bar** for current progress
2. **Review error messages** carefully
3. **Try refreshing the page** if technical errors occur
4. **Contact technical support** with specific error details
5. **Include the VIN and IMEI** in support requests

---

## Quick Reference

| Step | Action | Key Information |
|------|--------|-----------------|
| 1 | Enter client name/VIN | Search for installations |
| 2 | Select VIN | Choose correct vehicle |
| 3 | Enter IMEI & SIM | Verify device information |
| 4 | Location check | Wait for device to report |
| 5 | Complete form | Fill installation details |
| 6 | Final confirmation | Confirm completion |

**Remember**: The status bar always shows your current progress and the information you're working with. Use it to stay oriented throughout the installation process.
