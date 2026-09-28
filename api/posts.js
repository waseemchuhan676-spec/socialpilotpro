// api/posts.js
// Handles CRUD operations for Facebook Posts with full persistence
import { getPosts, getPostById, savePost, deletePost, addLog } from './lib/storage.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { id, status, category } = req.query;
      if (id) {
        const post = await getPostById(id);
        if (!post) {
          return res.status(404).json({ success: false, message: 'Post not found.' });
        }
        return res.status(200).json({ success: true, post });
      }

      let posts = await getPosts();
      if (status && status !== 'all') {
        posts = posts.filter((p) => p.status === status);
      }
      if (category && category !== 'All') {
        posts = posts.filter((p) => (p.category || '').toLowerCase().includes(category.toLowerCase()));
      }

      return res.status(200).json({ success: true, posts });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.title || !body.text) {
        return res.status(400).json({
          success: false,
          message: 'Both post title and text content are required.'
        });
      }

      const postRecord = {
        id: body.id || `post_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        refId: body.refId || 'manual',
        title: body.title.trim(),
        text: body.text.trim(),
        category: body.category || 'BISP / 8171',
        source: body.source || 'Official Government Source',
        sourceUrl: body.sourceUrl || '',
        language: body.language || 'Urdu + Roman Urdu',
        targetAudience: body.targetAudience || 'General Public',
        verificationStatus: body.verificationStatus || 'VERIFIED',
        status: body.status || 'pending',
        scheduledTime: body.scheduledTime || '',
        publishedTime: body.publishedTime || '',
        fbPostId: body.fbPostId || '',
        errorMessage: body.errorMessage || '',
        createdTime: body.createdTime || new Date().toISOString(),
        updatedTime: new Date().toISOString()
      };

      const allPosts = await savePost(postRecord);
      await addLog({
        action: 'Post Created',
        target: postRecord.title,
        details: `Saved as status "${postRecord.status}" (${postRecord.language})`,
        status: 'SUCCESS'
      });

      return res.status(201).json({ success: true, post: postRecord, posts: allPosts });
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!body.id) {
        return res.status(400).json({ success: false, message: 'Post ID is required for updating.' });
      }

      const existing = await getPostById(body.id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Post to update not found.' });
      }

      const updatedRecord = {
        ...existing,
        title: body.title !== undefined ? body.title.trim() : existing.title,
        text: body.text !== undefined ? body.text.trim() : existing.text,
        category: body.category || existing.category,
        source: body.source || existing.source,
        sourceUrl: body.sourceUrl !== undefined ? body.sourceUrl : existing.sourceUrl,
        language: body.language || existing.language,
        targetAudience: body.targetAudience || existing.targetAudience,
        verificationStatus: body.verificationStatus || existing.verificationStatus,
        status: body.status || existing.status,
        scheduledTime: body.scheduledTime !== undefined ? body.scheduledTime : existing.scheduledTime,
        publishedTime: body.publishedTime !== undefined ? body.publishedTime : existing.publishedTime,
        fbPostId: body.fbPostId !== undefined ? body.fbPostId : existing.fbPostId,
        errorMessage: body.errorMessage !== undefined ? body.errorMessage : existing.errorMessage,
        updatedTime: new Date().toISOString()
      };

      const allPosts = await savePost(updatedRecord);
      await addLog({
        action: 'Post Edited',
        target: updatedRecord.title,
        details: `Updated fields saved. Status: ${updatedRecord.status}`,
        status: 'SUCCESS'
      });

      return res.status(200).json({ success: true, post: updatedRecord, posts: allPosts });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id || (req.body && req.body.id);
      if (!id) {
        return res.status(400).json({ success: false, message: 'Post ID required for deletion.' });
      }

      const existing = await getPostById(id);
      const allPosts = await deletePost(id);
      await addLog({
        action: 'Post Deleted',
        target: existing ? existing.title : id,
        details: 'Post removed from queue',
        status: 'INFO'
      });

      return res.status(200).json({ success: true, posts: allPosts });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  } catch (error) {
    console.error('Error in /api/posts:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error processing posts.',
      error: error.message
    });
  }
}
