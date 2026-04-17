CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT,
  password TEXT,
  google_id TEXT UNIQUE,
  name TEXT,
  role TEXT DEFAULT 'user',
  is_banned BOOLEAN DEFAULT false,
  banned_reason TEXT,
  banned_at TIMESTAMPTZ,
  bot_score INTEGER DEFAULT 0,
  last_review_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS books (
  id SERIAL PRIMARY KEY,
  cover TEXT UNIQUE,
  title TEXT NOT NULL,
  author TEXT,
  year INTEGER
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  book_cover TEXT,
  book_title TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  review_id INTEGER REFERENCES reviews(id) ON DELETE SET NULL,
  review_text TEXT,
  book_cover TEXT,
  reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  is_auto BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_reviews_book_cover ON reviews(book_cover);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
