// api/settings.js
// Handles retrieval and permanent saving of user settings
import { getSettings, saveSettings, addLog } from './lib/storage.js';

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
      const settings = await getSettings();
      return res.status(200).json({ success: true, settings });
    }

    if (req.method === 'POST') {
      const updates = req.body || {};
      const saved = await saveSettings(updates);

      await addLog({
        action: 'Settings Saved',
        target: 'System Preferences',
        details: `Saved: Auto-Publish=${saved.autoPublish ? 'ON' : 'OFF'}, GeoFocus=${saved.geoFocus}, Lang=${saved.defaultLanguage}`,
        status: 'SUCCESS'
      });

      return res.status(200).json({
        success: true,
        message: 'Settings saved successfully.',
        settings: saved
      });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  } catch (error) {
    console.error('Error in /api/settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process settings.',
      error: error.message
    });
  }
}
