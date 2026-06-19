const express = require('express')
const Report = require('../models/Report')
const Review = require('../models/Review')
const { auth } = require('../middleware/auth')

const router = express.Router()

router.post('/', auth, async (req, res) => {
  try {
    const review = await Review.findById(req.body.reviewId)
    if (!review) return res.status(404).json({ error: 'Review not found' })
    const existing = await Report.findOne({ reviewId: req.body.reviewId, reportedBy: req.user.id })
    if (existing) return res.status(400).json({ error: 'Already reported' })
    const report = await Report.create({
      reviewId: review._id,
      reviewText: review.text,
      bookCover: review.bookCover,
      reportedBy: req.user.id,
      reason: req.body.reason
    })
    const n = await Report.countDocuments({ reviewId: review._id })
    if (n >= 3) await Review.findByIdAndDelete(review._id).catch(()=>{})
    res.status(201).json(report)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
