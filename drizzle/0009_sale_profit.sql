ALTER TABLE expenses ADD COLUMN unitId TEXT REFERENCES bikeUnits(id)
 CHECK(unitId IS NULL OR (purchaseId IS NULL AND lotId IS NULL AND saleId IS NULL));
ALTER TABLE expenses ADD COLUMN allocationUnits TEXT NOT NULL DEFAULT '';
CREATE INDEX expense_unit ON expenses(scope,unitId);
