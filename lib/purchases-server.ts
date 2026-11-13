import {LotBook} from './lot-stock.ts';
import {Database,Prepared} from './runtime.ts';
import {landedCosts} from './purchases-domain.ts';
export async function purchaseStatements(db:Database,scope:string,action:string,p:any,id:string,createdAt:string,date:string){
 const statements:Prepared[]=[],stmt=(sql:string,...values:any[])=>db.prepare(sql).bind(...values);
 const insert=(table:string,row:Record<string,any>)=>{const keys=Object.keys(row);statements.push(stmt(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,...Object.values(row)));};
 const order=p.id?await stmt('SELECT * FROM purchases WHERE id=? AND scope=?',p.id,scope).first<any>():null;
 if(p.id&&(!order||order.status==='received'||order.status==='cancelled'||order.revision!==p.revision))throw Error('Esta compra foi alterada ou encerrada. Atualize a página.');
 if(action==='purchase'){
  if(p.lotCode){const used=await stmt('SELECT id FROM stockLots WHERE scope=? AND code=? COLLATE NOCASE',scope,p.lotCode).first();if(used)throw Error('Este número de lote já foi recebido no estoque. Use outro número para a nova compra.');}

  for(const item of p.items){const model=await stmt('SELECT id FROM models WHERE id=? AND scope=? AND archived=0',item.modelId,scope).first();if(!model)throw Error('Selecione modelos ativos para todos os itens.');}
  const {items,id:existing,revision,...fields}=p,total=items.reduce((n:number,i:any)=>n+i.quantity*i.unitCost,0)+p.freight,purchaseId=existing||id;
  if(order){
   const keys=Object.keys(fields);
   statements.push(stmt(`UPDATE purchases SET ${keys.map(k=>k+'=?').join(',')},total=?,revision=CASE WHEN revision=? AND status NOT IN ('received','cancelled') THEN revision+1 ELSE NULL END WHERE id=? AND scope=?`,...Object.values(fields),total,p.revision,p.id,scope));
   statements.push(stmt('DELETE FROM purchaseItems WHERE purchaseId=? AND scope=?',p.id,scope));
  }else insert('purchases',{...fields,id:purchaseId,scope,total,number:'CP-'+date.replaceAll('-','').slice(2)+'-'+id.slice(0,5).toUpperCase(),createdAt});
  for(const item of items)insert('purchaseItems',{...item,id:crypto.randomUUID(),purchaseId,scope,createdAt});
 }else if(action==='cancelPurchase'){
  statements.push(stmt("UPDATE purchases SET status='cancelled',revision=CASE WHEN revision=? AND status NOT IN ('received','cancelled') THEN revision+1 ELSE NULL END WHERE id=? AND scope=?",p.revision,p.id,scope));
 }else{
  const items=(await stmt('SELECT * FROM purchaseItems WHERE purchaseId=? AND scope=? ORDER BY id',p.id,scope).all<any>()).results;
  if(!items.length)throw Error('A compra não tem modelos para receber.');
  const costs=landedCosts(items,order.freight);
  statements.push(stmt("UPDATE purchases SET status='received',receivedDate=?,revision=CASE WHEN revision=? AND status NOT IN ('received','cancelled') THEN revision+1 ELSE NULL END WHERE id=? AND scope=?",date,p.revision,p.id,scope));
  const book=new LotBook(db,scope,createdAt),lotId=await book.lot(order.lotCode||order.number,{purchaseId:order.id,supplier:order.supplier,receivedDate:date});
  const moves:any[]=[];
  for(const [index,item] of items.entries()){
   if(!await stmt('SELECT id FROM models WHERE id=? AND scope=?',item.modelId,scope).first())throw Error('Modelo do lote não encontrado.');
   await book.add(lotId,item.modelId,item.quantity,costs[index].unitCost);book.sync(item.modelId);
   moves.push({id:crypto.randomUUID(),scope,lotId,modelId:item.modelId,delta:item.quantity,kind:'entrada',unitCost:costs[index].unitCost,reference:order.number,notes:'Recebimento do lote · '+order.supplier,date,createdAt});
  }
  statements.push(...book.statements);for(const row of moves)insert('movements',row);
  if(p.registerPayment&&order.total>0)insert('ledger',{id:crypto.randomUUID(),scope,type:'out',amount:order.total,description:'Compra '+order.number+' · '+order.supplier,category:'Fornecedor',payment:p.payment,date,createdAt});
 }
 return statements;
}
