const crypto = require('node:crypto');

const SESSION_TTL_MS = Number(process.env.SESSION_TTL_HOURS || 24) * 60 * 60 * 1000;
const sessions = new Map();

const createSession = (address) => {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { address: address.toLowerCase(), expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
};

const getSession = (token) => {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
};

const removeSession = (token) => {
  sessions.delete(token);
};

module.exports = { createSession, getSession, removeSession };
