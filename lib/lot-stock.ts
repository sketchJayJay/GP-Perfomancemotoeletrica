import type {Database,Prepared} from './runtime.ts';
export type Allocation={lotId:string;quantity:number;unitCost:number};
export class LotBook {
 statements:Prepared[]=[];
 constructor(private db:Database,private scope:string,private createdAt:string){}
 private stmt(sql:string,...values:any[]){return this.db.prepare(sql).bind(...values);}
 private append(sql:string,...values:any[]){this.statements.push(this.stmt(sql,...values));}
 async lot(code:string,fields:{purchaseId?:string;supplier?:string;receivedDate?:string;notes?:string}={}){
  code=code.trim().toUpperCase();if(!code)throw Error('Informe o número do lote.');
  let lot=await this.stmt('SELECT * FROM stockLots WHERE scope=? AND code=? COLLATE NOCASE',this.scope,code).first<any>();
  if(lot){if(fields.purchaseId&&lot.purchaseId!==fields.purchaseId)throw Error('Este número de lote já está em uso. Escolha outro número.');return lot.id as string;}
  const id=crypto.randomUUID();this.append('INSERT INTO stockLots (id,scope,code,purchaseId,supplier,receivedDate,notes,createdAt) VALUES (?,?,?,?,?,?,?,?)',id,this.scope,code,fields.purchaseId||null,fields.supplier||'',fields.receivedDate||'',fields.notes||'',this.createdAt);return id;
 }
 async add(lotId:string,modelId:string,quantity:number,unitCost:number){
  const balance=await this.stmt('SELECT * FROM stockLotBalances WHERE scope=? AND lotId=? AND modelId=?',this.scope,lotId,modelId).first<any>();
  if(balance)this.append('UPDATE stockLotBalances SET unitCost=ROUND((quantity*unitCost+?*?)/(quantity+?)),quantity=quantity+?,revision=CASE WHEN revision=? THEN revision+1 ELSE NULL END WHERE id=? AND scope=?',quantity,unitCost,quantity,quantity,balance.revision,balance.id,this.scope);
  else this.append('INSERT INTO stockLotBalances(id,scope,lotId,modelId,quantity,unitCost,createdAt) VALUES (?,?,?,?,?,?,?)',crypto.randomUUID(),this.scope,lotId,modelId,quantity,unitCost,this.createdAt);
 }
 async take(modelId:string,quantity:number,lotId?:string){
  const rows=(await this.stmt("SELECT b.* FROM stockLotBalances b JOIN stockLots l ON l.id=b.lotId WHERE b.scope=? AND b.modelId=? AND b.quantity>0"+(lotId?' AND b.lotId=?':'')+" ORDER BY COALESCE(NULLIF(l.receivedDate,''),'0001-01-01'),l.createdAt,l.id",this.scope,modelId,...(lotId?[lotId]:[])).all<any>()).results;
  if(rows.reduce((n,r)=>n+r.quantity,0)<quantity)throw Error(lotId?'Quantidade indisponível neste lote. Confira o lote selecionado.':'Quantidade indisponível no estoque por lotes.');
  let left=quantity;const allocations:Allocation[]=[];
  for(const row of rows){if(!left)break;const count=Math.min(left,row.quantity);left-=count;this.append('UPDATE stockLotBalances SET quantity=quantity-?,revision=CASE WHEN revision=? THEN revision+1 ELSE NULL END WHERE id=? AND scope=?',count,row.revision,row.id,this.scope);allocations.push({lotId:row.lotId,quantity:count,unitCost:row.unitCost});}
  return allocations;
 }
 sync(modelId:string){
  this.append('UPDATE models SET stock=(SELECT COALESCE(SUM(quantity),0) FROM stockLotBalances WHERE scope=? AND modelId=?),cost=COALESCE((SELECT ROUND(SUM(quantity*unitCost)*1.0/NULLIF(SUM(quantity),0)) FROM stockLotBalances WHERE scope=? AND modelId=?),cost),archived=0 WHERE id=? AND scope=?',this.scope,modelId,this.scope,modelId,modelId,this.scope);
 }
 async restore(modelId:string,quantity:number,unitCost:number,lotId?:string){
  const target=lotId||await this.lot('ESTORNO ANTERIOR',{notes:'Estorno de venda anterior à identificação de lotes.'});await this.add(target,modelId,quantity,unitCost);return target;
 }
}
