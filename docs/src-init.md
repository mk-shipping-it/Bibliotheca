# src/init.js

This file is the frontend bootstrap for the application.

## What it does
- Imports the book data already available in the browser context.
- Uses the Fisher-Yates shuffle helper to randomize the book list.
- Calls renderBooks() so the catalog appears immediately when the page loads.

## Role in the app
It is the first script that runs after the page is ready and gives the catalog its initial presentation.
