function renderBooks(list) {
    grid.innerHTML = list.map(b => `
        <div class="card">
            <a href="template.html?cover=${b.cover}&title=${encodeURIComponent(b.title)}&author=${encodeURIComponent(b.author)}" target="_blank" rel="noopener noreferrer">
                <div class="poster image-container">
                    <img class="image-fill" src="${b.coverUrl || ''}" alt="${b.title}" loading="lazy">
                </div>
            </a>
            <h2 class="title">${b.title}</h2>
        </div>
    `).join('')
}
