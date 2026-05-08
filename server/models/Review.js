const { query } = require('../config/db')

const COLS = {
  id: 'id', _id: 'id', bookCover: 'book_cover', book_cover: 'book_cover',
  bookTitle: 'book_title', book_title: 'book_title',
  userId: 'user_id', user_id: 'user_id', userName: 'user_name', user_name: 'user_name',
  rating: 'rating', text: 'text',
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
    bookCover: row.book_cover,
    bookTitle: row.book_title,
    userId: row.user_id,
    userName: row.user_name,
    rating: row.rating,
    text: row.text,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  }
  if (row.author_name !== undefined && row.author_name !== null) {
    r.userId = { id: row.user_id, _id: row.user_id, name: row.author_name }
  }
  return r
}

function whereClause(filter, start) {
  const keys = Object.keys(filter)
  if (!keys.length) return { text: '', vals: [] }
  const vals = keys.map((k) => {
    const v = filter[k]
    if (k === '_id' || k === 'id' || k === 'userId' || k === 'user_id') {
      return v === null || v === undefined ? v : Number(v)
    }
    return v
  })
  const text = 'WHERE ' + keys.map((k, i) => `r.${COLS[k] || k} = $${start + i}`).join(' AND ')
  return { text, vals }
}

async function find(filter = {}, opts = {}) {
  const join = opts.populateUser ? 'LEFT JOIN users u ON u.id = r.user_id' : ''
  const extra = opts.populateUser ? ', u.name AS author_name' : ''
  const { text, vals } = whereClause(filter, 1)
  let cols = `r.*${extra}`
  if (opts.select === 'text') cols = `r.id, r.text`
  let sql = `SELECT ${cols} FROM reviews r ${join} ${text}`
  if (opts.sort) {
    const [[field, dir]] = Object.entries(opts.sort)
    sql += ` ORDER BY r.${COLS[field] || field} ${dir === -1 ? 'DESC' : 'ASC'}`
  }
  if (opts.limit) sql += ` LIMIT ${Number(opts.limit)}`
  const res = await query(sql, vals)
  if (opts.select === 'text') {
    return res.rows.map((row) => ({ id: row.id, _id: row.id, text: row.text }))
  }
  return res.rows.map(map)
}

async function findById(id) {
  const res = await query('SELECT * FROM reviews WHERE id = $1 LIMIT 1', [Number(id)])
  if (!res.rows[0]) return null
  const row = res.rows[0]
  return {
    id: row.id,
    _id: row.id,
    bookCover: row.book_cover,
    bookTitle: row.book_title,
    userId: row.user_id,
    userName: row.user_name,
    rating: row.rating,
    text: row.text,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  }
}

async function findByIdAndDelete(id) {
  const res = await query('DELETE FROM reviews WHERE id = $1 RETURNING *', [Number(id)])
  return map(res.rows[0] || null)
}

async function deleteByUserId(userId) {
  await query('DELETE FROM reviews WHERE user_id = $1', [Number(userId)])
}

async function create(data = {}) {
  const params = [data.bookCover, data.bookTitle ?? null, Number(data.userId ?? data.user_id),
    data.userName ?? data.user_name ?? null, data.rating, data.text]
  let sql
  if (data.createdAt) {
    sql = 'INSERT INTO reviews (book_cover, book_title, user_id, user_name, rating, text, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *'
    params.push(data.createdAt)
  } else {
    sql = 'INSERT INTO reviews (book_cover, book_title, user_id, user_name, rating, text) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *'
  }
  const res = await query(sql, params)
  return map(res.rows[0])
}

module.exports = { find, findById, findByIdAndDelete, deleteByUserId, create }
