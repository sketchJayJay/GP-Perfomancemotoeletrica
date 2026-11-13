import type {Database,Prepared} from './runtime.ts';
import {chassisKey} from './bikes-domain.ts';
export type Allocation={lotId:string;quantity:number;unitCost:number;units:any[]};
export class LotBook {
 statements:Prepared[]=[];
 constructor(private db:Database,private scope:string,private createdAt:string){}
 private stmt(sql:string,...values:any[]){return this.db.prepare(sql).bind(...values);}
 private append(sql:string,...values:any[]){this.statements.push(this.stmt(sql,...values));}
 async lot(code:string,fields:{purchaseId?:string;supplier?:string;receivedDate?:string;notes?:string}={}){
  code=code.trim().toUpperCase();if(!code)throw Error('Informe o número do lote.');
  const lot=await this.stmt('SELECT * FROM stockLots WHERE scope=? AND code=? COLLATE NOCASE',this.scope,code).first<any>();
  if(lot){if(fields.purchaseId&&lot.purchaseId!==fields.purchaseId)throw Error('Este número de lote já está em uso. Escolha outro número.');return lot.id as string;}
  const id=crypto.randomUUID();this.append('INSERT INTO stockLots (id,scope,code,purchaseId,supplier,receivedDate,notes,createdAt) VALUES (?,?,?,?,?,?,?,?)',id,this.scope,code,fields.purchaseId||null,fields.supplier||'',fields.receivedDate||'',fields.notes||'',this.createdAt);return id;
 }
 balance(lotId:string,modelId:string){this.append('INSERT OR IGNORE INTO stockLotBalances(id,scope,lotId,modelId,quantity,unitCost,createdAt) VALUES (?,?,?,?,0,0,?)',crypto.randomUUID(),this.scope,lotId,modelId,this.createdAt);}
 async add(lotId:string,modelId:string,quantity:number,unitCost:number|null,details:any[]=[]){
  if(details.length&&details.length!==quantity)throw Error('A quantidade de chassis não corresponde às motos recebidas.');
  this.balance(lotId,modelId);
  const model=await this.stmt('SELECT price FROM models WHERE scope=? AND id=?',this.scope,modelId).first<any>(),ids:string[]=[];
  for(let i=0;i<quantity;i++){
   const u=details[i]||{},id=u.id||crypto.randomUUID(),chassis=(u.chassis||'').trim().toUpperCase();ids.push(id);
   this.append('INSERT INTO bikeUnits(id,scope,modelId,lotId,chassis,chassisKey,condition,price,unitCost,image,odometer,year,receivedDate,notes,sourceKey,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,this.scope,modelId,lotId,chassis,chassisKey(chassis),u.condition||'unknown',u.price??model?.price??0,unitCost,u.image||'',u.odometer??null,u.year??null,u.receivedDate||'',u.notes||'',u.sourceKey||null,this.createdAt);
  }
  return ids;
 }
 async take(modelId:string,quantity:number,lotId?:string,unitId?:string,kind:'sold'|'out'='out'){
  if(unitId&&quantity!==1)throw Error('Uma moto com chassi corresponde a uma unidade.');
  const rows=(await this.stmt("SELECT u.* FROM bikeUnits u JOIN stockLots l ON l.id=u.lotId WHERE u.scope=? AND u.modelId=? AND u.status='available'"+(lotId?' AND u.lotId=?':'')+(unitId?' AND u.id=?':'')+" ORDER BY COALESCE(NULLIF(l.receivedDate,''),'0001-01-01'),l.createdAt,l.id,u.createdAt,u.id LIMIT ?",this.scope,modelId,...(lotId?[lotId]:[]),...(unitId?[unitId]:[]),quantity).all<any>()).results;
  if(rows.length<quantity)throw Error('Moto indisponível ou quantidade insuficiente no lote selecionado.');
  const groups=new Map<string,Allocation>();
  for(const u of rows){
   this.append("UPDATE bikeUnits SET status=?,revision=CASE WHEN revision=? AND status='available' THEN revision+1 ELSE NULL END WHERE id=? AND scope=?",kind,u.revision,u.id,this.scope);
   const key=u.lotId+'|'+u.unitCost;let group=groups.get(key);if(!group){group={lotId:u.lotId,quantity:0,unitCost:u.unitCost??0,units:[]};groups.set(key,group);}group.quantity++;group.units.push(u);
  }
  return [...groups.values()];
 }
 sync(modelId:string){
  this.append("UPDATE stockLotBalances SET quantity=(SELECT count(*) FROM bikeUnits u WHERE u.scope=stockLotBalances.scope AND u.modelId=stockLotBalances.modelId AND u.lotId=stockLotBalances.lotId AND u.status='available'),unitCost=COALESCE((SELECT ROUND(AVG(COALESCE(u.unitCost,0))) FROM bikeUnits u WHERE u.scope=stockLotBalances.scope AND u.modelId=stockLotBalances.modelId AND u.lotId=stockLotBalances.lotId AND u.status='available'),unitCost),revision=revision+1 WHERE scope=? AND modelId=?",this.scope,modelId);
  this.append("UPDATE models SET stock=(SELECT count(*) FROM bikeUnits WHERE scope=? AND modelId=? AND status='available'),cost=COALESCE((SELECT ROUND(AVG(COALESCE(unitCost,0))) FROM bikeUnits WHERE scope=? AND modelId=? AND status='available'),cost),archived=0 WHERE id=? AND scope=?",this.scope,modelId,this.scope,modelId,modelId,this.scope);
 }
 async transfer(modelId:string,quantity:number,fromLotId:string,toLotId:string,unitId?:string){
  const rows=(await this.stmt("SELECT * FROM bikeUnits WHERE scope=? AND modelId=? AND lotId=? AND status='available'"+(unitId?' AND id=?':'')+' ORDER BY createdAt,id LIMIT ?',this.scope,modelId,fromLotId,...(unitId?[unitId]:[]),quantity).all<any>()).results;
  if(rows.length!==quantity)throw Error('Quantidade indisponível no lote de origem.');
  this.balance(toLotId,modelId);
  for(const u of rows)this.append("UPDATE bikeUnits SET lotId=?,revision=CASE WHEN revision=? AND status='available' THEN revision+1 ELSE NULL END WHERE id=? AND scope=?",toLotId,u.revision,u.id,this.scope);
  this.sync(modelId);return rows;
 }
 restoreUnit(unit:any){
  this.append("UPDATE bikeUnits SET status='available',revision=CASE WHEN status='sold' THEN revision+1 ELSE NULL END WHERE id=? AND scope=?",unit.unitId,this.scope);
 }
 async restore(modelId:string,quantity:number,unitCost:number,lotId?:string){
  const target=lotId||await this.lot('ESTORNO ANTERIOR',{notes:'Estorno de venda anterior à identificação de motos.'});await this.add(target,modelId,quantity,unitCost);return target;
 }
}
