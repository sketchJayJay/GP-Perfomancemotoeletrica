import type {DatabaseSync} from 'node:sqlite';
import type {Database} from './runtime.ts';

function allocationQuery(e:any){
 if(e.unitId)return {sql:'SELECT id FROM bikeUnits WHERE scope=? AND id=? ORDER BY id',target:e.unitId};
 if(e.saleId)return {sql:'SELECT unitId AS id FROM saleUnits WHERE scope=? AND saleId=? ORDER BY unitId',target:e.saleId};
 if(e.lotId)return {sql:'SELECT id FROM bikeUnits WHERE scope=? AND lotId=? ORDER BY id',target:e.lotId};
 if(e.purchaseId)return {sql:'SELECT u.id FROM bikeUnits u JOIN stockLots l ON l.id=u.lotId AND l.scope=u.scope WHERE u.scope=? AND l.purchaseId=? ORDER BY u.id',target:e.purchaseId};
 return null;
}
export async function allocationForExpense(db:Database,scope:string,e:any){
 const q=allocationQuery(e);if(!q)return '[]';
 const ids=(await db.prepare(q.sql).bind(scope,q.target).all<any>()).results.map(r=>r.id);
 return ids.length?JSON.stringify([...new Set(ids)].sort()):'';
}
export function ensureExpenseAllocations(raw:DatabaseSync){
 const unresolved=raw.prepare("SELECT * FROM expenses WHERE allocationUnits=''").all() as any[];
 raw.exec('BEGIN IMMEDIATE');try{
  for(const e of unresolved){const q=allocationQuery(e),ids=q?(raw.prepare(q.sql).all(e.scope,q.target) as any[]).map(r=>r.id):[];if(ids.length||!q)raw.prepare("UPDATE expenses SET allocationUnits=? WHERE id=? AND scope=? AND allocationUnits=''").run(JSON.stringify([...new Set(ids)].sort()),e.id,e.scope);}
  raw.exec('COMMIT');
 }catch(e){raw.exec('ROLLBACK');throw e;}
}
export async function freezeSaleExpenseAllocations(db:Database,scope:string,unitIds:string[]){
 const pending=(await db.prepare("SELECT * FROM expenses WHERE scope=? AND status='active' AND allocationUnits=''").bind(scope).all<any>()).results,statements=[];
 for(const e of pending){const ids=await allocationForExpense(db,scope,e);if(ids&&JSON.parse(ids).some((id:string)=>unitIds.includes(id)))statements.push(db.prepare("UPDATE expenses SET allocationUnits=? WHERE id=? AND scope=? AND allocationUnits=''").bind(ids,e.id,scope));}
 return statements;
}
