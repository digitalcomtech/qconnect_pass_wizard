# Deployment Guide - QConnect PASS Wizard

This guide explains how to deploy the QConnect PASS Wizard securely using GitHub Actions and environment secrets.

## 🚀 Overview

The application is designed to be deployed using:
- **GitHub Actions** for CI/CD automation
- **GitHub Secrets** for secure credential management
- **Environment-specific configurations** for QA and Production
- **Secure token handling** without exposing sensitive data

## 🔐 GitHub Secrets Setup

### Required Secrets

You need to set up the following secrets in your GitHub repository:

#### 1. **Authentication Secrets**
```
JWT_SECRET                    # Strong random string for JWT tokens
SESSION_SECRET               # Strong random string for sessions
```

#### 2. **Production Environment Secrets**
```
PROD_PEGASUS_BASE_URL       # Production Pegasus base URL
PROD_PEGASUS_TOKEN          # Production Pegasus main token
PROD_PEGASUS1_TOKEN         # Production Pegasus1 instance token
PROD_PEGASUS256_TOKEN       # Production Pegasus256 instance token
PROD_ZAPIER_HOOK_INSTALL    # Production Zapier hook URL
PROD_ZAPIER_HOOK_SECRET     # Production Zapier secondary hook
```

#### 3. **QA Environment Secrets**
```
QA_PEGASUS_BASE_URL         # QA Pegasus base URL
QA_PEGASUS_TOKEN            # QA Pegasus main token
QA_PEGASUS1_TOKEN           # QA Pegasus1 instance token
QA_PEGASUS256_TOKEN         # QA Pegasus256 instance token
QA_ZAPIER_HOOK_INSTALL      # QA Zapier hook URL
QA_ZAPIER_HOOK_SECRET       # QA Zapier secondary hook
```

#### 4. **Optional Configuration Secrets**
```
API_TIMEOUT                 # API timeout in milliseconds
API_MAX_RETRIES            # Maximum retry attempts
PROXIMITY_RADIUS           # Proximity check radius in meters
MAX_DEVICE_WAIT_TIME       # Maximum device wait time
```

### How to Set Up GitHub Secrets

1. **Go to your GitHub repository**
2. **Click Settings** → **Secrets and variables** → **Actions**
3. **Click "New repository secret"**
4. **Add each secret** with the exact name and value
5. **Click "Add secret"**

### Generate Strong Secrets

For JWT and Session secrets, generate strong random strings:

```bash
# Generate JWT secret
openssl rand -base64 64

# Generate session secret
openssl rand -base64 64

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

## 🏗️ Environment Configuration

### Environment Structure

The application supports multiple environments:

```
┌─────────────────┬─────────────────┬─────────────────┐
│   Development   │      QA         │   Production    │
├─────────────────┼─────────────────┼─────────────────┤
│ Local testing   │ Staging/Testing │ Live production │
│ .env file       │ GitHub Secrets  │ GitHub Secrets  │
│ config.js       │ Environment     │ Environment     │
└─────────────────┴─────────────────┴─────────────────┘
```

### Environment Selection

- **Development**: Uses local `.env` file or `config.js`
- **QA**: Uses GitHub Secrets with `ENVIRONMENT=qa`
- **Production**: Uses GitHub Secrets with `ENVIRONMENT=production`

## 🔄 Deployment Workflow

### GitHub Actions Workflow

The `.github/workflows/deploy.yml` file defines the deployment process:

1. **Test Stage**: Runs tests on multiple Node.js versions
2. **QA Deployment**: Deploys to QA when pushing to `develop` branch
3. **Production Deployment**: Deploys to production when pushing to `main` branch
4. **Security Scan**: Scans for vulnerabilities and exposed secrets

### Branch Strategy

```
main     → Production deployment (requires approval)
develop  → QA deployment (automatic)
feature  → No deployment (testing only)
```

### Deployment Triggers

- **Push to main**: Triggers production deployment
- **Push to develop**: Triggers QA deployment
- **Pull Request**: Runs tests and security scans
- **Manual**: Use "workflow_dispatch" for manual deployment

## 🚀 Deployment Steps

### 1. Prepare Your Repository

```bash
# Ensure all changes are committed
git add .
git commit -m "Add authentication system and deployment configuration"
git push origin main
```

### 2. Set Up GitHub Secrets

1. Go to your repository settings
2. Navigate to Secrets and variables → Actions
3. Add all required secrets (see list above)
4. Ensure secrets are properly named and valued

### 3. Configure Environments

1. Go to Settings → Environments
2. Create `qa` environment
3. Create `production` environment
4. Set protection rules if needed

### 4. Deploy

```bash
# Deploy to QA (develop branch)
git checkout develop
git merge main
git push origin develop

# Deploy to Production (main branch)
git checkout main
git push origin main
```

## 🛡️ Security Best Practices

### 1. **Never Commit Sensitive Data**
- ✅ Use `.env` files locally (already in .gitignore)
- ✅ Use GitHub Secrets for production
- ✅ Use `config.example.js` as template
- ❌ Never commit `config.js` with real tokens

### 2. **Secret Management**
- ✅ Rotate secrets regularly
- ✅ Use different secrets for each environment
- ✅ Limit access to repository secrets
- ✅ Monitor secret usage

### 3. **Environment Isolation**
- ✅ Separate QA and Production secrets
- ✅ Use different deployment targets
- ✅ Test in QA before production
- ✅ Rollback capability

### 4. **Access Control**
- ✅ Require approval for production deployment
- ✅ Limit who can modify workflows
- ✅ Audit deployment logs
- ✅ Monitor for unauthorized access

## 🔍 Monitoring and Troubleshooting

### Deployment Status

Check deployment status in:
1. **GitHub Actions** tab
2. **Environments** section
3. **Deployment logs**

### Common Issues

#### 1. **Secrets Not Found**
```
Error: Required environment variable 'PROD_PEGASUS_TOKEN' is not set
```
**Solution**: Check GitHub Secrets are properly configured

#### 2. **Environment Not Found**
```
Error: Environment 'production' not found
```
**Solution**: Create environment in repository settings

#### 3. **Deployment Failed**
```
Error: Deployment failed due to missing dependencies
```
**Solution**: Check workflow file and deployment scripts

### Debugging Steps

1. **Check GitHub Actions logs**
2. **Verify secrets are set correctly**
3. **Check environment configuration**
4. **Test locally with .env file**
5. **Verify deployment permissions**

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] All tests pass locally
- [ ] GitHub Secrets configured
- [ ] Environments created
- [ ] Workflow file committed
- [ ] Branch protection rules set

### Deployment
- [ ] Push to appropriate branch
- [ ] Monitor GitHub Actions
- [ ] Verify deployment success
- [ ] Test deployed application
- [ ] Check logs for errors

### Post-Deployment
- [ ] Verify all functionality works
- [ ] Check authentication system
- [ ] Monitor application logs
- [ ] Update documentation
- [ ] Notify stakeholders

## 🔮 Advanced Deployment Options

### 1. **Blue-Green Deployment**
- Deploy new version alongside old
- Switch traffic when ready
- Rollback capability

### 2. **Canary Deployment**
- Deploy to small percentage of users
- Monitor performance and errors
- Gradually increase deployment

### 3. **Rolling Deployment**
- Deploy to subset of servers
- Gradually update all instances
- Maintain availability

### 4. **Infrastructure as Code**
- Use Terraform or CloudFormation
- Version control infrastructure
- Automated provisioning

## 📞 Support and Resources

### Documentation
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Secrets Guide](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Environment Protection Rules](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)

### Tools
- **GitHub CLI**: Manage secrets programmatically
- **GitHub Desktop**: Visual repository management
- **VS Code**: Integrated Git and GitHub features

### Community
- GitHub Community Discussions
- Stack Overflow
- GitHub Support

---

## 🎯 Next Steps

1. **Set up GitHub Secrets** with your actual values
2. **Create environments** for QA and Production
3. **Test deployment** to QA environment
4. **Deploy to production** when ready
5. **Monitor and maintain** the deployment

Your QConnect PASS Wizard is now ready for secure, automated deployment! 🚀
