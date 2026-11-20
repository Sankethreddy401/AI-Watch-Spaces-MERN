const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const access = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' });
const refresh = id => jwt.sign({ id, nonce: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
module.exports = { access, refresh };
