# QConnect PASS Wizard

A comprehensive installation wizard for QConnect PASS devices that handles the complete installation workflow in-house, replacing the previous Zapier integration.

## 🚀 Features

- **Complete Installation Workflow**: Handles all installation steps directly in the application
- **Pegasus API Integration**: Direct integration with Pegasus Gateway APIs
- **SIM Card Management**: Supports both SuperSIM (8988) and Wireless (8901) SIM types
- **Secondary Device Support**: Handles installations with secondary IMEI devices
- **Duplicate Prevention**: Prevents duplicate installations
- **Enhanced Error Handling**: Retry mechanisms and comprehensive error reporting
- **Environment Switching**: Support for both QA and Production environments

**Smoke tests & audits:** see [`docs/TOOLING.md`](docs/TOOLING.md) (`npm run smoke`, `validate:config`, `audit:routes`, `audit:activity`).

## 🔧 Installation Workflow

The wizard now implements the complete Zapier workflow described in the dossier:

### Step-by-Step Process

1. **Duplicate Check**: Verifies installation ID hasn't been processed before
2. **Installation Recording**: Records installation in internal tracking system
3. **Group Creation**: Creates/updates client group in Pegasus
4. **Worksheet Management**: Manages spreadsheet operations (simulated)
5. **Vehicle Creation**: Creates vehicle record in Pegasus with device linking
6. **SIM Processing**: Handles SIM card activation and status updates
7. **Secondary Device**: Processes secondary IMEI devices if provided

### API Endpoints

- `POST /api/install` - Main installation workflow
- `POST /api/secondary-install` - Secondary device installation
- `GET /api/installation-status/:id` - Check installation status
- `GET /api/config` - Environment configuration
- `GET /api/health/pegasus` - Pegasus API health check

## 🏗️ Architecture

### Environment Configuration

The application supports multiple environments:

```javascript
const ENV_CONFIG = {
  production: {
    pegasusBaseUrl: "https://qservices.pegasusgateway.com",
    pegasusToken: "your-production-token",
    pegasus1Token: "your-pegasus1-token",
    pegasus256Token: "your-pegasus256-token"
  },
  qa: {
    pegasusBaseUrl: "https://dev2.pegasusgateway.com",
    pegasusToken: "your-qa-token",
    pegasus1Token: "your-pegasus1-token",
    pegasus256Token: "your-qa-pegasus256-token"
  }
};
```

### Key Components

- **Installation Workflow Engine**: Orchestrates the complete installation process
- **Pegasus API Client**: Handles all Pegasus Gateway API interactions
- **SIM Management System**: Processes different SIM types and instances
- **Error Handling & Retry**: Robust error handling with automatic retries
- **Status Tracking**: Comprehensive installation status monitoring

## 📱 SIM Card Support

### SuperSIM (8988 prefix)
- Endpoint: `/m2m/supersims/v1/Sims`
- Supports both Pegasus1 and Pegasus256 instances

### Wireless SIM (8901 prefix)
- Endpoint: `/m2m/wireless/v1/Sims`
- Supports both Pegasus1 and Pegasus256 instances

### SIM Processing Logic

1. **Check Pegasus256 first** (migrated SIMs)
2. **Fallback to Pegasus1** (warehouse SIMs)
3. **Activate warehouse SIMs** in Pegasus1
4. **Update status** for migrated SIMs in Pegasus256

## 🔄 Error Handling & Retry

- **Automatic Retries**: Failed API calls are retried with exponential backoff
- **Timeout Protection**: 30-second timeout for all Pegasus API calls
- **Graceful Degradation**: Non-critical failures don't stop the workflow
- **Comprehensive Logging**: Detailed logging for debugging and monitoring

## 🧪 Testing

### Test Mode

Enable test mode by setting `TEST_MODE = true` in `server.js`:

```javascript
const TEST_MODE = true; // Set to true for testing
```

Test mode will:
- Simulate all workflow steps
- Skip actual Pegasus API calls
- Return success responses for testing
- Log all simulated operations

### Environment Switching

Change the environment by modifying the `ENVIRONMENT` constant:

```javascript
const ENVIRONMENT = "qa"; // or "production"
```

## 📊 Monitoring & Status

### Installation Status Check

```bash
GET /api/installation-status/:installationId
```

Returns comprehensive status including:
- Installation status
- Vehicle creation status
- Group creation status
- Last update timestamp

### Health Checks

```bash
GET /api/health/pegasus
```

Monitors Pegasus API connectivity and response times.

## 🚨 Troubleshooting

### Common Issues

1. **Authentication Errors**: Verify Pegasus tokens are correct
2. **API Timeouts**: Check network connectivity and Pegasus service status
3. **SIM Not Found**: Verify SIM ICCID format and check both Pegasus instances
4. **Duplicate Installations**: Check installation ID uniqueness

### Debug Mode

Enable detailed logging by checking the server console output. All workflow steps are logged with emojis for easy identification.

## 🔐 Security

- **Token Management**: All API tokens are stored in environment configuration
- **Input Validation**: Comprehensive validation of all input parameters
- **Error Sanitization**: Error messages don't expose sensitive information
- **Rate Limiting**: Built-in retry mechanisms prevent API abuse

## 📈 Performance

- **Parallel Processing**: SIM and vehicle operations can run concurrently
- **Smart Retries**: Exponential backoff prevents overwhelming APIs
- **Connection Pooling**: Efficient HTTP connection management
- **Timeout Protection**: Prevents hanging requests

## 🔄 Migration from Zapier

This implementation completely replaces the Zapier integration:

### What's Replaced
- ✅ Zapier webhook calls
- ✅ External workflow dependencies
- ✅ Manual spreadsheet operations
- ✅ Complex conditional logic

### What's Improved
- 🚀 Direct API integration
- 🔄 Real-time status updates
- 🛡️ Better error handling
- 📊 Comprehensive monitoring
- 🧪 Built-in testing support

## 📝 Configuration

### Required Environment Variables

```bash
# Production
ENVIRONMENT=production
PEGASUS_TOKEN=your-production-token
PEGASUS1_TOKEN=your-pegasus1-token
PEGASUS256_TOKEN=your-pegasus256-token

# QA
ENVIRONMENT=qa
PEGASUS_TOKEN=your-qa-token
PEGASUS1_TOKEN=your-pegasus1-token
PEGASUS256_TOKEN=your-qa-pegasus256-token
```

### Optional configuration

See **`docs/ENVIRONMENT.md`** and **`env.example`**. Notable flags: `TEST_MODE`, and **`DANGEROUS_PEGASUS_CONFIRMATION_FALLBACK`** (unsafe; default off — see `docs/KNOWN_ISSUES.md`).

## 🚀 Getting Started

### Local Development

1. **Install Dependencies**: `npm install`
2. **Configure Environment**: Set env vars per `docs/ENVIRONMENT.md` (and copy `config.example.js` → `config.js` if needed)
3. **Start Server**: `node server.js`
4. **Access Wizard**: Open `http://localhost:8080` in your browser

### Quick Deploy to GitHub Pages

1. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: Select "GitHub Actions"
   - Push to main branch to trigger deployment

2. **Access Your Site**:
   - Your wizard will be available at: `https://digitalcomtech.github.io/qconnect_pass_wizard`
   - Note: This shows documentation only (static deployment)

### Full Application Deployment

For the complete application with all features, see the [Deployment Guide](DEPLOYMENT_GUIDE.md) for options including:

- **Heroku** - Quick deployment with free tier
- **Railway** - Modern platform with automatic deployments
- **DigitalOcean** - Full control with app platform
- **Vercel** - Serverless deployment
- **Your own server** - Maximum control

## 📚 Documentation

- **[Installer Guide](INSTALLER_GUIDE.md)** - Complete step-by-step instructions for field installers
- **[Quick Reference](QUICK_REFERENCE.md)** - Print-friendly reference card
- **[Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)** - Technical issue resolution
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Production deployment options

## 📞 Support

For technical support or questions about the installation workflow:

- Check the server console logs for detailed error information
- Verify Pegasus API connectivity using the health check endpoint
- Review the installation status endpoint for workflow progress
- Enable test mode for safe testing without affecting production systems
- Consult the troubleshooting guide for common issues
