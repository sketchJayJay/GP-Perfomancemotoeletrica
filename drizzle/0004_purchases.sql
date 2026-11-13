CREATE TABLE purchases (
 id TEXT PRIMARY KEY NOT NULL,
 scope TEXT NOT NULL,
 number TEXT NOT NULL,
 date TEXT NOT NULL,
 supplier TEXT NOT NULL,
 buyer TEXT NOT NULL DEFAULT '',
 carrier TEXT NOT NULL DEFAULT '',
 expectedDate TEXT NOT NULL DEFAULT '',
 freight INTEGER NOT NULL DEFAULT 0 CHECK(freight>=0),
 total INTEGER NOT NULL CHECK(total>=0),
 status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','purchased','in_transit','received','cancelled')),
 notes TEXT NOT NULL DEFAULT '',
 receivedDate TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 0,
 createdAt TEXT NOT NULL
);
CREATE INDEX purchase_scope ON purchases(scope);
CREATE TABLE purchaseItems (
 id TEXT PRIMARY KEY NOT NULL,
 scope TEXT NOT NULL,
 purchaseId TEXT NOT NULL REFERENCES purchases(id),
 modelId TEXT NOT NULL REFERENCES models(id),
 quantity INTEGER NOT NULL CHECK(quantity>0),
 unitCost INTEGER NOT NULL CHECK(unitCost>=0),
 createdAt TEXT NOT NULL,
 UNIQUE(purchaseId,modelId)
);
CREATE INDEX purchase_item_scope ON purchaseItems(scope,purchaseId);
