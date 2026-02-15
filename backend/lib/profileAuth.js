const crypto = require('node:crypto');
const { verifyMessage } = require('ethers');

const NONCE_TTL_MS = Number(process.env.NONCE_TTL_MINUTES || 5) * 60 * 1000;
const nonces = new Map();

const generateNonce = () => crypto.randomBytes(16).toString('hex');

const issueNonce = (address) => {
  const nonce = generateNonce();
  const issuedAt = new Date().toISOString();
  const expiresAt = Date.now() + NONCE_TTL_MS;
  nonces.set(address.toLowerCase(), { nonce, issuedAt, expiresAt });
  return { nonce, issuedAt };
};

const consumeNonce = (address, nonce) => {
  const entry = nonces.get(address.toLowerCase());
  if (!entry) return false;
  if (entry.nonce !== nonce) return false;
  if (Date.now() > entry.expiresAt) return false;
  nonces.delete(address.toLowerCase());
  return true;
};

const hashPayload = (payload) => {
  const data = Buffer.from(JSON.stringify(payload));
  return crypto.createHash('sha256').update(data).digest('hex');
};

const buildMessage = ({ address, nonce, issuedAt, payloadHash }) => {
  return [
    'InkSocial Profile Update',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Payload: ${payloadHash}`
  ].join('\n');
};

const verifySignature = ({ address, message, signature }) => {
  try {
    const recovered = verifyMessage(message, signature);
    return recovered.toLowerCase() === address.toLowerCase();
  } catch (error) {
    return false;
  }
};

module.exports = {
  issueNonce,
  consumeNonce,
  hashPayload,
  buildMessage,
  verifySignature
};
