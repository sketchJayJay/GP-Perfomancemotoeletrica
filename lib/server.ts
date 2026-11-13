import {expenseStatements} from './expenses-server.ts';
import {LotBook} from './lot-stock.ts';
import {purchaseStatements} from './purchases-server.ts';
import {env,scopeFor,Prepared} from './runtime.ts';
export {scopeFor} from './runtime.ts';
import { defaultSettings, normalizePhone, birthdayMessage, today } from './domain.ts';
import { validate } from './validation.ts';
export function database(){if(!env.DB)throw Error('Banco de dados indisponível. Tente novamente.');return env.DB;}
export function assertOrigin(req:Request){const o=req.headers.get('origin');if(o&&o!==new URL(req.url).origin)throw Error('Origem da requisição inválida.');}
export function providerReady(){return !!(env.ZAPI_INSTANCE_ID&&env.ZAPI_TOKEN&&env.ZAPI_CLIENT_TOKEN);}
export async function readData(scope:string){const db=database();const tables=['expenses','models','customers','sales','movements','ledger','birthdayLogs','purchases','purchaseItems','stockLots','stockLotBalances','saleLots','settings'];const r=await db.batch(tables.map(t=>db.prepare(`SELECT * FROM ${t} WHERE scope = ?${t==='settings'?'':' ORDER BY createdAt DESC'}`).bind(scope)));const d:any={};tables.forEach((t,i)=>{d[t]=t==='settings'?(r[i].results[0]||defaultSettings):r[i].results;});d.providerReady=providerReady();return d;}
export async function action(scope:string,name:string,input:unknown,requestId:string){
 if(!/^[a-f0-9-]{36}$/.test(requestId))throw Error('Identificador da operação inválido. Atualize a página.');
 const p=validate(name,input),db=database(),id=crypto.randomUUID(),createdAt=new Date().toISOString(),date=p.date||today();
 const existing=await db.prepare('SELECT * FROM operations WHERE id=? AND scope=?').bind(requestId,scope).first<any>();
 if(existing){if(existing.action!==name)throw Error('Operação já utilizada.');return {id:existing.resultId};}
 const stmt=(sql:string,...args:any[])=>db.prepare(sql).bind(...args);
 const get=async(table:string,key:string)=>await stmt(`SELECT * FROM ${table} WHERE id=? AND scope=?`,key,scope).first<any>();
 const batch:Prepared[]=[];
 const insert=(table:string,obj:Record<string,any>)=>{const keys=Object.keys(obj);batch.push(stmt(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,...Object.values(obj)));};
 const update=(table:string,obj:Record<string,any>,key:string)=>{const keys=Object.keys(obj);batch.push(stmt(`UPDATE ${table} SET ${keys.map(k=>k+'=?').join(',')} WHERE id=? AND scope=?`,...Object.values(obj),key,scope));};
 const move=(o:any)=>insert('movements',{id:crypto.randomUUID(),scope,createdAt,date,...o});
 const entry=(o:any)=>insert('ledger',{id:crypto.randomUUID(),scope,createdAt,date,...o});
 if(['expense','payExpense','cancelExpense'].includes(name)){batch.push(...await expenseStatements(db,scope,name,p,id,createdAt));}
 else if(['purchase','receivePurchase','cancelPurchase'].includes(name)){batch.push(...await purchaseStatements(db,scope,name,p,id,createdAt,date));}
 else if(name==='model'){
   const {id:existing,initialStock,initialLotCode,...fields}=p;
   if(existing){const m=await get('models',existing);if(!m)throw Error('Modelo não encontrado.');if(m.stock>0&&m.cost!==p.cost)throw Error('O custo do estoque é calculado pelos lotes. Confira o custo na compra ou entrada.');update('models',fields,existing);}
   else{insert('models',{...fields,id,scope,stock:initialStock||0,createdAt});if(initialStock){const book=new LotBook(db,scope,createdAt),lotId=await book.lot(initialLotCode||'INICIAL-'+id.slice(0,8),{receivedDate:date,notes:'Cadastro inicial do estoque'});await book.add(lotId,id,initialStock,p.cost);book.sync(id);batch.push(...book.statements);move({modelId:id,lotId,delta:initialStock,kind:'entrada',unitCost:p.cost,reference:'Estoque inicial',notes:''});}}
 }else if(name==='customer'){
   const {id:existing,...fields}=p;fields.phone=normalizePhone(fields.phone);
   if(fields.birthday&&fields.birthday>today())throw Error('A data de nascimento não pode ser futura.');
   if(existing){if(!await get('customers',existing))throw Error('Cliente não encontrado.');update('customers',fields,existing);}else insert('customers',{...fields,id,scope,createdAt});
 }else if(name==='archiveModel'){
   if(!await get('models',p.id))throw Error('Modelo não encontrado.');
   batch.push(stmt('UPDATE models SET stock=CASE WHEN stock=0 THEN 0 ELSE -1 END,archived=1 WHERE id=? AND scope=?',p.id,scope));
 }else if(name==='archiveCustomer'){if(!await get('customers',p.id))throw Error('Cliente não encontrado.');update('customers',{archived:1},p.id);
 }else if(name==='assignLot'){
   const book=new LotBook(db,scope,createdAt),m=await get('models',p.modelId);if(!m)throw Error('Modelo não encontrado.');
   const source=await db.prepare('SELECT * FROM stockLots WHERE id=? AND scope=?').bind(p.fromLotId,scope).first<any>();if(!source)throw Error('Lote de origem não encontrado.');
   if(source.code.toUpperCase()===p.lotCode)throw Error('Escolha um lote de destino diferente.');
   const rows=await book.take(p.modelId,p.quantity,p.fromLotId),target=await book.lot(p.lotCode,{receivedDate:p.date,notes:'Lote identificado a partir de '+source.code});
   await book.add(target,p.modelId,p.quantity,rows[0].unitCost);book.sync(p.modelId);batch.push(...book.statements);
   move({modelId:p.modelId,lotId:source.id,delta:-p.quantity,kind:'reclassificacao',unitCost:rows[0].unitCost,reference:'Identificação de lote',notes:'Destino: '+p.lotCode});
   move({modelId:p.modelId,lotId:target,delta:p.quantity,kind:'reclassificacao',unitCost:rows[0].unitCost,reference:'Identificação de lote',notes:'Origem: '+source.code});
 }else if(name==='movement'){
   const m=await get('models',p.modelId);if(!m||m.archived)throw Error('Modelo não encontrado.');
   const book=new LotBook(db,scope,createdAt);
   if(p.kind==='entrada'){
    const lotId=await book.lot(p.lotCode||'ENTRADA-'+id.slice(0,8),{receivedDate:date,notes:p.reference});await book.add(lotId,m.id,p.quantity,p.unitCost);book.sync(m.id);batch.push(...book.statements);
    move({modelId:m.id,lotId,delta:p.quantity,kind:'entrada',unitCost:p.unitCost,reference:p.reference,notes:p.notes});
    if(p.registerPayment&&p.unitCost>0)entry({type:'out',amount:p.quantity*p.unitCost,description:'Compra · '+m.name,category:'Fornecedor',payment:p.payment});
   }else{
    const rows=await book.take(m.id,p.quantity,p.lotId);book.sync(m.id);batch.push(...book.statements);
    for(const r of rows)move({modelId:m.id,lotId:r.lotId,delta:-r.quantity,kind:'saida',unitCost:r.unitCost,reference:p.reference,notes:p.notes});
   }
 }else if(name==='sale'){
   const [m,c]=await Promise.all([get('models',p.modelId),get('customers',p.customerId)]);
   if(!m||m.archived||!c||c.archived)throw Error('Selecione um modelo e um cliente ativos.');
   if(m.stock<p.quantity)throw Error('Quantidade indisponível no estoque.');
   const total=p.quantity*p.unitPrice-p.discount,number='GP-'+date.replaceAll('-','').slice(2)+'-'+id.slice(0,5).toUpperCase();
   const book=new LotBook(db,scope,createdAt),allocations=await book.take(m.id,p.quantity,p.lotId);book.sync(m.id);batch.push(...book.statements);
   const {lotId:selectedLot,...fields}=p;
   insert('sales',{...fields,id,scope,total,number,cost:allocations.reduce((n,r)=>n+r.quantity*r.unitCost,0),createdAt});
   for(const r of allocations){
    insert('saleLots',{id:crypto.randomUUID(),scope,saleId:id,lotId:r.lotId,modelId:m.id,quantity:r.quantity,unitCost:r.unitCost,createdAt});
    move({modelId:m.id,lotId:r.lotId,delta:-r.quantity,kind:'venda',unitCost:r.unitCost,reference:number,notes:p.chassis?'Chassi/série: '+p.chassis:''});
   }
   if(p.paid)entry({type:'in',amount:p.paid,description:'Venda '+number,category:'Venda',payment:p.payment,saleId:id});
 }else if(name==='payment'||name==='cancelSale'){
   const s=await get('sales',p.id);if(!s||s.status!=='active')throw Error('Venda indisponível ou já cancelada.');
   if(p.revision!==s.revision)throw Error('Esta venda foi alterada. Atualize a página e tente novamente.');
   if(name==='payment'){
     if(p.amount>s.total-s.paid)throw Error('Valor superior ao saldo da venda.');
     batch.push(stmt("UPDATE sales SET paid=paid+?,revision=CASE WHEN revision=? AND status='active' THEN revision+1 ELSE NULL END WHERE id=? AND scope=?",p.amount,p.revision,p.id,scope));
     entry({type:'in',amount:p.amount,description:'Recebimento '+s.number,category:'Venda',payment:p.payment,saleId:s.id});
   }else{
     batch.push(stmt("UPDATE sales SET status='cancelled',revision=CASE WHEN revision=? AND status='active' THEN revision+1 ELSE NULL END WHERE id=? AND scope=?",p.revision,p.id,scope));
     const rows=(await db.prepare('SELECT * FROM saleLots WHERE scope=? AND saleId=?').bind(scope,s.id).all<any>()).results;
     const book=new LotBook(db,scope,createdAt),returns:any[]=[];
     for(const r of rows.length?rows:[{quantity:s.quantity,unitCost:Math.round(s.cost/s.quantity),lotId:undefined}]){
      const lotId=await book.restore(s.modelId,r.quantity,r.unitCost,r.lotId);returns.push({modelId:s.modelId,lotId,delta:r.quantity,kind:'estorno',unitCost:r.unitCost,reference:s.number,notes:'Venda cancelada'});
     }
     book.sync(s.modelId);batch.push(...book.statements);for(const returned of returns)move(returned);
     if(s.paid)entry({type:'out',amount:s.paid,description:'Estorno '+s.number,category:'Estorno',payment:s.payment,saleId:s.id});
   }
 }else if(name==='entry'){insert('ledger',{...p,id,scope,createdAt});
 }else if(name==='settings'){
   if(p.birthdayEnabled&&!providerReady())throw Error('Conecte o WhatsApp antes de ativar o envio automático.');
   const keys=Object.keys(p);batch.push(stmt(`INSERT INTO settings (scope,${keys.join(',')}) VALUES (?,${keys.map(()=>'?').join(',')}) ON CONFLICT(scope) DO UPDATE SET ${keys.map(k=>k+'=excluded.'+k).join(',')}`,scope,...Object.values(p)));
 }
 insert('operations',{id:requestId,scope,action:name,resultId:p.id||id,createdAt});
 try{if(batch.length)await db.batch(batch);}catch(error){const completed=await db.prepare('SELECT * FROM operations WHERE id=? AND scope=?').bind(requestId,scope).first<any>();if(completed&&completed.action===name)return {id:completed.resultId};throw error;}
 return {id:p.id||id};
}
export async function processBirthdays(scope?:string){
 const db=database(),date=today(),year=+date.slice(0,4),mmdd=date.slice(5);
 if(!providerReady())return {status:'not_connected',accepted:0,detail:'WhatsApp ainda não conectado. Nenhuma mensagem enviada.'};
 const owners=await db.prepare('SELECT * FROM settings WHERE birthdayEnabled=1'+(scope?' AND scope=?':'')).bind(...(scope?[scope]:[])).all<any>();
 let accepted=0,failed=0,skipped=0;
 for(const s of owners.results){
   const cs=await db.prepare("SELECT * FROM customers WHERE scope=? AND archived=0 AND consent=1 AND phone!='' AND (substr(birthday,6,5)=? OR (?=1 AND substr(birthday,6,5)='02-29'))").bind(s.scope,mmdd,mmdd==='03-01'&&new Date(Date.UTC(year,1,29)).getUTCMonth()!==1?1:0).all<any>();
   for(const c of cs.results){
     const id=crypto.randomUUID(),message=birthdayMessage(c.name,s);
     const claim=await db.prepare("INSERT OR IGNORE INTO birthdayLogs (id,scope,customerId,year,status,message,createdAt) VALUES (?,?,?,?,'processing',?,?)").bind(id,s.scope,c.id,year,message,new Date().toISOString()).run();
     if(!claim.meta.changes){skipped++;continue;}
     try{
       const response=await fetch(`https://api.z-api.io/instances/${encodeURIComponent(env.ZAPI_INSTANCE_ID!)}/token/${encodeURIComponent(env.ZAPI_TOKEN!)}/send-text`,{method:'POST',headers:{'Content-Type':'application/json','Client-Token':env.ZAPI_CLIENT_TOKEN!},body:JSON.stringify({phone:normalizePhone(c.phone),message}),signal:AbortSignal.timeout(18000)});
       const result:any=await response.json().catch(()=>({}));
       const ok=response.ok&&!!(result.messageId||result.zapiMessageId);
       await db.prepare('UPDATE birthdayLogs SET status=?,providerId=? WHERE id=?').bind(ok?'accepted':'failed',ok?String(result.messageId||result.zapiMessageId):'',id).run();
       if(ok)accepted++;else failed++;
     }catch{
       await db.prepare("UPDATE birthdayLogs SET status='unknown' WHERE id=?").bind(id).run();failed++;
     }
   }
 }
 return {status:'completed',date,accepted,failed,skipped};
}
export async function runBirthdayJob(){const result=await processBirthdays();const runId=crypto.randomUUID();await database().prepare('INSERT INTO jobRuns (id,createdAt,status,accepted,failed,skipped) VALUES (?,?,?,?,?,?)').bind(runId,new Date().toISOString(),result.status,result.accepted,'failed' in result?result.failed:0,'skipped' in result?result.skipped:0).run();return {...result,runId};}
