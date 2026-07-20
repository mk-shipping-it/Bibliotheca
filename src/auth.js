const AUTH_KEY = 'bibliotheca_auth'

function getAuth() {
  const raw = localStorage.getItem(AUTH_KEY)
  return raw ? JSON.parse(raw) : null
}

function setAuth(data) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(data))
}

function clearAuth() {
  localStorage.removeItem(AUTH_KEY)
}

function apiURL(path) {
  return '/api' + path
}

async function apiFetch(path, opts = {}) {
  const auth = getAuth()
  const headers = { 'Content-Type': 'application/json', ...opts.headers }
  if (auth) headers['Authorization'] = 'Bearer ' + auth.token
  const res = await fetch(apiURL(path), { ...opts, headers })
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Request failed') }
  return res.json()
}
