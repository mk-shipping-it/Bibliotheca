# Project documentation

This project is a small book browsing application with a static frontend and an Express/MongoDB backend. The documentation below covers the main modules that power the UI, search flow, authentication, and review/report management.

## Documentation index

- [Frontend overview](frontend.md)
- [Backend overview](backend.md)
- [Server models](server-models.md)
- [Frontend bootstrap](src-init.md)
- [Shared state](src-state.md)
- [Search handler](src-onSearch.md)
- [Card renderer](src-renderBooks.md)
- [Search event wiring](src-searchEventHandlers.md)
- [Fisher-Yates shuffle note](../src/fisher-yattes.md)

## Main areas

- Frontend entry points: the browser loads the HTML pages and the JavaScript modules in the src folder.
- Backend entry point: the server starts Express, mounts the API routes, and connects to MongoDB.
- Data features: browsing books, searching, creating reviews, reporting reviews, and managing admin actions.
