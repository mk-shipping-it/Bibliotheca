let fuse
async function onSearch() {
    const q = searchInput.value.trim()
    if (!q) { grid.innerHTML = '<p style="color:#999;padding:40px;text-align:center">Type to search Google Books...</p>'; return }
    if (q.length < 2) return
    grid.innerHTML = '<p style="color:#999;padding:40px;text-align:center">Searching...</p>'
    try {
        const res = await fetch('/api/books?search=' + encodeURIComponent(q))
        const data = await res.json()
        let books = data.books || []
        if (books.length > 0) {
            fuse = new Fuse(books, { keys: ['title', 'author'], threshold: 0.4 })
            books = fuse.search(q).map(r => r.item)
        }
        renderBooks(books)
        if (books.length === 0) grid.innerHTML = '<p style="color:#999;padding:40px;text-align:center">No books found.</p>'
    } catch { grid.innerHTML = '<p style="color:#c00;padding:40px;text-align:center">Search failed.</p>' }
}