ALTER TABLE stockLots ADD COLUMN deletedAt TEXT NOT NULL DEFAULT '';
ALTER TABLE bikeUnits ADD COLUMN excludedWithLot INTEGER NOT NULL DEFAULT 0 CHECK(excludedWithLot IN (0,1));
CREATE INDEX excluded_lot_units ON bikeUnits(scope,lotId,excludedWithLot);
