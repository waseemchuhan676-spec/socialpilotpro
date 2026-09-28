// api/auth/facebook.js
// Handles Meta OAuth authentication, Page enumeration, and secure token management
import {
  getFacebookConfig,
  saveFacebookConfig,
  addLog
} from './lib/storage.js';

const META_GRAPH_VERSION = 'v22.0';

// In-memory session store for active user OAuth tokens during page selection
let userOAuthSessions = {};

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, code, state, error, error_description } = req.query;

  const appId = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;

  // Determine current host and canonical OAuth redirect URI
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'socialpilotpro-pi.vercel.app';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const redirectUri = `${proto}://${host}/api/auth/facebook?action=callback`;

  try {
    // 1. Generate Meta OAuth Login URL
    if (action === 'login_url') {
      if (!appId) {
        return res.status(200).json({
          success: false,
          configured: false,
          message: 'FB_APP_ID environment variable is not configured in Vercel. Please add your Meta App ID in Vercel Project Settings.'
        });
      }

      const csrfState = `state_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const permissions = [
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_posts'
      ].join(',');

      const oauthUrl = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&state=${csrfState}&scope=${encodeURIComponent(permissions)}&response_type=code`;

      return res.status(200).json({
        success: true,
        loginUrl: oauthUrl,
        redirectUri: redirectUri,
        appIdConfigured: true
      });
    }

    // 2. OAuth Callback from Meta
    if (action === 'callback') {
      if (error) {
        await addLog({
          action: 'Facebook OAuth Cancelled/Failed',
          target: 'Meta Login',
          details: `${error}: ${error_description || 'User declined permissions or cancelled login'}`,
          status: 'WARN'
        });
        // Redirect back to frontend with error parameter
        res.setHeader('Location', `/index.html?fb_error=${encodeURIComponent(error_description || error)}#facebook`);
        return res.status(302).end();
      }

      if (!code) {
        res.setHeader('Location', `/index.html?fb_error=Missing_Auth_Code#facebook`);
        return res.status(302).end();
      }

      if (!appId || !appSecret) {
        res.setHeader(
          'Location',
          `/index.html?fb_error=FB_APP_SECRET_not_configured_in_Vercel#facebook`
        );
        return res.status(302).end();
      }

      // Step A: Exchange code for user access token
      const tokenUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&code=${code}`;

      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();

      if (!tokenData || !tokenData.access_token) {
        const errDesc = (tokenData && tokenData.error && tokenData.error.message) || 'Failed to exchange OAuth code.';
        res.setHeader('Location', `/index.html?fb_error=${encodeURIComponent(errDesc)}#facebook`);
        return res.status(302).end();
      }

      let userToken = tokenData.access_token;

      // Step B: Exchange for long-lived user token (60 days)
      try {
        const longLivedUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${userToken}`;
        const llRes = await fetch(longLivedUrl);
        const llData = await llRes.json();
        if (llData && llData.access_token) {
          userToken = llData.access_token;
        }
      } catch (e) {
        // Continue with short-lived token if exchange fails
      }

      // Step C: Fetch user profile
      const userRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me?fields=id,name&access_token=${userToken}`);
      const userData = await userRes.json();

      // Step D: Store session securely on server
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      userOAuthSessions[sessionId] = {
        userId: userData.id,
        userName: userData.name || 'Facebook User',
        userToken: userToken,
        createdAt: Date.now()
      };

      await addLog({
        action: 'Facebook User Authenticated',
        target: userData.name || userData.id,
        details: 'User authenticated via Meta OAuth. Ready to select managed Page.',
        status: 'SUCCESS'
      });

      // Redirect back to frontend with session key
      res.setHeader(
        'Location',
        `/index.html?fb_auth_success=1&session=${sessionId}&user_name=${encodeURIComponent(
          userData.name || 'Facebook User'
        )}#facebook`
      );
      return res.status(302).end();
    }

    // 3. Fetch Pages available to the authenticated user
    if (action === 'pages') {
      const sessionId = req.query.session || (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));
      const fbConfig = await getFacebookConfig();

      let activeToken = null;
      if (sessionId && userOAuthSessions[sessionId]) {
        activeToken = userOAuthSessions[sessionId].userToken;
      }

      // If user doesn't have an active login session, check if we have FB_PAGE_ACCESS_TOKEN
      if (!activeToken) {
        // Return current saved page if configured
        if (fbConfig.pageId && fbConfig.pageAccessToken) {
          return res.status(200).json({
            success: true,
            pages: [
              {
                id: fbConfig.pageId,
                name: fbConfig.pageName || 'Connected Page',
                category: 'Government / Schemes',
                isConnected: true
              }
            ],
            currentConnectedPageId: fbConfig.pageId
          });
        }

        return res.status(401).json({
          success: false,
          message: 'Not authenticated with Facebook. Please click "Login with Facebook" first.'
        });
      }

      // Query /me/accounts with user access token to get all Pages the user manages
      const pagesUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=id,name,category,access_token,tasks&access_token=${activeToken}`;
      const pagesRes = await fetch(pagesUrl);
      const pagesData = await pagesRes.json();

      if (pagesData && pagesData.data && Array.isArray(pagesData.data)) {
        // Cache page tokens securely in server session
        userOAuthSessions[sessionId].pages = pagesData.data;

        // Clean page list for frontend: DO NOT expose access_token!
        const safePages = pagesData.data.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category || 'Page',
          tasks: p.tasks || [],
          isConnected: p.id === fbConfig.pageId
        }));

        return res.status(200).json({
          success: true,
          pages: safePages,
          currentConnectedPageId: fbConfig.pageId || null
        });
      } else {
        const errMsg = (pagesData.error && pagesData.error.message) || 'Failed to retrieve Facebook Pages.';
        return res.status(400).json({
          success: false,
          message: errMsg,
          error: pagesData.error
        });
      }
    }

    // 4. Connect a selected Page
    if (req.method === 'POST' && action === 'connect_page') {
      const { sessionId, pageId } = req.body || {};

      if (!sessionId || !userOAuthSessions[sessionId]) {
        return res.status(401).json({
          success: false,
          message: 'Active Facebook login session expired or invalid. Please log in again.'
        });
      }

      const session = userOAuthSessions[sessionId];
      const selectedPage = (session.pages || []).find((p) => p.id === pageId);

      if (!selectedPage || !selectedPage.access_token) {
        return res.status(400).json({
          success: false,
          message: 'Selected Page was not found in your authorized Facebook Pages list.'
        });
      }

      // Securely save Page ID, Name, and Page Token on server
      await saveFacebookConfig({
        pageId: selectedPage.id,
        pageName: selectedPage.name,
        pageAccessToken: selectedPage.access_token,
        appId: appId
      });

      await addLog({
        action: 'Facebook Page Connected',
        target: selectedPage.name,
        details: `Page connected with ID ${selectedPage.id}. Ready for live publishing.`,
        status: 'CONNECTED'
      });

      return res.status(200).json({
        success: true,
        message: `Successfully connected Facebook Page: ${selectedPage.name}`,
        page: {
          id: selectedPage.id,
          name: selectedPage.name,
          category: selectedPage.category
        }
      });
    }

    // 5. Disconnect Page
    if (req.method === 'POST' && action === 'disconnect') {
      const oldConfig = await getFacebookConfig();
      await saveFacebookConfig({
        pageId: '',
        pageName: 'Not Connected',
        pageAccessToken: ''
      });

      await addLog({
        action: 'Facebook Page Disconnected',
        target: oldConfig.pageName || 'Page',
        details: 'Page token removed securely.',
        status: 'DISCONNECTED'
      });

      return res.status(200).json({
        success: true,
        message: 'Facebook Page disconnected successfully.'
      });
    }

    // 6. Overall Auth & Page Connection Status
    if (action === 'status') {
      const fbConfig = await getFacebookConfig();
      const hasPage = Boolean(fbConfig.pageId && fbConfig.pageAccessToken);

      return res.status(200).json({
        success: true,
        configured: hasPage,
        status: hasPage ? 'CONNECTED' : 'DISCONNECTED',
        pageName: fbConfig.pageName || 'Not Connected',
        pageId: fbConfig.pageId ? fbConfig.pageId : 'FB_PAGE_ID not set',
        hasAppId: Boolean(appId),
        hasAppSecret: Boolean(appSecret),
        graphVersion: META_GRAPH_VERSION
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid auth action specified.' });
  } catch (error) {
    console.error('Error in /api/auth/facebook:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error processing Facebook authentication.',
      error: error.message
    });
  }
}
