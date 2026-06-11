import crypto from 'crypto';
import { createInvite, findInviteByToken, markInviteUsed } from '../repositories/inviteRepository.js';
import { addUser } from '../repositories/userRepository.js';
import { sendInviteEmail } from '../utils/mailer.js';

const TOKEN_BYTES = 32; // secure token
const EXPIRY_HOURS = 24;

export async function sendInvite(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    const invite = await createInvite(email, token, expiresAt);

    const base = process.env.APP_BASE || `${req.protocol}://${req.get('host')}`;
    const inviteUrl = `${base}/invite?token=${encodeURIComponent(token)}`;

    const preview = await sendInviteEmail(email, inviteUrl);

    res.status(201).json({ invite: { id: invite.id, email: invite.email, expiresAt: invite.expires_at }, preview });
  } catch (err) {
    console.error('sendInvite error', err);
    res.status(500).json({ error: 'Failed to create invite' });
  }
}

export async function verifyInvite(req, res) {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const invite = await findInviteByToken(token);
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.used) return res.status(400).json({ error: 'Invite already used' });
    if (new Date(invite.expires_at) < new Date()) return res.status(400).json({ error: 'Invite expired' });

    res.json({ email: invite.email });
  } catch (err) {
    console.error('verifyInvite error', err);
    res.status(500).json({ error: 'Verification failed' });
  }
}

export async function completeInvite(req, res) {
  try {
    const { token, name, password } = req.body;
    if (!token || !name || !password) return res.status(400).json({ error: 'token, name, password required' });

    const invite = await findInviteByToken(token);
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.used) return res.status(400).json({ error: 'Invite already used' });
    if (new Date(invite.expires_at) < new Date()) return res.status(400).json({ error: 'Invite expired' });

    // Create the user in-memory using existing repository shape
    const newUser = {
      id: `u${Math.floor(Math.random() * 1000000)}`,
      name,
      email: invite.email,
      role: 'User',
      status: 'Active',
      deployments: 0,
      lastLogin: 'Never',
      groups: [],
    };

    addUser(newUser);

    await markInviteUsed(invite.id);

    res.status(201).json({ user: newUser });
  } catch (err) {
    console.error('completeInvite error', err);
    res.status(500).json({ error: 'Failed to complete invite' });
  }
}
