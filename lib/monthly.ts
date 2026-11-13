import type {Data} from './domain.ts';
export function monthlyResult(data:Data,month:string){
 const sales=data.sales.filter(s=>s.status==='active'&&s.date.slice(0,7)===month),entries=data.ledger.filter(e=>e.date.slice(0,7)===month);
 const revenue=sales.reduce((n,s)=>n+s.total,0),cost=sales.reduce((n,s)=>n+s.cost,0);
 const expenses=entries.filter(e=>e.type==='out'&&!['Fornecedor','Estorno','Retirada'].includes(e.category));
 const operating=expenses.reduce((n,e)=>n+e.amount,0),cashIn=entries.filter(e=>e.type==='in').reduce((n,e)=>n+e.amount,0),cashOut=entries.filter(e=>e.type==='out').reduce((n,e)=>n+e.amount,0);
 const categories:Record<string,number>={};for(const e of expenses)categories[e.category]=(categories[e.category]||0)+e.amount;
 return {month,revenue,cost,gross:revenue-cost,operating,result:revenue-cost-operating,cashIn,cashOut,cash:cashIn-cashOut,withdrawals:entries.filter(e=>e.type==='out'&&e.category==='Retirada').reduce((n,e)=>n+e.amount,0),units:sales.reduce((n,s)=>n+s.quantity,0),expenses,categories};
}
