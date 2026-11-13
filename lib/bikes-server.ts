import type {Database,Prepared} from './runtime.ts';
import {LotBook} from './lot-stock.ts';
import {chassisKey} from './bikes-domain.ts';
export async function bikeStatements(db:Database,scope:string,action:string,p:any,id:string,createdAt:string,date:string){
 const statements:Prepared[]=[],stmt=(sql:string,...args:any[])=>db.prepare(sql).bind(...args);
 const insert=(table:string,row:Record<string,any>)=>{const keys=Object.keys(row);statements.push(stmt(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,...Object.values(row)));};
 if(action==='stockLot'){
  const found=p.id?await stmt('SELECT * FROM stockLots WHERE scope=? AND id=?',scope,p.id).first<any>():null;
  if(p.id&&(!found||found.revision!==p.revision))throw Error('Este lote foi alterado. Atualize a página.');
  const duplicate=await stmt('SELECT id FROM stockLots WHERE scope=? AND code=? COLLATE NOCASE AND id!=?',scope,p.code,p.id||'').first();if(duplicate)throw Error('Já existe um lote com esse número.');
  const purchase=await stmt("SELECT id FROM purchases WHERE scope=? AND lotCode=? COLLATE NOCASE AND status!='cancelled' AND id!=?",scope,p.code,found?.purchaseId||'').first();if(purchase)throw Error('Este número pertence a uma compra. Receba essa compra para abrir o lote no estoque.');
  const fields={code:p.code,supplier:p.supplier,carrier:p.carrier,receivedDate:p.receivedDate,notes:p.notes};
  if(found){const keys=Object.keys(fields);statements.push(stmt(`UPDATE stockLots SET ${keys.map(k=>k+'=?').join(',')},revision=CASE WHEN revision=? THEN revision+1 ELSE NULL END WHERE id=? AND scope=?`,...Object.values(fields),p.revision,p.id,scope));if(found.purchaseId)statements.push(stmt('UPDATE purchases SET lotCode=?,revision=revision+1 WHERE id=? AND scope=?',p.code,found.purchaseId,scope));}
  else insert('stockLots',{...fields,id,scope,createdAt});
  return statements;
 }
 const found=p.id?await stmt('SELECT * FROM bikeUnits WHERE scope=? AND id=?',scope,p.id).first<any>():null;
 if(p.id&&(!found||found.revision!==p.revision))throw Error('Esta moto foi alterada. Atualize a página.');
 const lot=await stmt('SELECT id FROM stockLots WHERE scope=? AND id=?',scope,p.lotId).first();if(!lot)throw Error('Lote não encontrado.');
 const key=chassisKey(p.chassis);
 if(key&&await stmt('SELECT id FROM bikeUnits WHERE scope=? AND chassisKey=? AND id!=?',scope,key,p.id||'').first())throw Error('Já existe uma moto com esse chassi. Confira o cadastro existente.');
 let modelId=found?.modelId||p.modelId;
 if(found&&p.modelId!==found.modelId)throw Error('O modelo de uma moto cadastrada deve ser mantido.');
 if(!modelId){modelId=crypto.randomUUID();insert('models',{id:modelId,scope,name:p.newModel.name,color:p.newModel.color,brand:p.newModel.brand,image:p.image,price:p.price,minStock:0,createdAt});}
 else if(!await stmt('SELECT id FROM models WHERE scope=? AND id=?',scope,modelId).first())throw Error('Modelo não encontrado.');
 const book=new LotBook(db,scope,createdAt);
 if(found){
  if(found.status==='out')throw Error('Esta moto já teve saída do estoque. Consulte o histórico.');
  if(found.status==='sold'&&(p.lotId!==found.lotId||p.condition!==found.condition||p.price!==found.price||p.image!==found.image||p.odometer!==found.odometer||p.year!==found.year||p.date!==found.receivedDate||(found.chassis&&p.chassis!==found.chassis)||(found.unitCost!==null&&p.unitCost!==found.unitCost)))throw Error('Moto vendida: só é possível completar chassi ou custo que estavam pendentes, sem alterar dados já registrados.');
  const fields={lotId:p.lotId,chassis:p.chassis,chassisKey:key,condition:p.condition,price:p.price,unitCost:p.unitCost,image:p.image,odometer:p.odometer,year:p.year,receivedDate:p.date,notes:p.notes};
  if(found.lotId!==p.lotId){book.balance(p.lotId,modelId);statements.push(...book.statements);book.statements=[];}
  const keys=Object.keys(fields);statements.push(stmt(`UPDATE bikeUnits SET ${keys.map(k=>k+'=?').join(',')},revision=CASE WHEN revision=? AND status=? THEN revision+1 ELSE NULL END WHERE id=? AND scope=?`,...Object.values(fields),p.revision,found.status,p.id,scope));
  if(found.lotId!==p.lotId){for(const [lotId,delta] of [[found.lotId,-1],[p.lotId,1]])insert('movements',{id:crypto.randomUUID(),scope,modelId,lotId,unitId:found.id,delta,kind:'reclassificacao',unitCost:p.unitCost??0,reference:'Alteração do lote da moto',notes:p.chassis,date:date||new Date().toISOString().slice(0,10),createdAt});}
  book.sync(modelId);statements.push(...book.statements);
  if(found.unitCost===null&&p.unitCost!==null){statements.push(stmt('UPDATE saleUnits SET unitCost=? WHERE unitId=? AND scope=? AND unitCost IS NULL',p.unitCost,found.id,scope));statements.push(stmt('UPDATE sales SET cost=(SELECT COALESCE(SUM(unitCost),0) FROM saleUnits WHERE saleId=sales.id AND scope=sales.scope),costKnown=CASE WHEN EXISTS(SELECT 1 FROM saleUnits WHERE saleId=sales.id AND scope=sales.scope AND unitCost IS NULL) THEN 0 ELSE 1 END,revision=revision+1 WHERE scope=? AND id IN (SELECT saleId FROM saleUnits WHERE unitId=? AND scope=?)',scope,found.id,scope));}
  if(!found.chassis&&p.chassis){statements.push(stmt("UPDATE saleUnits SET chassis=? WHERE unitId=? AND scope=? AND chassis=''",p.chassis,found.id,scope));statements.push(stmt("UPDATE sales SET chassis=?,revision=revision+1 WHERE scope=? AND quantity=1 AND chassis='' AND id IN (SELECT saleId FROM saleUnits WHERE unitId=? AND scope=?)",p.chassis,scope,found.id,scope));}
 }else{
  await book.add(p.lotId,modelId,1,p.unitCost,[{id,chassis:p.chassis,condition:p.condition,price:p.price,image:p.image,odometer:p.odometer,year:p.year,receivedDate:p.date,notes:p.notes}]);book.sync(modelId);statements.push(...book.statements);
  insert('movements',{id:crypto.randomUUID(),scope,modelId,lotId:p.lotId,unitId:id,delta:1,kind:'entrada',unitCost:p.unitCost??0,reference:'Moto adicionada ao lote',notes:p.chassis||'Chassi a informar',date:date||new Date().toISOString().slice(0,10),createdAt});
  if(p.registerPayment&&p.unitCost>0)insert('ledger',{id:crypto.randomUUID(),scope,type:'out',amount:p.unitCost,description:'Compra da moto · '+(p.chassis||'chassi pendente'),category:'Fornecedor',payment:p.payment,date:date||new Date().toISOString().slice(0,10),createdAt});
 }
 return statements;
}
