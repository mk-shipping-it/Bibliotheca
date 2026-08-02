const defaults = ['bestsellers 2024', 'classic novels', 'mystery bestseller', 'sci-fi fantasy 2024'];
const dq = defaults[Math.floor(Math.random() * defaults.length)];
fetch('/api/books?search=' + encodeURIComponent(dq) + '&limit=40').then(r=>r.json()).then(d=>renderBooks(d.books||[])).catch(()=>{grid.innerHTML='<p style="color:#999;padding:40px;text-align:center">Type to search Google Books...</p>'})
