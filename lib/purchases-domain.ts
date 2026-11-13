import {demoLot,demoLotAdd} from './lots-demo.ts';
import type {Data,PurchaseItem} from './domain.ts';
export const purchaseLabels={planned:'Em compra',purchased:'Comprada',in_transit:'Em transporte',received:'Recebida',cancelled:'Cancelada'};
export function landedCosts(items:{quantity:number;unitCost:number}[],freight:number){
 const subtotal=items.reduce((n,i)=>n+i.quantity*i.unitCost,0),quantity=items.reduce((n,i)=>n+i.quantity,0);let allocated=0;
 return items.map((i,index)=>{const share=index===items.length-1?freight-allocated:Math.floor(freight*(subtotal?i.quantity*i.unitCost/subtotal:i.quantity/quantity));allocated+=share;return {lineTotal:i.quantity*i.unitCost+share,unitCost:Math.round((i.quantity*i.unitCost+share)/i.quantity)};});
}
export function demoPurchaseAction(d:Data,action:string,p:any,id:string,createdAt:string,date:string){
 d.purchases??=[];d.purchaseItems??=[];
 if(action==='purchase'){
  const found=p.id?d.purchases.find(x=>x.id===p.id):undefined;
  if(p.id&&(!found||found.status==='received'||found.status==='cancelled'||found.revision!==p.revision))throw Error('Esta compra foi alterada ou encerrada. Atualize a página.');
  const {items,...fields}=p,total=items.reduce((n:number,i:any)=>n+i.quantity*i.unitCost,0)+p.freight;
  for(const i of items)if(!d.models.some(m=>m.id===i.modelId&&!m.archived))throw Error('Selecione modelos ativos para todos os itens.');
  const purchaseId=found?.id||id;
  if(found)Object.assign(found,fields,{total,revision:found.revision+1});
  else d.purchases.unshift({...fields,id:purchaseId,total,number:'CP-'+Date.now().toString().slice(-6),receivedDate:'',revision:0,createdAt});
  d.purchaseItems=d.purchaseItems.filter(i=>i.purchaseId!==purchaseId);
  d.purchaseItems.push(...items.map((i:any)=>({...i,id:crypto.randomUUID(),purchaseId,createdAt})));
 }else{
  const order=d.purchases.find(x=>x.id===p.id);
  if(!order||order.status==='received'||order.status==='cancelled'||order.revision!==p.revision)throw Error('Compra já encerrada ou alterada. Atualize os dados.');
  order.revision++;
  if(action==='cancelPurchase'){order.status='cancelled';return d;}
  const items=d.purchaseItems.filter(i=>i.purchaseId===order.id),costs=landedCosts(items,order.freight);
  const lotId=demoLot(d,order.lotCode||order.number,createdAt,{purchaseId:order.id,supplier:order.supplier,receivedDate:date});
  for(const [index,i] of items.entries()){
   demoLotAdd(d,lotId,i.modelId,i.quantity,costs[index].unitCost,createdAt);
   d.movements.unshift({id:crypto.randomUUID(),modelId:i.modelId,lotId,delta:i.quantity,kind:'entrada',unitCost:costs[index].unitCost,reference:order.number,notes:'Recebimento do lote · '+order.supplier,date,createdAt});
  }
  order.status='received';order.receivedDate=date;
  if(p.registerPayment&&order.total>0)d.ledger.unshift({id:crypto.randomUUID(),type:'out',amount:order.total,description:'Compra '+order.number+' · '+order.supplier,category:'Fornecedor',payment:p.payment,date,createdAt});
 }
 return d;
}
