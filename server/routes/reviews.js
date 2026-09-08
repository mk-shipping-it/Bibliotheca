const express = require('express')
const Review = require('../models/Review')
const Report = require('../models/Report')
const User = require('../models/User')
const { auth } = require('../middleware/auth')
const { RegExpMatcher, englishDataset, englishRecommendedTransformers } = require('obscenity')
const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers })
const stringSimilarity = require('string-similarity')

const router = express.Router()

router.get('/book/:bookCover', async (req, res) => {
  try {
    const reviews = await Review.find({ bookCover: req.params.bookCover }, { sort: { createdAt: -1 }, populateUser: true })
    res.json(reviews)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', auth, async (req, res) => {
  try {
    const { bookCover, bookTitle, rating, text } = req.body
    if (!text || text.trim().length < 10) return res.status(400).json({ error: 'Review too short' })

    // lifelike auto-moderation: profanity → auto-report (bad-words: filter.isProfane)
    if (matcher.hasMatch(text)) {
      await Report.create({ reviewText: text, bookCover, reason: 'auto: profanity detected', status: 'auto-flagged', isAuto: true, reportedBy: null })
      // bump botScore but don't block — appears as flagged, admin sees it
      await User.findByIdAndUpdate(req.user.id, { $inc: { botScore: 1 }, lastReviewAt: new Date() })
    }

    // lifelike duplicate spam — same user repeating near-identical text (>0.88 similarity)
    const recent = await Review.find({ userId: req.user.id }, { sort: { createdAt: -1 }, limit: 3, select: 'text' })
    for (const r of recent) {
      const sim = stringSimilarity.compareTwoStrings(r.text.slice(0,500), text.slice(0,500))
      if (sim > 0.88) {
        await Report.create({ reviewText: text, bookCover, reason: `auto: duplicate spam (similarity ${sim.toFixed(2)})`, status: 'auto-flagged', isAuto: true, reportedBy: null })
        const u = await User.findById(req.user.id)
        u.botScore = (u.botScore||0)+2
        if (u.botScore>=5 && u.role !== 'admin') { u.isBanned=true; u.bannedReason='auto: duplicate spam burst'; u.bannedAt=new Date(); await Review.deleteByUserId(req.user.id).catch(()=>{}) }
        await u.save()
        return res.status(429).json({ error: 'Duplicate review detected — auto-flagged as bot-like. Slow down.' })
      }
    }

    // lifelike rapid burst already handled by rateLimiter, but also increment botScore on success
    await User.findByIdAndUpdate(req.user.id, { lastReviewAt: new Date() })

    const review = await Review.create({ bookCover, bookTitle, rating: rating ?? null, text, userId: req.user.id, userName: req.user.name })

    // auto-report low-effort gibberish (e.g. "aaaaaa" or <15 chars without spaces) — appears real
    if (/^(.)\1{5,}$/.test(text.trim()) || text.trim().split(/\s+/).length < 3) {
      await Report.create({ reviewId: review._id, reviewText: text, bookCover, reason: 'auto: low-effort/gibberish', status: 'auto-flagged', isAuto: true, reportedBy: null })
    }

    res.status(201).json(review)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
    if (!review) return res.status(404).json({ error: 'Not found' })
    if (String(review.userId) !== String(req.user.id) && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not allowed' })
    await Review.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/mine', auth, async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.user.id }, { sort: { createdAt: -1 } })
    res.json(reviews)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
