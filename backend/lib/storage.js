const { URL } = require('node:url');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.PROFILE_STORAGE_BUCKET || 'profile-media';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const decodeDataUrl = (dataUrl) => {
  const match = /^data:(.*);base64,(.*)$/.exec(dataUrl || '');
  if (!match) throw new Error('Invalid image data');
  const contentType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  return { buffer, contentType };
};

const uploadPublicObject = async ({ path, dataUrl, contentTypeOverride }) => {
  const { buffer, contentType } = decodeDataUrl(dataUrl);
  const url = new URL(`/storage/v1/object/${BUCKET}/${path}`, SUPABASE_URL);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': contentTypeOverride || contentType,
      'x-upsert': 'true'
    },
    body: buffer
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} ${text}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
};

module.exports = { uploadPublicObject };
