import { getLauncherUpdate } from '../services/launcherUpdateService.js';

export function checkLauncherUpdate(req, res) {
  res.json({
    update: getLauncherUpdate(req.query.currentVersion),
  });
}
