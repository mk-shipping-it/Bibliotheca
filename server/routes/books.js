const express = require('express')
const axios = require('axios')

const router = express.Router()

function mapVolume(item) {
  const info = item.volumeInfo || {}
  const thumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || ''
  return {
    cover: item.id,
    title: info.title || 'Untitled',
    author: (info.authors || ['Unknown'])[0],
    year: parseInt(info.publishedDate) || null,
    description: info.description || null,
    coverUrl: thumb.replace('http://', 'https://'),
    googleId: item.id
  }
}

router.get('/', async (req, res) => {
  try {
    const search = (req.query.search || '').trim()
    const page = Math.max(1, parseInt(req.query.page) || 1)
    let limit = parseInt(req.query.limit) || 20
    limit = Math.min(Math.max(1, limit), 40)
    const startIndex = (page - 1) * limit

    if (!search) {
      return res.json({ books: [], page: 1, limit, hasMore: false, total: 0 })
    }

    try {
      const params = { q: search, startIndex, maxResults: limit }
      if (process.env.GOOGLE_BOOKS_API_KEY) params.key = process.env.GOOGLE_BOOKS_API_KEY
      const { data } = await axios.get('https://www.googleapis.com/books/v1/volumes', {
        params,
        timeout: 15000
      })
      const items = data.items || []
      const total = data.totalItems || 0
      const books = items.map(mapVolume)
      const hasMore = (startIndex + items.length) < total
      return res.json({ books, page, limit, hasMore, total })
    } catch (e) {
      const status = e.response && e.response.status ? e.response.status : 502
      return res.status(status === 404 ? 404 : 502).json({ error: 'Book search unavailable' })
    }
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/by-cover/:cover', async (req, res) => {
  try {
    const cover = req.params.cover
    try {
      const params = {}
      if (process.env.GOOGLE_BOOKS_API_KEY) params.key = process.env.GOOGLE_BOOKS_API_KEY
      const { data } = await axios.get(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(cover)}`, {
        params,
        timeout: 15000
      })
      return res.json(mapVolume(data))
    } catch (e) {
      if (e.response && e.response.status === 404) {
        return res.status(404).json({ error: 'Not found' })
      }
      return res.status(502).json({ error: 'Book lookup unavailable' })
    }
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
