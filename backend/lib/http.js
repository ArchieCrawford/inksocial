const sendJson = (res, status, payload) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Api-Key'
  });
  res.end(JSON.stringify(payload));
};

const parseJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return null;
  const data = Buffer.concat(chunks).toString('utf-8');
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
};

module.exports = { sendJson, parseJsonBody };
