const { query } = require('../config/db')

const COLS = {
  id: 'id', _id: 'id', email: 'email', password: 'password',
  googleId: 'google_id', google_id: 'google_id', name: 'name', role: 'role',
  isBanned: 'is_banned', is_banned: 'is_banned',
  bannedReason: 'banned_reason', banned_reason: 'banned_reason',
  bannedAt: 'banned_at', banned_at: 'banned_at',
  botScore: 'bot_score', bot_score: 'bot_score',
  lastReviewAt: 'last_review_at', last_review_at: 'last_review_at'
}

function iso(v) {
  if (v === null || v === undefined) return v
  return v instanceof Date ? v.toISOString() : v
}

function map(row, omitPassword) {
  if (!row) return null
  const u = {
    id: row.id,
    _id: row.id,
    email: row.email,
    googleId: row.google_id,
    name: row.name,
    role: row.role,
    isBanned: row.is_banned,
    bannedReason: row.banned_reason,
    bannedAt: iso(row.banned_at),
    botScore: row.bot_score,
    lastReviewAt: iso(row.last_review_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  }
  if (!omitPassword) u.password = row.password
  u.save = async function () {
    const res = await query(
      `UPDATE users SET email=$1, password=$2, google_id=$3, name=$4, role=$5,
        is_banned=$6, banned_reason=$7, banned_at=$8, bot_score=$9,
        last_review_at=$10, updated_at=now() WHERE id=$11 RETURNING *`,
      [u.email ?? null, u.password ?? null, u.googleId ?? null, u.name,
        u.role || 'user', !!u.isBanned, u.bannedReason ?? null,
        u.bannedAt ?? null, u.botScore || 0, u.lastReviewAt ?? null, u.id]
    )
    if (res.rows[0]) u.updatedAt = iso(res.rows[0].updated_at)
    return u
  }
  return u
}

function whereClause(filter) {
  const keys = Object.keys(filter)
  if (!keys.length) return { text: '', vals: [] }
  const vals = keys.map((k) => {
    const v = filter[k]
    if (k === '_id' || k === 'id') return v === null || v === undefined ? v : Number(v)
    return v
  })
  const text = 'WHERE ' + keys.map((k, i) => `${COLS[k] || k} = $${i + 1}`).join(' AND ')
  return { text, vals }
}

async function findOne(filter = {}) {
  const { text, vals } = whereClause(filter)
  const res = await query(`SELECT * FROM users ${text} LIMIT 1`, vals)
  return map(res.rows[0] || null)
}

async function findById(id, opts = {}) {
  const res = await query('SELECT * FROM users WHERE id = $1 LIMIT 1', [Number(id)])
  return map(res.rows[0] || null, opts.select === '-password')
}

async function findByIdAndUpdate(id, update = {}, opts = {}) {
  const sets = []
  const vals = []
  const inc = update.$inc || {}
  for (const [k, v] of Object.entries(inc)) {
    vals.push(v)
    sets.push(`${COLS[k] || k} = COALESCE(${COLS[k] || k}, 0) + $${vals.length}`)
  }
  const flat = { ...(update.$set || {}) }
  for (const [k, v] of Object.entries(update)) {
    if (k === '$inc' || k === '$set') continue
    flat[k] = v
  }
  for (const [k, v] of Object.entries(flat)) {
    vals.push(v === undefined ? null : v)
    sets.push(`${COLS[k] || k} = $${vals.length}`)
  }
  if (!sets.length) return findById(id, opts)
  vals.push(Number(id))
  const res = await query(
    `UPDATE users SET ${sets.join(', ')}, updated_at=now() WHERE id = $${vals.length} RETURNING *`,
    vals
  )
  return map(res.rows[0] || null, opts.select === '-password')
}

async function create(data = {}) {
  const res = await query(
    `INSERT INTO users (email, password, google_id, name, role, is_banned, banned_reason, banned_at, bot_score, last_review_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [data.email ?? null, data.password ?? null, data.googleId ?? data.google_id ?? null,
      data.name, data.role || 'user', !!data.isBanned,
      data.bannedReason ?? data.banned_reason ?? null, data.bannedAt ?? data.banned_at ?? null,
      data.botScore ?? data.bot_score ?? 0, data.lastReviewAt ?? data.last_review_at ?? null]
  )
  return map(res.rows[0])
}

async function countDocuments(filter = {}) {
  const { text, vals } = whereClause(filter)
  const res = await query(`SELECT COUNT(*)::int AS n FROM users ${text}`, vals)
  return res.rows[0].n
}

const SELECTABLE = {
  name: 'name', email: 'email', botScore: 'bot_score', bot_score: 'bot_score',
  bannedReason: 'banned_reason', banned_reason: 'banned_reason',
  bannedAt: 'banned_at', banned_at: 'banned_at', createdAt: 'created_at', created_at: 'created_at'
}

async function find(filter = {}, opts = {}) {
  const { text, vals } = whereClause(filter)
  let cols = '*'
  let omitPassword = false
  if (opts.select) {
    if (opts.select === '-password') {
      omitPassword = true
    } else {
      const picked = opts.select.split(/\s+/).map((f) => SELECTABLE[f] || COLS[f]).filter(Boolean)
      cols = ['id', ...new Set(picked)].join(', ')
    }
  }
  let sql = `SELECT ${cols} FROM users ${text}`
  if (opts.sort) {
    const [[field, dir]] = Object.entries(opts.sort)
    sql += ` ORDER BY ${COLS[field] || field} ${dir === -1 ? 'DESC' : 'ASC'}`
  }
  const res = await query(sql, vals)
  return res.rows.map((r) => map(r, omitPassword || (cols !== '*' && !cols.includes('password'))))
}

module.exports = { find, findOne, findById, findByIdAndUpdate, create, countDocuments }
