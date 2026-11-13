CREATE TABLE expenses (
 id TEXT PRIMARY KEY NOT NULL,
 scope TEXT NOT NULL,
 description TEXT NOT NULL,
 category TEXT NOT NULL,
 payee TEXT NOT NULL DEFAULT '',
 purchaseId TEXT REFERENCES purchases(id),
 lotId TEXT REFERENCES stockLots(id),
 saleId TEXT REFERENCES sales(id),
 quantity INTEGER NOT NULL CHECK(quantity>0),
 unitAmount INTEGER NOT NULL CHECK(unitAmount>0),
 amount INTEGER NOT NULL CHECK(amount>0 AND amount=quantity*unitAmount),
 paid INTEGER NOT NULL DEFAULT 0 CHECK(paid>=0 AND paid<=amount),
 date TEXT NOT NULL,
 dueDate TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled')),
 revision INTEGER NOT NULL DEFAULT 0,
 createdAt TEXT NOT NULL,
 CHECK((purchaseId IS NOT NULL)+(lotId IS NOT NULL)+(saleId IS NOT NULL)<=1),
 CHECK(status!='cancelled' OR paid=0)
);
CREATE INDEX expense_scope_due ON expenses(scope,status,dueDate);
CREATE INDEX expense_purchase ON expenses(scope,purchaseId);
CREATE INDEX expense_lot ON expenses(scope,lotId);
CREATE INDEX expense_sale ON expenses(scope,saleId);
ALTER TABLE ledger ADD COLUMN expenseId TEXT REFERENCES expenses(id);
CREATE INDEX ledger_expense ON ledger(scope,expenseId);
