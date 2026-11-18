import type {Data,Expense,Sale} from './domain.ts';

// Integer cents, with a deterministic one-cent remainder. The saved recipient
// list keeps a lot's old expenses from changing when more bikes arrive later.
export function splitCents(amount:number,ids:string[]){
 const ordered=[...new Set(ids)].sort(),base=ordered.length?Math.floor(amount/ordered.length):0,remainder=ordered.length?amount%ordered.length:0;
 return new Map(ordered.map((id,i)=>[id,base+(i<remainder?1:0)]));
}
export function expenseUnitIds(data:Data,e:Partial<Expense>):string[]{
 if(e.allocationUnits){try{const ids=JSON.parse(e.allocationUnits);if(Array.isArray(ids)&&ids.every(id=>typeof id==='string'))return [...new Set<string>(ids)].sort();}catch{}}
 if(e.unitId)return [e.unitId];
 if(e.saleId)return [...new Set(data.saleUnits.filter(u=>u.saleId===e.saleId).map(u=>u.unitId))].sort();
 const lots=e.lotId?[e.lotId]:e.purchaseId?data.stockLots.filter(l=>l.purchaseId===e.purchaseId).map(l=>l.id):[];
 return data.bikeUnits.filter(u=>lots.includes(u.lotId)).map(u=>u.id).sort();
}
export type ProfitExpense={expense:Expense;amount:number;paid:number;recipientCount:number;shared:boolean};
export function unitExpenseShares(data:Data,unitIds:string[],saleId?:string):ProfitExpense[]{
 const selected=new Set(unitIds),rows:ProfitExpense[]=[];
 for(const e of data.expenses||[]){
  if(e.status!=='active')continue;
  if(e.saleId){if(e.saleId!==saleId)continue;rows.push({expense:e,amount:e.amount,paid:e.paid,recipientCount:expenseUnitIds(data,e).length||unitIds.length,shared:false});continue;}
  const ids=expenseUnitIds(data,e),amounts=splitCents(e.amount,ids),payments=splitCents(e.paid,ids),amount=ids.reduce((n,id)=>n+(selected.has(id)?amounts.get(id)||0:0),0),paid=ids.reduce((n,id)=>n+(selected.has(id)?payments.get(id)||0:0),0);
  if(ids.some(id=>selected.has(id)))rows.push({expense:e,amount,paid,recipientCount:ids.length,shared:!e.unitId});
 }
 return rows;
}
export function previewBikeProfit(data:Data,unitId:string,revenue:number,draftExpenses=0){
 const unit=data.bikeUnits.find(u=>u.id===unitId),details=unitExpenseShares(data,[unitId]),registered=details.reduce((n,r)=>n+r.amount,0),expenses=registered+draftExpenses,cost=unit?.unitCost??0;
 return {revenue,cost,registered,expenses,profit:revenue-cost-expenses,partial:!unit||unit.unitCost===null,details,margin:revenue?(revenue-cost-expenses)/revenue*100:0};
}
export function saleProfit(data:Data,sale:Sale){
 const links=data.saleUnits.filter(u=>u.saleId===sale.id),ids=links.map(u=>u.unitId),details=unitExpenseShares(data,ids,sale.id),expenses=details.reduce((n,r)=>n+r.amount,0),paidExpenses=details.reduce((n,r)=>n+r.paid,0),partial=sale.costKnown===0||links.some(u=>u.unitCost===null)||links.length!==sale.quantity,profit=sale.total-sale.cost-expenses,revenueShares=splitCents(sale.total,ids);
 const units=links.map(link=>{
  const own=details.reduce((n,r)=>{const recipients=expenseUnitIds(data,r.expense);return n+(splitCents(r.expense.amount,recipients.length?recipients:ids).get(link.unitId)||0);},0),revenue=revenueShares.get(link.unitId)||0,cost=link.unitCost??0;
  return {unitId:link.unitId,chassis:link.chassis||data.bikeUnits.find(u=>u.id===link.unitId)?.chassis||'',revenue,cost,expenses:own,profit:revenue-cost-own,partial:link.unitCost===null};
 });
 return {sale,revenue:sale.total,cost:sale.cost,gross:sale.total-sale.cost,expenses,paidExpenses,pendingExpenses:expenses-paidExpenses,profit,margin:sale.total?profit/sale.total*100:0,partial,missingUnits:links.length!==sale.quantity,details,units:links.length===sale.quantity?units:[]};
}
