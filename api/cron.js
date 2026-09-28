// api/cron.js
// Vercel Serverless Cron Handler for Automated Scheduled Publishing
import {
  getPosts,
  savePost,
  getSettings,
  getFacebookConfig,
  addLog,
  acquirePublishLock,
  releasePublishLock
} from './lib/storage.js';

const META_GRAPH_VERSION = 'v22.0';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  // Verify CRON_SECRET if configured on Vercel to prevent unauthorized external triggers
  const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ success: false, message: 'Unauthorized cron invocation.' });
    }
  }

  const startTime = Date.now();
  const summary = {
    processed: 0,
    published: 0,
    failed: 0,
    skipped: 0,
    details: []
  };

  try {
    const settings = await getSettings();
    const fbConfig = await getFacebookConfig();
    const posts = await getPosts();

    const now = new Date();

    // Find candidate posts: status === 'scheduled'
    const candidatePosts = posts.filter((p) => {
      if (p.status !== 'scheduled') return false;
      if (!p.scheduledTime) return false;

      // Parse scheduledTime: supports ISO or "YYYY-MM-DD HH:MM PKT"
      let schedDate = null;
      try {
        const cleanedTime = p.scheduledTime.replace(' PKT', '').replace(' ', 'T');
        schedDate = new Date(cleanedTime);
        if (isNaN(schedDate.getTime())) {
          schedDate = new Date(p.scheduledTime);
        }
      } catch (e) {
        schedDate = null;
      }

      if (!schedDate || isNaN(schedDate.getTime())) {
        // If unparseable date, skip
        return false;
      }

      // Check if scheduled time has arrived or passed
      return schedDate <= now;
    });

    if (candidatePosts.length === 0) {
      await addLog({
        action: 'Cron Check',
        target: 'Scheduled Queue',
        details: 'Checked queue: 0 posts due for dispatch.',
        status: 'INFO'
      });

      return res.status(200).json({
        success: true,
        message: 'Cron check complete. No scheduled posts due for dispatch.',
        summary,
        durationMs: Date.now() - startTime
      });
    }

    const pageId = fbConfig.pageId || process.env.FB_PAGE_ID;
    const pageToken = fbConfig.pageAccessToken || process.env.FB_PAGE_ACCESS_TOKEN;
    const isTestMode = settings.testMode === true;

    for (const post of candidatePosts) {
      summary.processed++;

      // Check duplicate protection & acquire lock
      if (!acquirePublishLock(post.id)) {
        summary.skipped++;
        summary.details.push({ id: post.id, status: 'SKIPPED', reason: 'Publish lock already active.' });
        continue;
      }

      // Check if already published
      if (post.status === 'published' || post.fbPostId) {
        releasePublishLock(post.id);
        summary.skipped++;
        summary.details.push({ id: post.id, status: 'SKIPPED', reason: 'Post already marked published.' });
        continue;
      }

      // Test Mode Simulation
      if (isTestMode) {
        post.status = 'published';
        post.fbPostId = `sim_cron_${Date.now()}`;
        post.publishedTime = new Date().toISOString();
        post.errorMessage = '';
        await savePost(post);
        releasePublishLock(post.id);

        summary.published++;
        summary.details.push({
          id: post.id,
          status: 'PUBLISHED_TEST_MODE',
          fbPostId: post.fbPostId
        });

        await addLog({
          action: 'Cron Scheduled Publish [TEST MODE]',
          target: post.title,
          details: 'TEST MODE: Post processed without broadcasting to Meta.',
          status: 'SUCCESS'
        });

        continue;
      }

      // Production Dispatch
      if (!pageId || !pageToken) {
        post.status = 'failed';
        post.errorMessage = 'Facebook credentials (FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN) missing in environment.';
        await savePost(post);
        releasePublishLock(post.id);

        summary.failed++;
        summary.details.push({ id: post.id, status: 'FAILED', reason: post.errorMessage });

        await addLog({
          action: 'Cron Publish Failed',
          target: post.title,
          details: post.errorMessage,
          status: 'FAILED'
        });

        continue;
      }

      try {
        const publishUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/feed`;
        const metaRes = await fetch(publishUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: post.text,
            access_token: pageToken
          })
        });

        const metaData = await metaRes.json();
        releasePublishLock(post.id);

        if (metaData && metaData.id && !metaData.error) {
          post.status = 'published';
          post.fbPostId = metaData.id;
          post.publishedTime = new Date().toISOString();
          post.errorMessage = '';
          await savePost(post);

          summary.published++;
          summary.details.push({ id: post.id, status: 'PUBLISHED', fbPostId: metaData.id });

          await addLog({
            action: 'Cron Automated Facebook Post',
            target: post.title,
            details: `Auto-published by server cron. Meta Post ID: ${metaData.id}`,
            status: 'PUBLISHED'
          });
        } else {
          const errObj = metaData.error || {};
          const errMsg = errObj.message || 'Meta Graph API rejected post dispatch.';

          post.status = 'failed';
          post.errorMessage = `[Meta Error ${errObj.code || 'API'}]: ${errMsg}`;
          await savePost(post);

          summary.failed++;
          summary.details.push({ id: post.id, status: 'FAILED', reason: errMsg });

          await addLog({
            action: 'Cron Automated Publish Failed',
            target: post.title,
            details: `Code ${errObj.code}: ${errMsg}`,
            status: 'FAILED'
          });
        }
      } catch (postErr) {
        releasePublishLock(post.id);
        post.status = 'failed';
        post.errorMessage = `Network error: ${postErr.message}`;
        await savePost(post);

        summary.failed++;
        summary.details.push({ id: post.id, status: 'FAILED', reason: postErr.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Cron run finished: ${summary.published} published, ${summary.failed} failed, ${summary.skipped} skipped.`,
      summary,
      durationMs: Date.now() - startTime
    });
  } catch (err) {
    console.error('Fatal error in /api/cron:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error running cron.',
      error: err.message
    });
  }
}
