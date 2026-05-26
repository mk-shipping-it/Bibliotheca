const express = require('express')
const jwt = require('jsonwebtoken')
const passport = require('passport')
const User = require('../models/User')

const router = express.Router()

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

router.get('/google/callback', passport.authenticate('google', { session: false }), (req, res) => {
  const token = jwt.sign({ id: req.user._id, role: req.user.role }, process.env.JWT_SECRET)
  res.redirect('/oauth-callback.html?token=' + token)
})

router.get('/me', require('../middleware/auth').auth, async (req, res) => {
  try {
    const u = await User.findById(req.user.id, { select: '-password' })
    res.json(u)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
