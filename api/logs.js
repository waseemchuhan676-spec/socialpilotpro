// api/logs.js
// Handles retrieval and recording of real diagnostic and activity events
import { getLogs, addLog } from './lib/storage.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const logs = await getLogs();
      return res.status(200).json({ success: true, logs });
    }

    if (req.method === 'POST') {
      const { action, target, details, status } = req.body || {};
      if (!action) {
        return res.status(400).json({ success: false, message: 'Action name is required.' });
      }

      const newLog = await addLog({
        action,
        target: target || 'Desk',
        details: details || '',
        status: status || 'INFO'
      });

      return res.status(201).json({ success: true, log: newLog });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  } catch (error) {
    console.error('Error in /api/logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve or store activity logs.',
      error: error.message
    });
  }
}
