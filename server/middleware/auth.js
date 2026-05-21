const jwt = require('jsonwebtoken')

async function auth(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' })
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET)
    // lifelike bot kick: block banned users (like SAMs isActive)
    const User = require('../models/User')
    const user = await User.findById(decoded.id)
    if (!user) return res.status(401).json({ error: 'User not found' })
    if (user.isBanned && user.role !== 'admin') return res.status(403).json({ error: 'Account banned: ' + (user.bannedReason || 'bot activity') })
    req.user = decoded
    req.userDoc = user
    next()
  } catch { return res.status(401).json({ error: 'Invalid token' }) }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' })
  next()
}

module.exports = { auth, adminOnly }
