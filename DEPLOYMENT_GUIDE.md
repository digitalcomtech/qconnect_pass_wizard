# QConnect PASS Wizard - Deployment Guide

## Overview
This guide covers different deployment options for the QConnect PASS Wizard, from simple GitHub Pages to full production deployments.

## GitHub Pages Deployment (Static)

### What You Get
- ✅ Public URL for your wizard
- ✅ Automatic deployment on code changes
- ✅ Free hosting
- ❌ No server functionality (Node.js features won't work)
- ❌ No API endpoints
- ❌ No authentication

### Setup Steps

1. **Enable GitHub Pages**
   - Go to your repository Settings → Pages
   - Source: Select "GitHub Actions"
   - The workflow is already configured in `.github/workflows/pages.yml`

2. **Deploy**
   - Push to main branch
   - GitHub Actions will automatically build and deploy
   - Your site will be available at: `https://digitalcomtech.github.io/qconnect_pass_wizard`

3. **What Users See**
   - A landing page explaining the deployment
   - Links to documentation
   - Instructions for running the full application

## Full Application Deployment

### Option 1: Heroku (Recommended for Quick Start)

1. **Install Heroku CLI**
   ```bash
   # macOS
   brew install heroku/brew/heroku
   
   # Or download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Deploy**
   ```bash
   # Login to Heroku
   heroku login
   
   # Create app
   heroku create your-wizard-name
   
   # Set environment variables
   heroku config:set NODE_ENV=production
   heroku config:set PEGASUS_TOKEN=your_token_here
   heroku config:set PEGASUS_BASE_URL=https://api.pegasusgateway.com
   
   # Deploy
   git push heroku main
   ```

3. **Access**
   - Your app will be available at: `https://your-wizard-name.herokuapp.com`

### Option 2: Railway

1. **Connect Repository**
   - Go to [Railway.app](https://railway.app)
   - Connect your GitHub repository
   - Select the repository

2. **Configure Environment**
   - Add environment variables in Railway dashboard:
     - `NODE_ENV=production`
     - `PEGASUS_TOKEN=your_token_here`
     - `PEGASUS_BASE_URL=https://api.pegasusgateway.com`

3. **Deploy**
   - Railway automatically deploys on push to main
   - Get your URL from the Railway dashboard

### Option 3: DigitalOcean App Platform

1. **Create App**
   - Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
   - Create new app from GitHub repository

2. **Configure**
   - Select Node.js runtime
   - Set build command: `npm install`
   - Set run command: `node server.js`

3. **Environment Variables**
   - Add in the app settings:
     - `NODE_ENV=production`
     - `PEGASUS_TOKEN=your_token_here`
     - `PEGASUS_BASE_URL=https://api.pegasusgateway.com`

### Option 4: Vercel (Serverless)

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. **Configure**
   - Add environment variables in Vercel dashboard
   - Set up custom domain if needed

### Option 5: Your Own Server

1. **Server Requirements**
   - Node.js 18+ installed
   - PM2 for process management (recommended)
   - Nginx for reverse proxy (optional)

2. **Deployment Steps**
   ```bash
   # Clone repository
   git clone https://github.com/digitalcomtech/qconnect_pass_wizard.git
   cd qconnect_pass_wizard
   
   # Install dependencies
   npm install
   
   # Configure environment
   cp config.example.js config.js
   # Edit config.js with your settings
   
   # Install PM2
   npm install -g pm2
   
   # Start application
   pm2 start server.js --name "qconnect-wizard"
   pm2 save
   pm2 startup
   ```

3. **Nginx Configuration** (Optional)
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## Environment Configuration

### Required Environment Variables

```bash
# Production environment
NODE_ENV=production

# Pegasus API configuration
PEGASUS_TOKEN=your_pegasus_token_here
PEGASUS_BASE_URL=https://api.pegasusgateway.com

# Optional: Custom port (default: 8080)
PORT=8080
```

### Security Considerations

1. **Never commit sensitive data**
   - Use environment variables for tokens
   - Keep `config.js` out of version control
   - Use `.env` files locally

2. **HTTPS in Production**
   - Always use HTTPS for production deployments
   - Configure SSL certificates
   - Use secure session settings

3. **Authentication**
   - Default users are in `users.js`
   - Change default passwords
   - Consider external authentication for production

## Monitoring and Maintenance

### Health Checks
- The app responds to `GET /` with status information
- Monitor the `/api/config` endpoint for configuration status

### Logs
- Application logs are written to console
- Use PM2 logs for server deployments: `pm2 logs qconnect-wizard`
- Use platform-specific logging for cloud deployments

### Updates
- Pull latest changes: `git pull origin main`
- Restart application: `pm2 restart qconnect-wizard`
- Or redeploy on cloud platforms

## Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Find process using port 8080
lsof -i :8080
# Kill process
kill -9 <PID>
```

**Environment Variables Not Loading**
- Check variable names match exactly
- Restart application after changing variables
- Verify platform-specific environment variable settings

**Authentication Issues**
- Check user credentials in `users.js`
- Verify JWT secret is set
- Clear browser cookies/localStorage

**API Connection Issues**
- Verify Pegasus token is valid
- Check network connectivity
- Confirm API endpoints are correct

## Cost Comparison

| Platform | Free Tier | Paid Plans | Best For |
|----------|-----------|------------|----------|
| GitHub Pages | ✅ Free | N/A | Documentation/Static |
| Heroku | ✅ Limited | $7+/month | Quick deployment |
| Railway | ✅ Limited | $5+/month | Modern platform |
| DigitalOcean | ❌ | $5+/month | Full control |
| Vercel | ✅ Limited | $20+/month | Serverless |
| Own Server | ❌ | $5+/month | Maximum control |

## Recommendations

### For Development/Testing
- Use GitHub Pages for documentation
- Use Heroku free tier for testing

### For Production
- **Small teams**: Railway or Heroku
- **Large deployments**: DigitalOcean or own server
- **Serverless**: Vercel

### For Maximum Control
- Deploy on your own server with PM2
- Use Nginx for reverse proxy
- Set up monitoring and backups

## Support

If you encounter deployment issues:

1. Check the logs for error messages
2. Verify environment variables are set correctly
3. Test locally first: `node server.js`
4. Check platform-specific documentation
5. Contact support with specific error details

---

**Remember**: Always test your deployment in a staging environment before going to production!
