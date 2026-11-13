import type {DatabaseSync} from 'node:sqlite';
export function ensureLegacyStockLots(raw:DatabaseSync){
 const models=raw.prepare('SELECT * FROM models WHERE stock>0').all() as any[];
 raw.exec('BEGIN IMMEDIATE');
 try{
  for(const model of models){
   const tracked=(raw.prepare('SELECT COALESCE(SUM(quantity),0) AS n FROM stockLotBalances WHERE scope=? AND modelId=?').get(model.scope,model.id) as any).n;
   if(tracked>model.stock)throw Error('Saldo dos lotes divergente do estoque: '+model.name);
   const missing=model.stock-tracked;if(!missing)continue;
   let lot=raw.prepare("SELECT id FROM stockLots WHERE scope=? AND code='ESTOQUE ANTERIOR'").get(model.scope) as any;
   const now=new Date().toISOString();
   if(!lot){lot={id:crypto.randomUUID()};raw.prepare("INSERT INTO stockLots(id,scope,code,notes,createdAt) VALUES (?,?,'ESTOQUE ANTERIOR','Saldo anterior à identificação dos lotes. Origem de compra não informada.',?)").run(lot.id,model.scope,now);}
   raw.prepare('INSERT INTO stockLotBalances(id,scope,lotId,modelId,quantity,unitCost,createdAt) VALUES (?,?,?,?,?,?,?) ON CONFLICT(lotId,modelId) DO UPDATE SET unitCost=ROUND((quantity*unitCost+excluded.quantity*excluded.unitCost)/(quantity+excluded.quantity)),quantity=quantity+excluded.quantity,revision=revision+1').run(crypto.randomUUID(),model.scope,lot.id,model.id,missing,model.cost,now);
  }
  raw.exec('COMMIT');
 }catch(e){raw.exec('ROLLBACK');throw e;}
}
