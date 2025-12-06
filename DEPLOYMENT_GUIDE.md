# 🚀 Autonomous Workspace - Deployment Guide

## 📋 **Prerequisites**

Before deploying, you'll need:

### **Required API Keys:**
- `GROQ_API_KEY` - Get from [Groq Console](https://console.groq.com/)

### **Optional API Keys (for additional tools):**
- `GITHUB_TOKEN` - GitHub Personal Access Token
- `SLACK_BOT_TOKEN` - Slack Bot Token

---

## 🎯 **Deployment Options**

### **Option 1: Vercel (Recommended for Frontend + Backend)**

#### **1. Frontend Deployment:**
```bash
# Build the client
cd client
npm run build

# Deploy to Vercel
npx vercel --prod
```

#### **2. Backend Deployment:**
```bash
# Deploy backend to Vercel
cd mcp-server
npx vercel --prod
```

#### **3. Environment Variables on Vercel:**

**Backend Environment Variables:**
```
GROQ_API_KEY=your_groq_key_here
MCP_SERVER_PORT=3001
AUDIT_ENABLED=false  # Disable audit logging for production
# Optional:
GITHUB_TOKEN=your_github_token
SLACK_BOT_TOKEN=your_slack_token
```

**Frontend Environment Variables:**
```
VITE_API_BASE_URL=https://your-backend-url.vercel.app/api
```

#### **4. Configure Frontend API Base:**
Create `.env.local` in client folder:
```env
VITE_API_BASE_URL=https://your-backend-url.vercel.app/api
```

### **Option 2: Railway (Full-Stack)**

#### **1. Deploy to Railway:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway deploy
```

#### **2. Environment Variables on Railway:**
```
GROQ_API_KEY=your_groq_key_here
MCP_SERVER_PORT=3001
AUDIT_ENABLED=false  # Disable audit logging for production
# Optional:
GITHUB_TOKEN=your_github_token
SLACK_BOT_TOKEN=your_slack_token
```

#### **3. Frontend Environment Variables:**
Set in Railway dashboard or create `.env.local`:
```env
VITE_API_BASE_URL=https://your-railway-app.up.railway.app/api
```

### **Option 3: Render (Separate Services)**

#### **1. Deploy Backend to Render:**
```bash
# Connect your GitHub repo to Render
# Set build command: npm run build
# Set start command: npm start
```

#### **2. Deploy Frontend to Render:**
```bash
# Connect client folder to Render
# Set build command: npm run build
# Set publish directory: dist
```

#### **3. Environment Variables:**

**Backend:**
```
GROQ_API_KEY=your_groq_key_here
MCP_SERVER_PORT=3001
AUDIT_ENABLED=false  # Disable audit logging for production
```

**Frontend:**
```
VITE_API_BASE_URL=https://your-backend-render-app.onrender.com/api
```

---

## 🔧 **Environment Variable Setup**

### **Frontend (.env.local):**
```env
# Required: Your backend API URL
VITE_API_BASE_URL=https://your-backend-domain.com/api

# Examples for different platforms:
# Vercel: VITE_API_BASE_URL=https://your-app.vercel.app/api
# Railway: VITE_API_BASE_URL=https://your-app.up.railway.app/api
# Render: VITE_API_BASE_URL=https://your-app.onrender.com/api
# Custom: VITE_API_BASE_URL=https://api.yourdomain.com/api
```

### **Backend (.env):**
```env
# Required
GROQ_API_KEY=your_groq_api_key_here

# Production Settings
AUDIT_ENABLED=false  # Disable file-based audit logging for production

# Optional (for additional tools)
GITHUB_TOKEN=your_github_token
SLACK_BOT_TOKEN=your_slack_token

# Server Configuration
MCP_SERVER_PORT=3001
```

---

## ✅ **Deployment Verification**

### **Test Your Deployment:**

1. **Check Backend Health:**
```bash
curl https://your-backend-url.com/api/health
# Should return: {"status":"ok",...}
```

2. **Test Frontend API Connection:**
- Open your deployed frontend
- Try asking a simple question
- Check browser console for API errors

3. **Common Issues:**

**CORS Errors:**
- ✅ Backend has proper CORS configuration
- ✅ Frontend uses correct API URL

**API Connection Failed:**
- ✅ Check `VITE_API_BASE_URL` is set correctly
- ✅ Verify backend is running and accessible

**Environment Variables:**
- ✅ All required env vars are set in your hosting platform
- ✅ No extra spaces or quotes in env var values

---

## 🎯 **What Happens When You Set the Backend URL**

When you properly set `VITE_API_BASE_URL`:

1. ✅ **Development**: Proxy routes requests to localhost
2. ✅ **Production**: Direct API calls to your backend URL
3. ✅ **CORS**: Backend accepts cross-origin requests
4. ✅ **Error Handling**: Clear error messages for debugging
5. ✅ **Fallback**: Graceful fallback if backend is unavailable

Your setup is **production-ready** and will work perfectly when you set the correct backend URL! 🚀