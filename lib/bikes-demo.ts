import type {Data} from './domain.ts';
import {chassisKey,syncDemoModel} from './bikes-domain.ts';
import {demoLotAdd,demoBalance} from './lots-demo.ts';
export function demoBikeAction(d:Data,action:string,p:any,id:string,createdAt:string,date:string){
 if(action==='stockLot'){
  const found=d.stockLots.find(l=>l.id===p.id);if(p.id&&(!found||(found.revision||0)!==p.revision))throw Error('Lote alterado. Atualize a página.');
  if(d.stockLots.some(l=>l.id!==p.id&&l.code===p.code))throw Error('Já existe um lote com esse número.');
  if(found)Object.assign(found,p,{revision:(found.revision||0)+1});else d.stockLots.unshift({...p,id,revision:0,createdAt});return d;
 }
 const found=d.bikeUnits.find(u=>u.id===p.id);if(p.id&&(!found||found.revision!==p.revision))throw Error('Moto alterada. Atualize a página.');
 if(!d.stockLots.some(l=>l.id===p.lotId))throw Error('Lote não encontrado.');
 if(p.chassis&&d.bikeUnits.some(u=>u.id!==p.id&&chassisKey(u.chassis)===chassisKey(p.chassis)))throw Error('Já existe uma moto com esse chassi.');
 let modelId=found?.modelId||p.modelId;
 if(!modelId){modelId=crypto.randomUUID();d.models.unshift({id:modelId,...p.newModel,power:'',rangeKm:0,battery:'',cost:p.unitCost||0,price:p.price,stock:0,minStock:0,image:p.image,archived:0,createdAt});}
 if(found){
  if(found.status==='out')throw Error('Esta moto já saiu do estoque.');
  if(found.status==='sold'&&(p.lotId!==found.lotId||p.condition!==found.condition||p.price!==found.price||p.image!==found.image||p.odometer!==found.odometer||p.year!==found.year||p.date!==found.receivedDate||(found.chassis&&p.chassis!==found.chassis)||(found.unitCost!==null&&p.unitCost!==found.unitCost)))throw Error('Moto vendida: complete apenas o chassi ou custo que estavam pendentes.');
  const oldCost=found.unitCost,oldChassis=found.chassis;
  demoBalance(d,p.lotId,modelId,createdAt);Object.assign(found,{lotId:p.lotId,chassis:p.chassis,condition:p.condition,price:p.price,unitCost:p.unitCost,image:p.image,odometer:p.odometer,year:p.year,receivedDate:p.date,notes:p.notes,revision:found.revision+1});
  for(const row of d.saleUnits.filter(s=>s.unitId===found.id)){if(oldCost===null&&p.unitCost!==null)row.unitCost=p.unitCost;if(!oldChassis&&p.chassis)row.chassis=p.chassis;const sale=d.sales.find(s=>s.id===row.saleId)!;const all=d.saleUnits.filter(s=>s.saleId===sale.id);sale.cost=all.reduce((n,s)=>n+(s.unitCost||0),0);sale.costKnown=all.every(s=>s.unitCost!==null)?1:0;if(sale.quantity===1&&!sale.chassis)sale.chassis=p.chassis;sale.revision++;}syncDemoModel(d,modelId);
 }else{demoLotAdd(d,p.lotId,modelId,1,p.unitCost,createdAt,[{...p,id,receivedDate:p.date}]);d.movements.unshift({id:crypto.randomUUID(),modelId,lotId:p.lotId,unitId:id,delta:1,kind:'entrada',unitCost:p.unitCost||0,reference:'Moto adicionada ao lote',notes:p.chassis,date,createdAt});if(p.registerPayment&&p.unitCost>0)d.ledger.unshift({id:crypto.randomUUID(),type:'out',amount:p.unitCost,description:'Compra da moto · '+p.chassis,category:'Fornecedor',payment:p.payment,date,createdAt});}
 return d;
}
