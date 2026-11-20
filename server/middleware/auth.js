const jwt = require('jsonwebtoken');
const User = require('../models/User');
async function authenticate(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash -refreshTokenHash');
    if (!user) return res.status(401).json({ message: 'User no longer exists' });
    req.user = user; next();
  } catch { return res.status(401).json({ message: 'Invalid or expired token' }); }
}
const allowRoles = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Insufficient permissions' });
module.exports = { authenticate, allowRoles };
