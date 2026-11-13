import type {Data} from './domain.ts';
import {ensureDemoBikeUnits,availableBikes,syncDemoModel} from './bikes-domain.ts';
export function seedDemoLots(d:Data){
 d.stockLots??=[];d.stockLotBalances??=[];d.saleLots??=[];
 for(const m of d.models){const known=d.stockLotBalances.filter(r=>r.modelId===m.id).reduce((n,r)=>n+r.quantity,0);if(m.stock>known){const code='DEMO INICIAL',id=demoLot(d,code,new Date().toISOString());d.stockLotBalances.push({id:crypto.randomUUID(),lotId:id,modelId:m.id,quantity:m.stock-known,unitCost:m.cost,revision:0,createdAt:new Date().toISOString()});}}
 return ensureDemoBikeUnits(d);
}
export function demoLot(d:Data,code:string,createdAt:string,fields:any={}){code=code.trim().toUpperCase();const found=d.stockLots.find(l=>l.code===code);if(found)return found.id;const id=crypto.randomUUID();d.stockLots.push({id,code,supplier:'',carrier:'',receivedDate:'',notes:'',purchaseId:null,revision:0,createdAt,...fields});return id;}
export function demoBalance(d:Data,lotId:string,modelId:string,createdAt:string){if(!d.stockLotBalances.some(r=>r.lotId===lotId&&r.modelId===modelId))d.stockLotBalances.push({id:crypto.randomUUID(),lotId,modelId,quantity:0,unitCost:0,revision:0,createdAt});}
export function demoLotAdd(d:Data,lotId:string,modelId:string,quantity:number,unitCost:number|null,createdAt:string,details:any[]=[]){
 demoBalance(d,lotId,modelId,createdAt);const model=d.models.find(m=>m.id===modelId),ids:string[]=[];
 for(let i=0;i<quantity;i++){const u=details[i]||{},id=u.id||crypto.randomUUID();ids.push(id);d.bikeUnits.push({id,modelId,lotId,chassis:u.chassis||'',condition:u.condition||'unknown',status:'available',price:u.price??model?.price??0,unitCost,image:u.image||'',odometer:u.odometer??null,year:u.year??null,receivedDate:u.receivedDate||'',notes:u.notes||'',revision:0,createdAt});}
 syncDemoModel(d,modelId);return ids;
}
export function demoLotTake(d:Data,modelId:string,quantity:number,lotId?:string,unitId?:string,kind:'sold'|'out'='out'){
 const rows=availableBikes(d,modelId,lotId).filter(u=>!unitId||u.id===unitId).sort((a,b)=>{const la=d.stockLots.find(l=>l.id===a.lotId)!,lb=d.stockLots.find(l=>l.id===b.lotId)!;return (la.receivedDate||'0001-01-01').localeCompare(lb.receivedDate||'0001-01-01')||la.createdAt.localeCompare(lb.createdAt)||a.id.localeCompare(b.id);}).slice(0,quantity);
 if(rows.length<quantity||unitId&&quantity!==1)throw Error('Moto ou quantidade indisponível no lote selecionado.');
 const groups=new Map<string,{lotId:string;quantity:number;unitCost:number;units:any[]}>();
 for(const u of rows){const key=u.lotId+'|'+u.unitCost;let r=groups.get(key);if(!r){r={lotId:u.lotId,quantity:0,unitCost:u.unitCost??0,units:[]};groups.set(key,r);}r.quantity++;r.units.push({...u});u.status=kind;u.revision++;}
 syncDemoModel(d,modelId);return [...groups.values()];
}
export function demoTransfer(d:Data,modelId:string,quantity:number,fromLotId:string,toLotId:string,createdAt:string){
 const rows=availableBikes(d,modelId,fromLotId).slice(0,quantity);if(rows.length<quantity)throw Error('Quantidade indisponível no lote.');demoBalance(d,toLotId,modelId,createdAt);for(const u of rows){u.lotId=toLotId;u.revision++;}syncDemoModel(d,modelId);return rows;
}
