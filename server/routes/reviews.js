const express = require('express')
const Review = require('../models/Review')
const Report = require('../models/Report')
const User = require('../models/User')
const { auth } = require('../middleware/auth')
const { RegExpMatcher, englishDataset, englishRecommendedTransformers } = require('obscenity')
const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers })
const stringSimilarity = require('string-similarity')
const { LinkifyIt } = require('linkify-it')
const linkify = new LinkifyIt({ fuzzyLink: true, fuzzyEmail: true })

const SALES_PHRASES = ['hit me up', 'call me', 'text me', 'dm me', 'message me', 'contact me', 'reach me', 'check out my', 'visit my', 'follow me', 'add me on', 'whatsapp', 'telegram', 'available anytime', 'any place you name', 'link in bio', 'buy now', 'discount code', 'promo code', 'use my code', 'limited offer', 'act now']
const HANDLE_RE = /(^|\s)@[A-Za-z0-9_]{2,}\b/
const PHONE_CANDIDATE_RE = /\+?[\d][\d\s().-]{6,}[\d]/g

function detectShill(text) {
  const norm = String(text)
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/(\w)\s+dot\s+(?=\w)/gi, '$1.')
    .replace(/(\w)\s+at\s+(?=[A-Za-z][\w.]*\.[\w.]+)/gi, '$1@')
  const signals = []
  const phoneSpans = []
  const spanRe = new RegExp(PHONE_CANDIDATE_RE.source, 'g')
  let sm
  while ((sm = spanRe.exec(norm))) phoneSpans.push([sm.index, sm.index + sm[0].length])
  const isPhoneSpan = (s, e) => phoneSpans.some(([ps, pe]) => s >= ps && e <= pe)
  const links = linkify.match(norm) || []
  if (links.some((l) => !isPhoneSpan(l.index, l.last_index))) signals.push('link')
  if (HANDLE_RE.test(norm)) signals.push('handle')
  const cands = norm.match(PHONE_CANDIDATE_RE) || []
  if (cands.some((c) => { const d = c.replace(/\D/g, ''); return d.length >= 10 || (d.length >= 7 && /[()\s.-]/.test(c)) })) signals.push('phone')
  const low = norm.toLowerCase()
  if (SALES_PHRASES.some((p) => low.includes(p))) signals.push('sales-phrase')
  return signals
}

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

    // drop gibberish before saving (low-effort spam: "aaaaaa", "asdfasdf")
    const trimmed = text.trim()
    const letters = trimmed.toLowerCase().replace(/[^a-z]/g, '')
    const isGibberish =
      /^(.)\1{5,}$/.test(trimmed) ||
      (letters.length >= 10 && new Set(letters).size <= 3) ||
      (letters.length >= 10 && letters.length <= 20 && (new Set(letters).size / letters.length) < 0.4) ||
      (letters.length > 20 && new Set(letters).size <= 5)
    if (isGibberish) {
      await Report.create({ reviewText: text, bookCover, reason: 'auto: dropped gibberish', status: 'auto-flagged', isAuto: true, reportedBy: null })
      const u = await User.findById(req.user.id)
      if (u) {
        u.botScore = (u.botScore || 0) + 1
        u.lastReviewAt = new Date()
        if (u.botScore >= 6 && u.role !== 'admin') {
          u.isBanned = true
          u.bannedReason = 'auto: gibberish spam'
          u.bannedAt = new Date()
          await Review.deleteByUserId(req.user.id).catch(() => {})
        }
        await u.save()
      }
      return res.status(400).json({ error: 'Low-effort gibberish review was not posted.' })
    }

    // lifelike auto-moderation: profanity → auto-report
    if (matcher.hasMatch(text)) {
      await Report.create({ reviewText: text, bookCover, reason: 'auto: profanity detected', status: 'auto-flagged', isAuto: true, reportedBy: null })
      // bump botScore but don't block — appears as flagged, admin sees it
      const u = await User.findById(req.user.id)
      if (u) {
        u.botScore = (u.botScore || 0) + 1
        u.lastReviewAt = new Date()
        if (u.botScore >= 5 && u.role !== 'admin') {
          u.isBanned = true
          u.bannedReason = 'auto: profanity spam'
          u.bannedAt = new Date()
          await Review.deleteByUserId(req.user.id).catch(() => {})
        }
        await u.save()
        if (u.isBanned) {
          return res.status(403).json({ error: 'Account banned: ' + u.bannedReason })
        }
      }
    }

    // lifelike duplicate spam — same user repeating near-identical text (>0.88 similarity)
    const recent = await Review.find({ userId: req.user.id }, { sort: { createdAt: -1 }, limit: 3, select: 'text' })
    for (const r of recent) {
      const sim = stringSimilarity.compareTwoStrings(r.text.slice(0,500), text.slice(0,500))
      if (sim > 0.88) {
        await Report.create({ reviewText: text, bookCover, reason: `auto: duplicate spam (similarity ${sim.toFixed(2)})`, status: 'auto-flagged', isAuto: true, reportedBy: null })
        const u = await User.findById(req.user.id)
        if (u) {
          u.botScore = (u.botScore || 0) + 2
          u.lastReviewAt = new Date()
          if (u.botScore >= 5 && u.role !== 'admin') {
            u.isBanned = true
            u.bannedReason = 'auto: duplicate spam burst'
            u.bannedAt = new Date()
            await Review.deleteByUserId(req.user.id).catch(() => {})
          }
          await u.save()
        }
        return res.status(429).json({ error: 'Duplicate review detected — auto-flagged as bot-like. Slow down.' })
      }
    }

    // lifelike rapid burst already handled by rateLimiter, but also increment botScore on success
    await User.findByIdAndUpdate(req.user.id, { lastReviewAt: new Date() })

    const review = await Review.create({ bookCover, bookTitle, rating: rating ?? null, text, userId: req.user.id, userName: req.user.name })

    const shill = detectShill(text)
    if (shill.length) {
      await Report.create({ reviewId: review._id, reviewText: text, bookCover, reason: 'auto: suspected shill (' + shill.join(', ') + ')', status: 'auto-flagged', isAuto: true, reportedBy: null })
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
