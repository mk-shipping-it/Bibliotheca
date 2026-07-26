function renderNav() {
  const nav = document.getElementById('auth-nav')
  if (!nav) return
  const auth = getAuth()
  if (auth && auth.user) {
    nav.innerHTML = '<span class="nav-user">' + (auth.user.name || auth.user.email || 'Account') + '</span>' +
      (auth.user.role === 'admin' ? ' <a href="admin.html" class="nav-link">Admin</a>' : '') +
      ' <a href="profile.html" class="nav-link">My Reviews</a>' +
      ' <a href="#" class="nav-link" id="logout-btn">Logout</a>'
    document.getElementById('logout-btn')?.addEventListener('click', (e) => { e.preventDefault(); clearAuth(); renderNav() })
  } else {
    nav.innerHTML = '<a href="login.html" class="nav-link">Sign in</a>'
  }
}
renderNav()
