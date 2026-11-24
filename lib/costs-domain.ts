import type {Data} from './domain.ts';
export type CostAccess={enabled:boolean;unlocked:boolean;expiresAt?:number|null};
export const costsHidden=(data:Pick<Data,'costAccess'>)=>!!data.costAccess?.enabled&&(!data.costAccess.unlocked||!!data.costAccess.expiresAt&&data.costAccess.expiresAt<=Date.now());
export const costCsv=(data:Pick<Data,'costAccess'>,value:number|null|undefined)=>costsHidden(data)?'Protegido':value===null||value===undefined?'A informar':(value/100).toFixed(2);
export function withCostPrivacy(data:Data,access:CostAccess):Data{
 if(!costsHidden({costAccess:access}))return {...data,costAccess:access};
 return {...data,costAccess:access,
  models:data.models.map(m=>({...m,cost:0})),
  bikeUnits:data.bikeUnits.map(u=>({...u,unitCost:null})),
  saleUnits:data.saleUnits.map(u=>({...u,unitCost:null})),
  sales:data.sales.map(s=>({...s,cost:0})),
  movements:data.movements.map(m=>({...m,unitCost:0})),
  stockLotBalances:data.stockLotBalances.map(b=>({...b,unitCost:0})),
  saleLots:data.saleLots.map(l=>({...l,unitCost:0})),
  purchases:data.purchases.map(p=>({...p,total:0})),
  purchaseItems:data.purchaseItems.map(i=>({...i,unitCost:0})),
  ledger:data.ledger.filter(e=>e.category!=='Fornecedor'),
 };
}
