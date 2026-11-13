import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {monthlyResult} from '../lib/monthly.ts';
import {expenseTotals,relatedExpenses,expenseState} from '../lib/expenses-domain.ts';
import {emptyData,demoAction} from '../lib/domain.ts';
import {validate} from '../lib/validation.ts';

const dir=mkdtempSync(join(tmpdir(),'gp-expenses-test-')),date='2026-11-12',paymentDate='2026-12-05',month='2026-11';
let proc,base,cookie='';
async function boot(){
 proc=spawn(process.execPath,['build/server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:'0',HOST:'127.0.0.1',PUBLIC_URL:'',DATA_DIR:dir,SEED_GP_BIKES:'0',DISABLE_SCHEDULER:'1',ZAPI_INSTANCE_ID:'',ZAPI_TOKEN:'',ZAPI_CLIENT_TOKEN:'',ADMIN_USERNAME:'',ADMIN_PASSWORD:''},stdio:['ignore','pipe','pipe']});
 let log='';await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Servidor não iniciou: '+log)),15000);proc.stdout.on('data',chunk=>{log+=chunk;const match=log.match(/pronta na porta (\d+)/);if(match){base='http://127.0.0.1:'+match[1];clearTimeout(timeout);resolve();}});proc.stderr.on('data',chunk=>{log+=chunk;});proc.once('exit',code=>{clearTimeout(timeout);reject(Error('Servidor encerrou '+code+': '+log));});});
}
async function stop(){const p=proc;proc=null;if(!p||p.exitCode!==null)return;await new Promise(resolve=>{p.once('exit',resolve);p.kill('SIGTERM');});}
async function api(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {r,j:await r.json()};}
const action=(action,payload,requestId=randomUUID())=>api('/api/action',{action,payload,requestId});
const draft={description:'Despesa de teste',category:'Montagem',payee:'Montador fictício',purchaseId:null,lotId:null,saleId:null,quantity:1,unitAmount:1000,paid:0,date,dueDate:'2026-11-20',notes:'',payment:'Pix',paymentDate:''};

test('despesas: migração, vínculos, contas a pagar, pagamentos únicos e resultado sem duplicação',async()=>{
 try{
 const old=new DatabaseSync(join(dir,'gp-performance.sqlite'));
 old.exec('PRAGMA foreign_keys=ON;CREATE TABLE app_migrations(name TEXT PRIMARY KEY,hash TEXT NOT NULL,appliedAt TEXT NOT NULL)');
 for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')&&n<'0006').sort()){const sql=readFileSync(join('drizzle',name),'utf8');old.exec(sql);old.prepare('INSERT INTO app_migrations VALUES (?,?,?)').run(name,createHash('sha256').update(sql).digest('hex'),date);}
 old.prepare("INSERT INTO models(id,scope,name,cost,price,stock,createdAt) VALUES ('m','gp-store','Moto existente',30000,100000,2,'2020-01-01')").run();
 old.prepare("INSERT INTO customers(id,scope,name,createdAt) VALUES ('c','gp-store','Cliente fictício','2020-01-01')").run();
 old.prepare("INSERT INTO ledger(id,scope,type,amount,description,category,payment,date,createdAt) VALUES ('antigo','gp-store','out',123,'Gasto anterior','Transporte','Pix',?,?)").run(date,date);
 old.prepare("INSERT INTO purchases(id,scope,number,date,supplier,total,createdAt) VALUES ('fora','outro','CP-FORA',?,'Fornecedor de outro escopo',1000,?)").run(date,date);old.close();
 await boot();const setup=await api('/api/auth/setup',{username:'teste',password:randomBytes(20).toString('base64url')});assert.equal(setup.r.status,200);cookie=setup.r.headers.get('set-cookie').split(';')[0];
 let d=(await api('/api/data')).j;assert.equal(d.expenses.length,0);assert.equal(d.models[0].stock,2);assert.equal(d.ledger[0].amount,123);assert.equal(d.ledger[0].expenseId,null);
 const purchase=await action('purchase',{lotCode:'LOTE DESPESAS',date,supplier:'Fornecedor teste',buyer:'Gigante',carrier:'Transportador teste',expectedDate:date,freight:10000,status:'in_transit',notes:'',items:[{modelId:'m',quantity:10,unitCost:50000}]});assert.equal(purchase.r.status,200,JSON.stringify(purchase.j));
 const tripPayload={...draft,description:'Combustível na compra',category:'Combustível',purchaseId:purchase.j.id,quantity:1,unitAmount:10000,paid:10000,paymentDate:date};
 const key=randomUUID(),trips=await Promise.all([action('expense',tripPayload,key),action('expense',tripPayload,key)]);assert.ok(trips.every(x=>x.r.status===200));assert.equal(trips[0].j.id,trips[1].j.id);const tripId=trips[0].j.id;
 d=(await api('/api/data')).j;assert.equal(d.expenses.length,1);assert.equal(d.ledger.filter(e=>e.expenseId===tripId).length,1);assert.equal(d.models[0].stock,2);assert.equal(expenseTotals(relatedExpenses(d,{purchaseId:purchase.j.id})).total,10000);
 assert.equal((await action('receivePurchase',{id:purchase.j.id,revision:0,date,registerPayment:false,payment:'Pix'})).r.status,200);
 d=(await api('/api/data')).j;const lot=d.stockLots.find(l=>l.purchaseId===purchase.j.id);assert.ok(lot);assert.equal(expenseTotals(relatedExpenses(d,{lotId:lot.id})).total,10000);
 const assembly=await action('expense',{...draft,description:'Montagem de 10 motos',quantity:10,unitAmount:5000,lotId:lot.id,dueDate:'2026-12-01'});assert.equal(assembly.r.status,200,JSON.stringify(assembly.j));const assemblyId=assembly.j.id;
 d=(await api('/api/data')).j;assert.equal(d.expenses.find(e=>e.id===assemblyId).amount,50000);assert.equal(d.ledger.filter(e=>e.expenseId===assemblyId).length,0);assert.equal(d.stockLotBalances.find(b=>b.lotId===lot.id).unitCost,51000);assert.equal(d.models[0].stock,12);assert.equal(expenseTotals(relatedExpenses(d,{purchaseId:purchase.j.id})).total,60000);
 const sale=await action('sale',{lotId:d.stockLots.find(l=>l.code==='ESTOQUE ANTERIOR').id,modelId:'m',customerId:'c',quantity:1,unitPrice:100000,discount:0,paid:100000,payment:'Pix',date,dueDate:'',chassis:'CHASSI FICTICIO',notes:''});assert.equal(sale.r.status,200);
 const delivery=await action('expense',{...draft,description:'Viagem para entregar moto',category:'Viagem para venda / entrega',saleId:sale.j.id,unitAmount:2000});assert.equal(delivery.r.status,200);
 const change=await action('expense',{...draft,description:'Gasto para corrigir',unitAmount:3000});assert.equal(change.r.status,200);
 assert.equal((await action('expense',{...draft,id:change.j.id,revision:0,unitAmount:6000})).r.status,200);assert.equal((await action('cancelExpense',{id:change.j.id,revision:0})).r.status,400);assert.equal((await action('cancelExpense',{id:change.j.id,revision:1})).r.status,200);assert.equal((await action('payExpense',{id:change.j.id,revision:2,amount:1,payment:'Pix',date})).r.status,400);
 const before=(await api('/api/data')).j;
 for(const invalid of [{...draft,quantity:0},{...draft,unitAmount:0},{...draft,quantity:10000,unitAmount:10000000000},{...draft,paid:1001,paymentDate:date},{...draft,dueDate:''},{...draft,paid:1000,paymentDate:''},{...draft,purchaseId:purchase.j.id,lotId:lot.id},{...draft,purchaseId:'fora'},{...draft,saleId:'inexistente'},{...draft,date:'2026-02-30'}])assert.equal((await action('expense',invalid)).r.status,400,JSON.stringify(invalid));
 d=(await api('/api/data')).j;assert.equal(d.expenses.length,before.expenses.length);assert.equal(d.ledger.length,before.ledger.length);
 const payKey=randomUUID(),part={id:assemblyId,revision:0,amount:10000,payment:'Pix',date};assert.equal((await action('payExpense',part,payKey)).r.status,200);assert.equal((await action('payExpense',part,payKey)).r.status,200);assert.equal((await action('payExpense',part)).r.status,400);
 d=(await api('/api/data')).j;const e=d.expenses.find(e=>e.id===assemblyId);assert.equal(e.paid,10000);assert.equal(e.revision,1);assert.equal(expenseState(e,'2026-12-02'),'overdue');assert.equal(d.ledger.filter(e=>e.expenseId===assemblyId).length,1);assert.equal(expenseTotals(relatedExpenses(d,{purchaseId:purchase.j.id})).balance,40000);
 let r=monthlyResult(d,month);assert.equal(r.operating,62123);assert.equal(r.result,7877);assert.equal(r.cashOut,20123);assert.equal(r.pendingExpenses,42000);
 assert.equal((await action('payExpense',{...part,revision:1,amount:40001})).r.status,400);assert.equal((await action('expense',{...draft,id:assemblyId,revision:1})).r.status,400);assert.equal((await action('cancelExpense',{id:assemblyId,revision:1})).r.status,400);
 const finish={...part,revision:1,amount:40000,date:paymentDate},paidBoth=await Promise.all([action('payExpense',finish),action('payExpense',finish)]);assert.deepEqual(paidBoth.map(x=>x.r.status).sort(),[200,400]);
 d=(await api('/api/data')).j;const complete=d.expenses.find(e=>e.id===assemblyId);assert.equal(complete.paid,50000);assert.equal(complete.revision,2);assert.equal(expenseState(complete,'2027-01-01'),'paid');assert.equal(d.ledger.filter(e=>e.expenseId===assemblyId).reduce((n,e)=>n+e.amount,0),50000);
 r=monthlyResult(d,month);assert.equal(r.operating,62123);assert.equal(r.result,7877);assert.equal(r.cashOut,20123);const next=monthlyResult(d,'2026-12');assert.equal(next.operating,0);assert.equal(next.cashOut,40000);assert.equal(next.result,0);
 assert.equal((await action('cancelSale',{id:sale.j.id,revision:0})).r.status,200);d=(await api('/api/data')).j;assert.equal(d.expenses.find(e=>e.id===delivery.j.id).status,'active');assert.equal(d.expenses.find(e=>e.id===delivery.j.id).paid,0);
 const snapshot=await fetch(base+'/api/backup/sqlite',{headers:{Cookie:cookie}});assert.equal(snapshot.status,200);const file=join(dir,'expenses-backup.sqlite');writeFileSync(file,new Uint8Array(await snapshot.arrayBuffer()));const db=new DatabaseSync(file,{readOnly:true});assert.equal(db.prepare('SELECT count(*) AS n FROM expenses').get().n,d.expenses.length);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);db.close();
 const oldCount=d.ledger.length;await stop();await boot();d=(await api('/api/data')).j;assert.equal(d.expenses.find(e=>e.id===assemblyId).paid,50000);assert.equal(d.ledger.length,oldCount);assert.ok(readdirSync(join(dir,'backups')).some(s=>s.startsWith('antes-iniciar-')));
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});

test('demonstração: montagem por quantidade, saldo parcial e baixa no caixa sem duplicar resultado',()=>{
 let d=demoAction(emptyData(),'expense',validate('expense',{...draft,quantity:10,unitAmount:5000}));const id=d.expenses[0].id;
 assert.equal(d.expenses[0].amount,50000);assert.equal(d.ledger.length,0);assert.equal(monthlyResult(d,month).operating,50000);
 d=demoAction(d,'payExpense',validate('payExpense',{id,revision:0,amount:20000,payment:'Pix',date}));assert.equal(d.expenses[0].paid,20000);assert.equal(d.ledger[0].expenseId,id);assert.equal(monthlyResult(d,month).operating,50000);assert.equal(monthlyResult(d,month).cashOut,20000);
 assert.throws(()=>demoAction(d,'payExpense',validate('payExpense',{id,revision:1,amount:30001,payment:'Pix',date})));assert.throws(()=>demoAction(d,'cancelExpense',{id,revision:1}));
});
