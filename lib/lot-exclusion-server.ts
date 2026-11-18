import type {Database,Prepared} from './runtime.ts';
import {LotBook} from './lot-stock.ts';
export async function lotExclusionStatements(db:Database,scope:string,action:string,p:any,createdAt:string,date:string){
 const statements:Prepared[]=[],stmt=(sql:string,...values:any[])=>db.prepare(sql).bind(...values);
 const lot=await stmt('SELECT * FROM stockLots WHERE scope=? AND id=?',scope,p.id).first<any>();
 if(!lot||lot.revision!==p.revision)throw Error('Este lote ou seu estoque foi alterado. Atualize a página e confira novamente.');
 const removing=action==='deleteLot';
 if(removing&&lot.deletedAt)throw Error('Este lote já foi excluído.');
 if(!removing&&!lot.deletedAt)throw Error('Este lote já está ativo.');
 const activeSales="EXISTS(SELECT 1 FROM saleLots r JOIN sales s ON s.id=r.saleId AND s.scope=r.scope WHERE r.lotId=stockLots.id AND r.scope=stockLots.scope AND s.status='active') OR EXISTS(SELECT 1 FROM bikeUnits u WHERE u.lotId=stockLots.id AND u.scope=stockLots.scope AND u.status='sold')";
 if(removing){const active=await stmt("SELECT id FROM stockLots WHERE id=? AND scope=? AND ("+activeSales+")",p.id,scope).first();if(active)throw Error('Este lote tem venda ativa. Resolva a venda antes de excluir o lote.');}
 const units=(await stmt("SELECT * FROM bikeUnits WHERE scope=? AND lotId=? AND "+(removing?"status='available'":"status='out' AND excludedWithLot=1"),scope,p.id).all<any>()).results;
 if(removing){
  statements.push(stmt("UPDATE stockLots SET deletedAt=?,revision=CASE WHEN revision=? AND deletedAt='' AND NOT ("+activeSales+") THEN revision+1 ELSE NULL END WHERE id=? AND scope=?",createdAt,p.revision,p.id,scope));
  statements.push(stmt("UPDATE bikeUnits SET status='out',excludedWithLot=1,revision=revision+1 WHERE scope=? AND lotId=? AND status='available'",scope,p.id));
 }else{
  statements.push(stmt("UPDATE stockLots SET deletedAt='',revision=CASE WHEN revision=? AND deletedAt!='' THEN revision+1 ELSE NULL END WHERE id=? AND scope=?",p.revision,p.id,scope));
  statements.push(stmt("UPDATE bikeUnits SET status='available',excludedWithLot=0,revision=revision+1 WHERE scope=? AND lotId=? AND status='out' AND excludedWithLot=1",scope,p.id));
 }
 for(const u of units)statements.push(stmt('INSERT INTO movements(id,scope,modelId,lotId,unitId,delta,kind,unitCost,reference,notes,date,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),scope,u.modelId,p.id,u.id,removing?-1:1,removing?'exclusao_lote':'restauracao_lote',u.unitCost??0,lot.code,(removing?'Retirada pela exclusão do lote. ':'Retorno pela restauração do lote. ')+(u.chassis||'Chassi a informar'),date,createdAt));
 const book=new LotBook(db,scope,createdAt);for(const modelId of new Set<string>(units.map(u=>u.modelId)))book.sync(modelId);statements.push(...book.statements);
 return statements;
}
