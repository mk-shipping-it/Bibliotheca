# src/state.js

This module defines the shared DOM references and search setup used throughout the frontend.

## What it does
- Gets the card grid element and the search input element.
- Creates a Fuse.js instance to support fuzzy searching by title and author.

## Role in the app
It centralizes the commonly reused state so other modules can work with the same UI references instead of requerying the DOM repeatedly.
