const express = require('express')
const Report = require('../models/Report')
const Review = require('../models/Review')
const { auth, adminOnly } = require('../middleware/auth')

const router = express.Router()

router.get('/reports', auth, adminOnly, async (req, res) => {
  try {
    const filter = req.query.status ? { status: req.query.status } : {}
    const reports = await Report.find(filter, { sort: { createdAt: -1 }, populateReporter: true })
    res.json(reports)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/bots', auth, adminOnly, async (req, res) => {
  try {
    const User = require('../models/User')
    const bots = await User.find({ isBanned: true }, { select: 'name email botScore bannedReason bannedAt createdAt', sort: { bannedAt: -1 } })
    res.json(bots)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/users/:id/ban', auth, adminOnly, async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ error: 'Cannot ban yourself' })
    const User = require('../models/User')
    const target = await User.findById(req.params.id)
    if (!target) return res.status(404).json({ error: 'User not found' })
    if (target.role === 'admin') return res.status(400).json({ error: 'Cannot ban admin' })
    const user = await User.findByIdAndUpdate(req.params.id, { isBanned: true, bannedReason: req.body.reason || 'manual ban', bannedAt: new Date(), botScore: 10 }, { new: true })
    await Review.deleteByUserId(req.params.id).catch(()=>{})
    res.json(user)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/users/:id/unban', auth, adminOnly, async (req, res) => {
  try {
    const User = require('../models/User')
    const user = await User.findByIdAndUpdate(req.params.id, { isBanned: false, bannedReason: null, bannedAt: null, botScore: 0 }, { new: true })
    res.json(user)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/reports/:id', auth, adminOnly, async (req, res) => {
  try {
    const { action } = req.body
    if (action === 'resolve') {
      const report = await Report.findByIdAndUpdate(req.params.id, { status: 'resolved' }, { new: true })
      if (!report) return res.status(404).json({ error: 'Not found' })
      if (report.reviewId) await Review.findByIdAndDelete(report.reviewId)
      res.json(report)
    } else if (action === 'dismiss') {
      const report = await Report.findByIdAndUpdate(req.params.id, { status: 'dismissed' }, { new: true })
      if (!report) return res.status(404).json({ error: 'Not found' })
      res.json(report)
    } else res.status(400).json({ error: 'Invalid action' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
