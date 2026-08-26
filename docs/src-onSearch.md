# src/onSearch.js

This file contains the search behavior for the catalog.

## What it does
- Reads the current text entered into the search box.
- Uses the Fuse.js instance to find matches.
- Renders either filtered results or the full list depending on whether a query exists.

## Role in the app
It is the bridge between user input and the visible book list.
