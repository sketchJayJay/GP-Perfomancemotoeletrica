CREATE TABLE adminCredentials (
 id INTEGER PRIMARY KEY CHECK(id=1),
 username TEXT NOT NULL,
 salt TEXT NOT NULL,
 passwordHash TEXT NOT NULL,
 createdAt TEXT NOT NULL
);
CREATE TABLE sessions (
 tokenHash TEXT PRIMARY KEY,
 expiresAt INTEGER NOT NULL,
 createdAt TEXT NOT NULL
);
CREATE TABLE systemMeta (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL
);
