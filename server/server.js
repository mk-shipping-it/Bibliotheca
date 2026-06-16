require('dotenv').config()
const express = require('express')
const cors = require('cors')
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const { connectDB } = require('./config/db')
const User = require('./models/User')

const app = express()
app.set('trust proxy', 1)
app.use(cors())
app.use(express.json())
app.use(express.static('..'))

// lifelike bot protection — rate limit reviews/reports (auto-report + auto-kick)
// uses express-rate-limit@8.7.0 per fetched docs (windowMs/limit/keyGenerator/handler)
const { rateLimit, ipKeyGenerator } = require('express-rate-limit')
const reviewLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  limit: 5, // 5 reviews / 10 min per user (human) — bots hammering hit 429
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST',
  keyGenerator: (req) => req.user?.id ? String(req.user.id) : ipKeyGenerator(req.ip),
  handler: (req, res) => {
    // auto-report the burst as bot-like (lifelike: appears as system report, not manual)
    const Report = require('./models/Report')
    const User = require('./models/User')
    Report.create({ reviewText: '[auto] rate burst', reason: 'auto: 5 reviews in 10 min — suspected bot', reportedBy: null, status: 'auto-flagged', reviewId: null }).catch(()=>{})
    // bump botScore and kick if repeated (3 windows)
    if (req.user?.id) {
      User.findById(req.user.id).then(u=>{
        if (!u || u.role === 'admin') return
        u.botScore = (u.botScore||0)+2
        u.lastReviewAt = new Date()
        if (u.botScore>=6) { u.isBanned=true; u.bannedReason='auto: rapid review burst'; u.bannedAt=new Date(); require('./models/Review').deleteByUserId(u.id).catch(()=>{}) }
        u.save().catch(()=>{})
      })
    }
    res.status(429).json({ error: 'Too many reviews — slow down. Auto-flagged as bot-like.' })
  }
})
const reportLimiter = rateLimit({
  windowMs: 15*60*1000, limit: 10, standardHeaders:'draft-8', legacyHeaders:false,
  skip: (req) => req.method !== 'POST',
  keyGenerator: (req)=> req.user?.id ? String(req.user.id) : ipKeyGenerator(req.ip),
  handler: (req,res)=>res.status(429).json({error:'Too many reports'})
})

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback'
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL,
    proxy: true
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id })
      if (!user) user = await User.create({ googleId: profile.id, name: profile.displayName, email: profile.emails?.[0]?.value })
      done(null, user)
    } catch (e) { done(e) }
  }))
} else {
  console.log('Google OAuth disabled — set GOOGLE_CLIENT_ID/SECRET to enable')
}

app.use('/api/auth', require('./routes/auth'))
app.use('/api/books', require('./routes/books'))
app.use('/api/reviews', reviewLimiter, require('./routes/reviews'))
app.use('/api/reports', reportLimiter, require('./routes/reports'))
app.use('/api/admin', require('./routes/admin'))

async function start() {
  await connectDB()
  app.listen(process.env.PORT || 3001, () => console.log('Server on port ' + (process.env.PORT || 3001)))
}

start().catch(e => { console.error(e); process.exit(1) })
