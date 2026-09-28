// api/facebook.js
// Handles Facebook Page status verification and publishing via Meta Graph API v22.0
import {
  getFacebookConfig,
  getPostById,
  savePost,
  addLog,
  getSettings,
  acquirePublishLock,
  releasePublishLock
} from './lib/storage.js';

const META_GRAPH_VERSION = 'v22.0';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    const fbConfig = await getFacebookConfig();
    const settings = await getSettings();

    // 1. Connection Test / Status Check
    if (req.method === 'GET' || action === 'test') {
      const pageId = fbConfig.pageId || process.env.FB_PAGE_ID;
      const pageToken = fbConfig.pageAccessToken || process.env.FB_PAGE_ACCESS_TOKEN;

      if (!pageId || !pageToken) {
        return res.status(200).json({
          success: false,
          configured: false,
          status: 'DISCONNECTED',
          message: 'Facebook Page credentials (FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN) are not configured in Vercel environment.',
          page: null,
          graphVersion: META_GRAPH_VERSION
        });
      }

      // Query Meta Graph API for real Page status
      const graphUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}?fields=id,name,category,link,is_published&access_token=${encodeURIComponent(pageToken)}`;

      try {
        const metaRes = await fetch(graphUrl);
        const metaData = await metaRes.json();

        if (metaData && metaData.id && !metaData.error) {
          await addLog({
            action: 'Facebook Connection Test',
            target: metaData.name || pageId,
            details: `Meta Graph API ${META_GRAPH_VERSION} connection verified. Page ID: ${metaData.id}`,
            status: 'SUCCESS'
          });

          return res.status(200).json({
            success: true,
            configured: true,
            status: 'CONNECTED',
            page: {
              id: metaData.id,
              name: metaData.name,
              category: metaData.category || 'Government Organization',
              link: metaData.link || `https://facebook.com/${metaData.id}`,
              isPublished: metaData.is_published !== false
            },
            graphVersion: META_GRAPH_VERSION
          });
        } else {
          const errObj = metaData.error || {};
          const errMsg = errObj.message || 'Meta Graph API returned an error verifying the Facebook Page.';

          await addLog({
            action: 'Facebook Connection Test Failed',
            target: pageId,
            details: `Code: ${errObj.code || 'N/A'}, Subcode: ${errObj.error_subcode || 'N/A'}: ${errMsg}`,
            status: 'FAILED'
          });

          return res.status(200).json({
            success: false,
            configured: true,
            status: 'ERROR',
            message: errMsg,
            metaError: {
              code: errObj.code,
              subcode: errObj.error_subcode,
              type: errObj.type
            },
            graphVersion: META_GRAPH_VERSION
          });
        }
      } catch (networkErr) {
        return res.status(502).json({
          success: false,
          configured: true,
          status: 'NETWORK_ERROR',
          message: `Network error connecting to Meta Graph API: ${networkErr.message}`
        });
      }
    }

    // 2. Publish Post to Facebook Page
    if (req.method === 'POST' && (action === 'publish' || req.body.action === 'publish')) {
      const body = req.body || {};
      const { postId, message, isTestMode } = body;

      if (!message || !message.trim()) {
        return res.status(400).json({ success: false, message: 'Post message content is required.' });
      }

      // Check whether this is explicit Test Mode
      const isTestExecution = isTestMode === true || settings.testMode === true;

      if (isTestExecution) {
        const simulatedPostId = `sim_fb_${Date.now()}`;
        if (postId) {
          const post = await getPostById(postId);
          if (post) {
            post.status = 'published';
            post.fbPostId = simulatedPostId;
            post.publishedTime = new Date().toISOString();
            post.errorMessage = '';
            await savePost(post);
          }
        }

        await addLog({
          action: 'Facebook Publish [TEST MODE]',
          target: postId || 'Quick Publish',
          details: 'TEST MODE: No real Facebook post was broadcast. API simulation passed.',
          status: 'SUCCESS'
        });

        return res.status(200).json({
          success: true,
          testMode: true,
          postId: simulatedPostId,
          message: 'TEST MODE — No real Facebook post will be published. Simulation successful.'
        });
      }

      // Production Publishing: Real Meta Graph API
      const pageId = fbConfig.pageId || process.env.FB_PAGE_ID;
      const pageToken = fbConfig.pageAccessToken || process.env.FB_PAGE_ACCESS_TOKEN;

      if (!pageId || !pageToken) {
        return res.status(400).json({
          success: false,
          message: 'Facebook Page is not connected. Configure FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN before publishing in Production Mode.'
        });
      }

      // Idempotency: acquire lock
      const lockKey = postId || `msg_${Date.now()}`;
      if (!acquirePublishLock(lockKey)) {
        return res.status(429).json({
          success: false,
          message: 'Publish operation already in progress for this post. Duplicate publishing prevented.'
        });
      }

      try {
        const publishUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/feed`;

        const metaRes = await fetch(publishUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message.trim(),
            access_token: pageToken
          })
        });

        const metaData = await metaRes.json();
        releasePublishLock(lockKey);

        if (metaData && metaData.id && !metaData.error) {
          // Successfully published by Facebook!
          if (postId) {
            const post = await getPostById(postId);
            if (post) {
              post.status = 'published';
              post.fbPostId = metaData.id;
              post.publishedTime = new Date().toISOString();
              post.errorMessage = '';
              await savePost(post);
            }
          }

          await addLog({
            action: 'Facebook Post Published',
            target: postId || metaData.id,
            details: `Successfully published to Page. Live Facebook Post ID: ${metaData.id}`,
            status: 'PUBLISHED'
          });

          return res.status(200).json({
            success: true,
            postId: metaData.id,
            pageId: pageId,
            message: 'Post successfully published to Facebook Page via Meta Graph API.'
          });
        } else {
          // Meta API returned an error
          const errObj = metaData.error || {};
          const errMsg = errObj.message || 'Facebook Graph API rejected the publish request.';

          if (postId) {
            const post = await getPostById(postId);
            if (post) {
              post.status = 'failed';
              post.errorMessage = `[Meta Error ${errObj.code || 'API'}]: ${errMsg}`;
              await savePost(post);
            }
          }

          await addLog({
            action: 'Facebook Publish Failed',
            target: postId || 'Publish Attempt',
            details: `Code ${errObj.code}: ${errMsg}`,
            status: 'FAILED'
          });

          return res.status(400).json({
            success: false,
            message: `Facebook publishing failed: ${errMsg}`,
            metaError: {
              code: errObj.code,
              subcode: errObj.error_subcode,
              type: errObj.type,
              errorUserTitle: errObj.error_user_title,
              errorUserMsg: errObj.error_user_msg
            }
          });
        }
      } catch (err) {
        releasePublishLock(lockKey);
        if (postId) {
          const post = await getPostById(postId);
          if (post) {
            post.status = 'failed';
            post.errorMessage = `Network failure: ${err.message}`;
            await savePost(post);
          }
        }

        await addLog({
          action: 'Facebook Publish Exception',
          target: postId || 'Publish Attempt',
          details: err.message,
          status: 'FAILED'
        });

        return res.status(502).json({
          success: false,
          message: `Network error connecting to Facebook API: ${err.message}`
        });
      }
    }

    return res.status(400).json({ success: false, message: 'Invalid Facebook API action requested.' });
  } catch (error) {
    console.error('Fatal error in /api/facebook:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error processing Facebook integration.',
      error: error.message
    });
  }
}
