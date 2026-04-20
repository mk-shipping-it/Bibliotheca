const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/bibliotheca'

const pool = new Pool({
  connectionString,
  ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false }
})

async function query(text, params) {
  return pool.query(text, params)
}

const connectDB = async () => {
  try {
    const schemaPath = path.join(__dirname, '..', 'schema.sql')
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8')
      await pool.query(schema)
    } else {
      await pool.query('SELECT 1')
    }
    console.log('PostgreSQL connected')
    return pool
  } catch (err) {
    console.error('PostgreSQL connection error:', err.message)
    process.exit(1)
  }
}

module.exports = { pool, query, connectDB }
