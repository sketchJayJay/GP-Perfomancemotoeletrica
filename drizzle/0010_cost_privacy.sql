CREATE TABLE costProtection (
 scope TEXT PRIMARY KEY NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 salt TEXT NOT NULL,
 passwordHash TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0,
 updatedAt TEXT NOT NULL
);
CREATE TABLE costGrants (
 tokenHash TEXT PRIMARY KEY NOT NULL,
 sessionHash TEXT NOT NULL REFERENCES sessions(tokenHash) ON DELETE CASCADE,
 scope TEXT NOT NULL REFERENCES costProtection(scope),
 expiresAt INTEGER NOT NULL,
 createdAt TEXT NOT NULL
);
CREATE INDEX cost_grant_expiry ON costGrants(expiresAt);
CREATE TABLE costFailures (
 scope TEXT PRIMARY KEY NOT NULL,
 attempts INTEGER NOT NULL,
 windowStart INTEGER NOT NULL,
 blockedUntil INTEGER NOT NULL DEFAULT 0
);
