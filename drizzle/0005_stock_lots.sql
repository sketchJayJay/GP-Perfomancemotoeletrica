CREATE TABLE stockLots (
 id TEXT PRIMARY KEY NOT NULL,
 scope TEXT NOT NULL,
 code TEXT NOT NULL,
 purchaseId TEXT REFERENCES purchases(id),
 supplier TEXT NOT NULL DEFAULT '',
 receivedDate TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 createdAt TEXT NOT NULL
);
CREATE UNIQUE INDEX lot_code ON stockLots(scope,code COLLATE NOCASE);
CREATE UNIQUE INDEX lot_purchase ON stockLots(purchaseId) WHERE purchaseId IS NOT NULL;
CREATE TABLE stockLotBalances (
 id TEXT PRIMARY KEY NOT NULL,
 scope TEXT NOT NULL,
 lotId TEXT NOT NULL REFERENCES stockLots(id),
 modelId TEXT NOT NULL REFERENCES models(id),
 quantity INTEGER NOT NULL CHECK(quantity>=0),
 unitCost INTEGER NOT NULL CHECK(unitCost>=0),
 revision INTEGER NOT NULL DEFAULT 0,
 createdAt TEXT NOT NULL,
 UNIQUE(lotId,modelId)
);
CREATE INDEX balance_scope ON stockLotBalances(scope,modelId);
CREATE TABLE saleLots (
 id TEXT PRIMARY KEY NOT NULL,
 scope TEXT NOT NULL,
 saleId TEXT NOT NULL REFERENCES sales(id),
 lotId TEXT NOT NULL REFERENCES stockLots(id),
 modelId TEXT NOT NULL REFERENCES models(id),
 quantity INTEGER NOT NULL CHECK(quantity>0),
 unitCost INTEGER NOT NULL CHECK(unitCost>=0),
 createdAt TEXT NOT NULL
);
CREATE INDEX sale_lot_scope ON saleLots(scope,saleId,lotId);
ALTER TABLE purchases ADD COLUMN lotCode TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX purchase_lot_code ON purchases(scope,lotCode COLLATE NOCASE) WHERE lotCode!='' AND status!='cancelled';
ALTER TABLE movements ADD COLUMN lotId TEXT REFERENCES stockLots(id);
