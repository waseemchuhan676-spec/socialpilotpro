// api/research.js
// Handles retrieval, filtering, and manual addition of official research items
import { getResearch, saveResearch, updateResearchStatus, addLog } from './lib/storage.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { q, category, status, scope } = req.query;
      let items = await getResearch();

      if (category && category !== 'All categories') {
        items = items.filter((item) =>
          item.cat.toLowerCase().includes(category.toLowerCase())
        );
      }

      if (status && status !== 'All verification') {
        items = items.filter((item) => item.status === status);
      }

      if (scope) {
        if (scope === 'Punjab only') {
          items = items.filter((item) =>
            item.location.toLowerCase().includes('punjab') || item.cat.includes('Punjab')
          );
        } else if (scope === 'Pakistan-wide') {
          items = items.filter((item) =>
            item.location.toLowerCase().includes('pakistan') ||
            item.cat.includes('Federal') ||
            item.cat.includes('BISP')
          );
        }
      }

      if (q) {
        const query = q.toLowerCase();
        items = items.filter((item) => {
          const haystack = `${item.title} ${item.desc} ${item.source} ${item.facts.join(' ')}`.toLowerCase();
          return haystack.includes(query);
        });
      }

      return res.status(200).json({ success: true, items });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.title || !body.desc || !body.source) {
        return res.status(400).json({
          success: false,
          message: 'Title, summary, and official source name are required.'
        });
      }

      let facts = Array.isArray(body.facts) ? body.facts : [];
      if (typeof body.facts === 'string') {
        facts = body.facts
          .split('\n')
          .map((f) => f.replace(/^[-•*]\s*/, '').trim())
          .filter((f) => f.length > 0);
      }

      const newItem = {
        id: body.id || `res_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        cat: body.cat || 'BISP / 8171',
        title: body.title.trim(),
        desc: body.desc.trim(),
        status: body.status || 'VERIFIED',
        source: body.source.trim(),
        url: body.url || 'https://punjab.gov.pk',
        pubDate: body.pubDate || new Date().toISOString().split('T')[0],
        time: body.time || 'Just now',
        location: body.location || 'Pakistan-wide',
        facts: facts.length ? facts : [body.desc.trim()],
        beneficiaries: body.beneficiaries || 'Eligible citizens'
      };

      const updatedList = await saveResearch(newItem);
      await addLog({
        action: 'Research Added',
        target: newItem.title,
        details: `Official update registered from ${newItem.source} [${newItem.status}]`,
        status: 'SUCCESS'
      });

      return res.status(201).json({ success: true, item: newItem, items: updatedList });
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!body.id || !body.status) {
        return res.status(400).json({ success: false, message: 'Research ID and new status are required.' });
      }

      const validStatuses = ['VERIFIED', 'CROSS-CHECK', 'NEEDS REVIEW'];
      if (!validStatuses.includes(body.status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      const updatedList = await updateResearchStatus(body.id, body.status);
      await addLog({
        action: 'Research Status Updated',
        target: body.id,
        details: `Verification status changed to ${body.status}`,
        status: 'INFO'
      });

      return res.status(200).json({ success: true, items: updatedList });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  } catch (error) {
    console.error('Error in /api/research:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process research data.',
      error: error.message
    });
  }
}
