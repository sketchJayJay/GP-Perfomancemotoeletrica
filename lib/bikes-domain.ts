import type {Data,BikeUnit} from './domain.ts';
export const conditionLabels={new:'Nova',used:'Usada',unknown:'A informar'};
export const chassisKey=(s:string)=>s.toUpperCase().replace(/[^A-Z0-9]/g,'');
export const availableBikes=(data:Data,modelId?:string,lotId?:string)=>(data.bikeUnits||[]).filter(u=>u.status==='available'&&(!modelId||u.modelId===modelId)&&(!lotId||u.lotId===lotId));
export function syncDemoModel(d:Data,modelId:string){
 const m=d.models.find(m=>m.id===modelId);if(!m)return;
 for(const b of d.stockLotBalances.filter(b=>b.modelId===modelId)){const units=availableBikes(d,modelId,b.lotId);b.quantity=units.length;if(units.length)b.unitCost=Math.round(units.reduce((n,u)=>n+(u.unitCost||0),0)/units.length);b.revision++;}
 const units=availableBikes(d,modelId);m.stock=units.length;if(units.length)m.cost=Math.round(units.reduce((n,u)=>n+(u.unitCost||0),0)/units.length);m.archived=0;
}
export function ensureDemoBikeUnits(d:Data){
 d.bikeUnits??=[];d.saleUnits??=[];
 for(const b of d.stockLotBalances){const count=availableBikes(d,b.modelId,b.lotId).length,m=d.models.find(m=>m.id===b.modelId);for(let i=count;i<b.quantity;i++)d.bikeUnits.push({id:crypto.randomUUID(),modelId:b.modelId,lotId:b.lotId,chassis:'',condition:'unknown',status:'available',price:m?.price||0,unitCost:b.unitCost,image:'',odometer:null,year:null,receivedDate:'',notes:'Saldo anterior sem identificação individual.',revision:0,createdAt:b.createdAt});}
 return d;
}
