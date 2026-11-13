import type {Data,Expense} from './domain.ts';

export const expenseCategories=['Viagem para compra','Viagem para venda / entrega','Montagem','Combustível','Pedágio','Alimentação','Hospedagem','Frete extra','Manutenção / reparo','Comissão','Outras despesas'] as const;
export type ExpenseLink={purchaseId?:string|null;lotId?:string|null;saleId?:string|null};
export function relatedExpenses(data:Data,link:ExpenseLink){
 const purchaseId=link.purchaseId||data.stockLots.find(l=>l.id===link.lotId)?.purchaseId;
 const lots=data.stockLots.filter(l=>l.purchaseId&&l.purchaseId===purchaseId).map(l=>l.id);
 return (data.expenses||[]).filter(e=>link.saleId?e.saleId===link.saleId:link.lotId?(e.lotId===link.lotId||!!purchaseId&&e.purchaseId===purchaseId):link.purchaseId?(e.purchaseId===link.purchaseId||!!e.lotId&&lots.includes(e.lotId)):false);
}
export function expenseTotals(items:Expense[]){const active=items.filter(e=>e.status==='active'),total=active.reduce((n,e)=>n+e.amount,0),paid=active.reduce((n,e)=>n+e.paid,0);return {total,paid,balance:total-paid};}
export function expenseLinkLabel(data:Data,e:ExpenseLink){
 if(e.purchaseId){const p=data.purchases.find(p=>p.id===e.purchaseId);return p?'Compra '+p.number+' · Lote '+(p.lotCode||p.number):'Compra indisponível';}
 if(e.lotId)return 'Lote '+(data.stockLots.find(l=>l.id===e.lotId)?.code||'indisponível');
 if(e.saleId){const s=data.sales.find(s=>s.id===e.saleId);return 'Venda '+(s?.number||'indisponível')+(s?.chassis?' · '+s.chassis:'');}
 return 'Despesa geral';
}
export function expenseState(e:Expense,date:string){return e.status==='cancelled'?'cancelled':e.paid===e.amount?'paid':e.dueDate&&e.dueDate<date?'overdue':e.paid>0?'partial':'pending';}
export function demoExpenseAction(d:Data,action:string,p:any,id:string,createdAt:string,date:string){
 d.expenses??=[];
 const found=p.id?d.expenses.find(e=>e.id===p.id):undefined;
 if(p.id&&(!found||found.status!=='active'||found.revision!==p.revision))throw Error('Esta despesa mudou. Atualize a página.');
 const pay=(expenseId:string,amount:number,payment:string,paymentDate:string,description:string,category:string)=>{if(amount)d.ledger.unshift({id:crypto.randomUUID(),type:'out',amount,expenseId,description:'Despesa · '+description,category,payment,date:paymentDate,createdAt});};
 if(action==='expense'){
  if(found?.paid)throw Error('Despesas com pagamentos não podem ser editadas. O histórico foi preservado.');
  for(const [field,rows] of [['purchaseId',d.purchases],['lotId',d.stockLots],['saleId',d.sales]] as const)if(p[field]&&!rows.some(r=>r.id===p[field]))throw Error('Vínculo da despesa não encontrado.');
  const {id:ignored,revision,payment,paymentDate,...fields}=p,expenseId=found?.id||id;
  if(found)Object.assign(found,fields,{amount:p.quantity*p.unitAmount,revision:found.revision+1});
  else d.expenses.unshift({...fields,id:expenseId,amount:p.quantity*p.unitAmount,status:'active',revision:0,createdAt});
  pay(expenseId,p.paid,payment,paymentDate,p.description,p.category);
 }else if(action==='payExpense'){
  if(!found||p.amount>found.amount-found.paid)throw Error('Pagamento superior ao saldo da despesa.');
  found.paid+=p.amount;found.revision++;pay(found.id,p.amount,p.payment,date,found.description,found.category);
 }else{
  if(!found||found.paid>0)throw Error('Só é possível cancelar despesas sem pagamentos.');found.status='cancelled';found.revision++;
 }
 return d;
}
