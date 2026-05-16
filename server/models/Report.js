const { query } = require('../config/db')

const COLS = {
  id: 'id', _id: 'id', reviewId: 'review_id', review_id: 'review_id',
  reviewText: 'review_text', review_text: 'review_text',
  bookCover: 'book_cover', book_cover: 'book_cover',
  reportedBy: 'reported_by', reported_by: 'reported_by',
  reason: 'reason', status: 'status', isAuto: 'is_auto', is_auto: 'is_auto',
  createdAt: 'created_at', created_at: 'created_at',
  updatedAt: 'updated_at', updated_at: 'updated_at'
}

function iso(v) {
  if (v === null || v === undefined) return v
  return v instanceof Date ? v.toISOString() : v
}

function map(row) {
  if (!row) return null
  const r = {
    id: row.id,
    _id: row.id,
    reviewId: row.review_id,
    reviewText: row.review_text,
    bookCover: row.book_cover,
    reportedBy: row.reported_by,
    reason: row.reason,
    status: row.status,
    isAuto: row.is_auto,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  }
  if (row.reporter_name !== undefined && row.reporter_name !== null) {
    r.reportedBy = { id: row.reported_by, _id: row.reported_by, name: row.reporter_name }
  }
  return r
}

function whereClause(filter, alias) {
  const keys = Object.keys(filter)
  if (!keys.length) return { text: '', vals: [] }
  const vals = keys.map((k) => {
    const v = filter[k]
    if (k === '_id' || k === 'id' || k === 'reviewId' || k === 'review_id' || k === 'reportedBy' || k === 'reported_by') {
      return v === null || v === undefined ? v : Number(v)
    }
    return v
  })
  const text = 'WHERE ' + keys.map((k, i) => `${alias}.${COLS[k] || k} = $${i + 1}`).join(' AND ')
  return { text, vals }
}

async function find(filter = {}, opts = {}) {
  const join = opts.populateReporter ? 'LEFT JOIN users u ON u.id = r.reported_by' : ''
  const extra = opts.populateReporter ? ', u.name AS reporter_name' : ''
  const { text, vals } = whereClause(filter, 'r')
  let sql = `SELECT r.*${extra} FROM reports r ${join} ${text}`
  if (opts.sort) {
    const [[field, dir]] = Object.entries(opts.sort)
    sql += ` ORDER BY r.${COLS[field] || field} ${dir === -1 ? 'DESC' : 'ASC'}`
  }
  const res = await query(sql, vals)
  return res.rows.map(map)
}

async function findOne(filter = {}) {
  const { text, vals } = whereClause(filter, 'r')
  const res = await query(`SELECT r.* FROM reports r ${text} LIMIT 1`, vals)
  return map(res.rows[0] || null)
}

async function findByIdAndUpdate(id, update = {}, opts = {}) {
  const sets = []
  const vals = []
  const flat = { ...(update.$set || {}) }
  for (const [k, v] of Object.entries(update)) {
    if (k === '$inc' || k === '$set') continue
    flat[k] = v
  }
  for (const [k, v] of Object.entries(flat)) {
    vals.push(v === undefined ? null : v)
    sets.push(`${COLS[k] || k} = $${vals.length}`)
  }
  if (!sets.length) {
    const res = await query('SELECT * FROM reports WHERE id = $1 LIMIT 1', [Number(id)])
    return map(res.rows[0] || null)
  }
  vals.push(Number(id))
  const res = await query(
    `UPDATE reports SET ${sets.join(', ')}, updated_at=now() WHERE id = $${vals.length} RETURNING *`,
    vals
  )
  return map(res.rows[0] || null)
}

async function create(data = {}) {
  const params = [
    data.reviewId ?? data.review_id ?? null,
    data.reviewText ?? data.review_text ?? null,
    data.bookCover ?? data.book_cover ?? null,
    data.reportedBy ?? data.reported_by ?? null,
    data.reason,
    data.status || 'pending',
    !!(data.isAuto ?? data.is_auto)
  ]
  let sql
  if (data.createdAt) {
    params.push(data.createdAt)
    sql = 'INSERT INTO reports (review_id, review_text, book_cover, reported_by, reason, status, is_auto, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *'
  } else {
    sql = 'INSERT INTO reports (review_id, review_text, book_cover, reported_by, reason, status, is_auto) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *'
  }
  const res = await query(sql, params)
  return map(res.rows[0])
}

async function countDocuments(filter = {}) {
  const { text, vals } = whereClause(filter, 'r')
  const res = await query(`SELECT COUNT(*)::int AS n FROM reports r ${text}`, vals)
  return res.rows[0].n
}

module.exports = { find, findOne, findByIdAndUpdate, create, countDocuments }
