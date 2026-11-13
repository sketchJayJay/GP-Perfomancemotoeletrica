ALTER TABLE stockLots ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stockLots ADD COLUMN carrier TEXT NOT NULL DEFAULT '';
ALTER TABLE sales ADD COLUMN costKnown INTEGER NOT NULL DEFAULT 1;
CREATE TABLE bikeUnits (
 id TEXT PRIMARY KEY NOT NULL,
 scope TEXT NOT NULL,
 modelId TEXT NOT NULL REFERENCES models(id),
 lotId TEXT NOT NULL REFERENCES stockLots(id),
 chassis TEXT NOT NULL DEFAULT '',
 chassisKey TEXT NOT NULL DEFAULT '',
 condition TEXT NOT NULL DEFAULT 'unknown' CHECK(condition IN ('new','used','unknown')),
 status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','sold','out')),
 price INTEGER NOT NULL CHECK(price>=0),
 unitCost INTEGER CHECK(unitCost IS NULL OR unitCost>=0),
 image TEXT NOT NULL DEFAULT '',
 odometer INTEGER CHECK(odometer IS NULL OR odometer>=0),
 year INTEGER CHECK(year IS NULL OR year BETWEEN 1900 AND 2100),
 receivedDate TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 sourceKey TEXT,
 revision INTEGER NOT NULL DEFAULT 0,
 createdAt TEXT NOT NULL
);
CREATE UNIQUE INDEX bike_chassis ON bikeUnits(scope,chassisKey) WHERE chassisKey!='';
CREATE UNIQUE INDEX bike_source ON bikeUnits(scope,sourceKey) WHERE sourceKey IS NOT NULL;
CREATE INDEX bike_stock ON bikeUnits(scope,modelId,lotId,status);
CREATE TABLE saleUnits (
 id TEXT PRIMARY KEY NOT NULL,
 scope TEXT NOT NULL,
 saleId TEXT NOT NULL REFERENCES sales(id),
 unitId TEXT NOT NULL REFERENCES bikeUnits(id),
 modelId TEXT NOT NULL REFERENCES models(id),
 lotId TEXT NOT NULL REFERENCES stockLots(id),
 chassis TEXT NOT NULL DEFAULT '',
 condition TEXT NOT NULL,
 unitCost INTEGER,
 createdAt TEXT NOT NULL,
 UNIQUE(saleId,unitId)
);
CREATE INDEX sale_unit_history ON saleUnits(scope,unitId,saleId);
ALTER TABLE movements ADD COLUMN unitId TEXT REFERENCES bikeUnits(id);
CREATE TABLE dataImports (
 id TEXT NOT NULL,
 scope TEXT NOT NULL,
 result TEXT NOT NULL,
 createdAt TEXT NOT NULL,
 PRIMARY KEY(id,scope)
);
