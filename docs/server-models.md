# Server models

The server uses Mongoose models to persist the core application data.

## User model
- Stores the user identity, email, password hash, role, and Google OAuth id.
- Supports both local authentication and Google sign-in.

## Book model
- Represents a catalog entry with the title, author, and cover identifier.
- Used by the public book search endpoints.

## Review model
- Stores reviews associated with a specific book cover.
- Links each review back to the user who wrote it.

## Report model
- Tracks review reports for moderation.
- Keeps the report reason, status, and reporter information.
