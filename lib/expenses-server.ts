import type {Database,Prepared} from './runtime.ts';
export async function expenseStatements(db:Database,scope:string,action:string,p:any,id:string,createdAt:string){
 const statements:Prepared[]=[],stmt=(sql:string,...args:any[])=>db.prepare(sql).bind(...args);
 const insert=(table:string,row:Record<string,any>)=>{const keys=Object.keys(row);statements.push(stmt(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,...Object.values(row)));};
 const found=p.id?await stmt('SELECT * FROM expenses WHERE id=? AND scope=?',p.id,scope).first<any>():null;
 if(p.id&&(!found||found.status!=='active'||found.revision!==p.revision))throw Error('Esta despesa foi alterada ou encerrada. Atualize a página.');
 const payment=(expenseId:string,amount:number,method:string,date:string,description:string,category:string)=>{if(amount)insert('ledger',{id:crypto.randomUUID(),scope,type:'out',amount,expenseId,description:'Despesa · '+description,category,payment:method,date,createdAt});};
 if(action==='expense'){
  if(found?.paid>0)throw Error('Despesas com pagamentos não podem ser editadas. O histórico foi preservado.');
  for(const [key,table] of [['purchaseId','purchases'],['lotId','stockLots'],['saleId','sales']]){
   if(p[key]&&!await stmt(`SELECT id FROM ${table} WHERE id=? AND scope=?`,p[key],scope).first())throw Error('Vínculo da despesa não encontrado.');
  }
  const {id:existing,revision,payment:method,paymentDate,...fields}=p,expenseId=existing||id,amount=p.quantity*p.unitAmount;
  if(found){const keys=Object.keys(fields);statements.push(stmt(`UPDATE expenses SET ${keys.map(k=>k+'=?').join(',')},amount=?,revision=CASE WHEN revision=? AND paid=0 AND status='active' THEN revision+1 ELSE NULL END WHERE id=? AND scope=?`,...Object.values(fields),amount,p.revision,p.id,scope));}
  else insert('expenses',{...fields,id:expenseId,scope,amount,createdAt});
  payment(expenseId,p.paid,method,paymentDate,p.description,p.category);
 }else if(action==='payExpense'){
  if(p.amount>found.amount-found.paid)throw Error('Pagamento superior ao saldo da despesa.');
  statements.push(stmt("UPDATE expenses SET paid=paid+?,revision=CASE WHEN revision=? AND status='active' THEN revision+1 ELSE NULL END WHERE id=? AND scope=?",p.amount,p.revision,p.id,scope));
  payment(found.id,p.amount,p.payment,p.date,found.description,found.category);
 }else{
  if(found.paid>0)throw Error('Só é possível cancelar despesas sem pagamentos.');
  statements.push(stmt("UPDATE expenses SET status='cancelled',revision=CASE WHEN revision=? AND paid=0 AND status='active' THEN revision+1 ELSE NULL END WHERE id=? AND scope=?",p.revision,p.id,scope));
 }
 return statements;
}
