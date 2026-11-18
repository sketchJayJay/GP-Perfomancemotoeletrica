import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {saleProfit,previewBikeProfit,splitCents} from '../lib/sale-profit.ts';
import {monthlyResult} from '../lib/monthly.ts';
import {emptyData,demoAction} from '../lib/domain.ts';
import {validate} from '../lib/validation.ts';

const date='2026-11-18';
let proc,base,cookie='';
async function boot(dir){
 proc=spawn(process.execPath,['build/server.mjs'],{cwd:process.cwd(),env:{...process.env,DATA_DIR:dir,PORT:'0',HOST:'127.0.0.1',PUBLIC_URL:'',SEED_GP_BIKES:'0',DISABLE_SCHEDULER:'1',ZAPI_INSTANCE_ID:'',ZAPI_TOKEN:'',ZAPI_CLIENT_TOKEN:'',ADMIN_USERNAME:'',ADMIN_PASSWORD:''},stdio:['ignore','pipe','pipe']});
 let log='';await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Servidor não iniciou: '+log)),15000);proc.stdout.on('data',chunk=>{log+=chunk;const match=log.match(/pronta na porta (\d+)/);if(match){base='http://127.0.0.1:'+match[1];clearTimeout(timer);resolve();}});proc.stderr.on('data',chunk=>{log+=chunk;});proc.once('exit',code=>{clearTimeout(timer);reject(Error('Servidor encerrou '+code+': '+log));});});
}
async function stop(){const p=proc;proc=null;if(!p||p.exitCode!==null)return;await new Promise(resolve=>{p.once('exit',resolve);p.kill('SIGTERM');});}
async function api(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {r,j:await r.json()};}
const action=(action,payload,requestId=randomUUID())=>api('/api/action',{action,payload,requestId});
const data=async()=>(await api('/api/data')).j;
async function setup(){const r=await api('/api/auth/setup',{username:'teste',password:randomBytes(20).toString('base64url')});assert.equal(r.r.status,200);cookie=r.r.headers.get('set-cookie').split(';')[0];}
async function ok(name,payload,key){const r=await action(name,payload,key);assert.equal(r.r.status,200,JSON.stringify(r.j));return r.j.id;}
const lotDraft={code:'LOTE LUCRO',supplier:'Fornecedor fictício',carrier:'Transportador fictício',receivedDate:date,notes:''};
const unitDraft={newModel:{name:'Moto teste',color:'Preta',brand:''},chassis:'LUCRO-CHASSI-01',condition:'new',price:800000,unitCost:500000,image:'',odometer:null,year:null,date,notes:'',registerPayment:false,payment:'Pix'};
const customerDraft={name:'Cliente fictício',phone:'',document:'',birthday:'',email:'',city:'',address:'',notes:'',consent:0};
const expenseDraft={description:'Gasto de teste',category:'Montagem',payee:'Montador fictício',purchaseId:null,lotId:null,saleId:null,unitId:null,quantity:1,unitAmount:1000,paid:0,date,dueDate:'2026-12-01',notes:'',payment:'Pix',paymentDate:''};
const commission=(payee,amount,paid=0)=>({description:'Comissão de venda',category:'Comissão',payee,amount,paid,dueDate:paid===amount?'':'2026-12-01',payment:'Pix',paymentDate:paid?date:'',notes:''});
const saleDraft=(u,customerId,fields={})=>({unitId:u.id,lotId:u.lotId,modelId:u.modelId,customerId,quantity:1,unitPrice:800000,discount:0,paid:0,payment:'Pix',date,dueDate:'2026-12-01',chassis:u.chassis,notes:'',...fields});
const editUnit=(u,fields={})=>({id:u.id,revision:u.revision,modelId:u.modelId,lotId:u.lotId,chassis:u.chassis,condition:u.condition,price:u.price,unitCost:u.unitCost,image:u.image,odometer:u.odometer,year:u.year,date:u.receivedDate,notes:u.notes,registerPayment:false,payment:'Pix',...fields});

test('venda desconta custo individual, duas comissões, frete, montagem e rateio; pagamentos não duplicam o lucro',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gp-sale-profit-'));cookie='';
 try{
  await boot(dir);await setup();const lotId=await ok('stockLot',lotDraft),u1=await ok('stockUnit',{...unitDraft,lotId});let d=await data();const modelId=d.bikeUnits.find(u=>u.id===u1).modelId;
  const u2=await ok('stockUnit',{...unitDraft,newModel:undefined,modelId,lotId,chassis:'LUCRO-CHASSI-02',unitCost:600000}),customerId=await ok('customer',customerDraft);
  await ok('expense',{...expenseDraft,description:'Montagem de duas motos',lotId,unitAmount:30000});
  await ok('expense',{...expenseDraft,description:'Gasto exclusivo desta moto',unitId:u1,unitAmount:5000});
  const extras=[commission('Funcionário A',20000,20000),commission('Funcionário B',10000),{...commission('Transportador',15000),category:'Frete / entrega',description:'Entrega da moto'},{...commission('Montador',8000,8000),category:'Montagem',description:'Montagem final'}];
  d=await data();assert.equal(previewBikeProfit(d,u1,800000,53000).profit,227000);assert.equal(previewBikeProfit(d,u2,800000).profit,185000);
  const u=d.bikeUnits.find(u=>u.id===u1),payload=saleDraft(u,customerId,{unitPrice:850000,discount:50000,paid:300000,expenses:extras}),key=randomUUID(),saleId=await ok('sale',payload,key);assert.equal(await ok('sale',payload,key),saleId);
  d=await data();let r=saleProfit(d,d.sales.find(s=>s.id===saleId));assert.equal(r.revenue,800000);assert.equal(r.cost,500000);assert.equal(r.expenses,73000);assert.equal(r.profit,227000);assert.equal(r.partial,false);assert.equal(r.paidExpenses,28000);assert.equal(r.pendingExpenses,45000);assert.equal(r.units[0].profit,r.profit);assert.equal(r.details.filter(x=>x.expense.category==='Comissão').length,2);assert.equal(d.expenses.length,6);assert.equal(d.ledger.filter(e=>e.expenseId).length,2);assert.equal(d.bikeUnits.find(u=>u.id===u1).status,'sold');assert.equal(d.bikeUnits.find(u=>u.id===u2).status,'available');
  const month=monthlyResult(d,'2026-11');assert.equal(month.operating,88000);assert.equal(month.result,212000);assert.equal(month.cashOut,28000);assert.equal(month.cashIn,300000);
  const pending=d.expenses.find(e=>e.saleId===saleId&&e.payee==='Funcionário B'),payKey=randomUUID(),payment={id:pending.id,revision:pending.revision,amount:10000,payment:'Pix',date:'2026-12-03'};await ok('payExpense',payment,payKey);await ok('payExpense',payment,payKey);
  d=await data();r=saleProfit(d,d.sales.find(s=>s.id===saleId));assert.equal(r.profit,227000);assert.equal(r.pendingExpenses,35000);assert.equal(monthlyResult(d,'2026-11').result,month.result);assert.equal(monthlyResult(d,'2026-12').operating,0);assert.equal(monthlyResult(d,'2026-12').cashOut,10000);
  const second=await ok('sale',saleDraft(d.bikeUnits.find(u=>u.id===u2),customerId));d=await data();assert.equal(saleProfit(d,d.sales.find(s=>s.id===second)).profit,185000);assert.equal(d.sales.reduce((n,s)=>n+saleProfit(d,s).profit,0),monthlyResult(d,'2026-11').result);
  const before={expenses:d.expenses,totals:d.sales.map(s=>[s.id,saleProfit(d,s).profit]).sort()};await stop();await boot(dir);d=await data();assert.deepEqual(d.expenses,before.expenses);assert.deepEqual(d.sales.map(s=>[s.id,saleProfit(d,s).profit]).sort(),before.totals);
  const expenseCount=d.expenses.length;await ok('cancelSale',{id:saleId,revision:d.sales.find(s=>s.id===saleId).revision});d=await data();assert.equal(d.expenses.length,expenseCount);assert.ok(d.expenses.every(e=>e.status==='active'));assert.equal(d.bikeUnits.find(u=>u.id===u1).status,'available');assert.equal(d.sales.filter(s=>s.status==='active').length,1);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});

test('rateio conserva centavos e acompanha o chassi na transferência sem diluir custos antigos com novas motos',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gp-profit-allocation-'));cookie='';
 try{
  await boot(dir);await setup();const lotId=await ok('stockLot',lotDraft),first=await ok('stockUnit',{...unitDraft,lotId});let d=await data();const modelId=d.bikeUnits.find(u=>u.id===first).modelId,ids=[first];
  for(let i=2;i<=3;i++)ids.push(await ok('stockUnit',{...unitDraft,newModel:undefined,modelId,lotId,chassis:'RATEIO-'+i}));
  const expenseId=await ok('expense',{...expenseDraft,lotId,unitAmount:100,paid:99,paymentDate:date});d=await data();const shares=new Map(ids.map(id=>[id,previewBikeProfit(d,id,800000).registered]));assert.equal([...shares.values()].reduce((n,v)=>n+v,0),100);assert.deepEqual([...shares.values()].sort((a,b)=>a-b),[33,33,34]);
  const extra=await ok('stockUnit',{...unitDraft,newModel:undefined,modelId,lotId,chassis:'MOTO-ADICIONADA-DEPOIS'});d=await data();assert.equal(previewBikeProfit(d,extra,800000).registered,0);for(const id of ids)assert.equal(previewBikeProfit(d,id,800000).registered,shares.get(id));
  const target=await ok('stockLot',{...lotDraft,code:'LOTE DESTINO LUCRO'});await ok('stockUnit',editUnit(d.bikeUnits.find(u=>u.id===first),{lotId:target}));d=await data();assert.equal(previewBikeProfit(d,first,800000).registered,shares.get(first));assert.deepEqual(JSON.parse(d.expenses.find(e=>e.id===expenseId).allocationUnits).sort(),ids.sort());
  const customerId=await ok('customer',customerDraft);for(const id of ids){d=await data();await ok('sale',saleDraft(d.bikeUnits.find(u=>u.id===id),customerId));}d=await data();const profits=d.sales.map(s=>saleProfit(d,s));assert.equal(profits.reduce((n,p)=>n+p.expenses,0),100);assert.equal(profits.reduce((n,p)=>n+p.paidExpenses,0),99);assert.ok(profits.every(p=>p.pendingExpenses>=0));
  const general=await ok('expense',{...expenseDraft,unitAmount:50000,description:'Despesa geral da loja'});d=await data();assert.equal(d.expenses.find(e=>e.id===general).allocationUnits,'[]');assert.equal(d.sales.map(s=>saleProfit(d,s)).reduce((n,p)=>n+p.expenses,0),100,'Despesa geral fica somente no resultado da loja');
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});

test('despesa antes de receber compra é rateada na chegada; frete da compra integra custo uma única vez',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gp-profit-purchase-'));cookie='';
 try{
  await boot(dir);await setup();const modelId=await ok('model',{name:'Moto do fornecedor',brand:'',power:'',rangeKm:0,battery:'',color:'Preta',cost:500000,price:800000,minStock:0,initialStock:0,image:''}),customerId=await ok('customer',customerDraft);
  const purchaseId=await ok('purchase',{lotCode:'LOTE FRETE',date,supplier:'Fornecedor teste',buyer:'Comprador',carrier:'Frete teste',expectedDate:date,freight:30000,status:'in_transit',notes:'',items:[{modelId,quantity:3,unitCost:500000}]});
  const expenseId=await ok('expense',{...expenseDraft,description:'Viagem da compra',category:'Viagem para compra',purchaseId,unitAmount:30000});let d=await data();assert.equal(d.expenses[0].allocationUnits,'');
  await ok('receivePurchase',{id:purchaseId,revision:0,date,registerPayment:false,payment:'Pix'});d=await data();assert.equal(JSON.parse(d.expenses.find(e=>e.id===expenseId).allocationUnits).length,3);const u=d.bikeUnits[0];assert.equal(u.unitCost,510000);assert.equal(previewBikeProfit(d,u.id,800000).profit,280000);
  const saleId=await ok('sale',saleDraft(u,customerId));d=await data();const p=saleProfit(d,d.sales.find(s=>s.id===saleId));assert.equal(p.cost,510000);assert.equal(p.expenses,10000);assert.equal(p.profit,280000);assert.equal(p.details.length,1);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});

test('venda e despesas são atômicas, idempotentes e validadas; concorrência não duplica comissão',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gp-profit-atomic-'));cookie='';
 try{
  await boot(dir);await setup();const lotId=await ok('stockLot',lotDraft),unitId=await ok('stockUnit',{...unitDraft,lotId}),customerId=await ok('customer',customerDraft);let d=await data();const draft=saleDraft(d.bikeUnits.find(u=>u.id===unitId),customerId,{paid:800000,dueDate:'',expenses:[commission('Funcionário teste',20000,20000)]});
  for(const invalid of [{...commission('',1000)},{...commission('Funcionário',1000),paid:1001,paymentDate:date},{...commission('Funcionário',1000),dueDate:''},{...commission('Funcionário',0)},{...commission('Funcionário',1000),amount:1.5}])assert.equal((await action('sale',{...draft,expenses:[invalid]})).r.status,400);
  assert.equal((await action('sale',{...draft,unitId:'inexistente'})).r.status,400);d=await data();assert.equal(d.sales.length,0);assert.equal(d.expenses.length,0);assert.equal(d.ledger.length,0);assert.equal(d.bikeUnits[0].status,'available');
  const key=randomUUID(),race=await Promise.all([action('sale',draft,key),action('sale',draft)]);assert.deepEqual(race.map(x=>x.r.status).sort(),[200,400]);const winner=race.find(x=>x.r.status===200);if(race[0].r.status===200)assert.equal(await ok('sale',draft,key),winner.j.id);d=await data();assert.equal(d.sales.length,1);assert.equal(d.expenses.length,1);assert.equal(d.ledger.filter(e=>e.type==='out').length,1);assert.equal(d.models[0].stock,0);
  assert.equal((await action('expense',{...expenseDraft,unitId,lotId})).r.status,400);assert.equal((await action('expense',{...expenseDraft,unitId:'fora-do-escopo'})).r.status,400);
  const inspect=new DatabaseSync(join(dir,'gp-performance.sqlite'));inspect.exec('PRAGMA foreign_keys=ON');assert.deepEqual(inspect.prepare('PRAGMA foreign_key_check').all(),[]);assert.throws(()=>inspect.prepare('UPDATE expenses SET unitId=? WHERE saleId IS NOT NULL').run(unitId));inspect.close();
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});

test('migração preserva vendas antigas, fotos, despesas e financeiro e completa rateios existentes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gp-profit-upgrade-'));cookie='';
 try{
  const old=new DatabaseSync(join(dir,'gp-performance.sqlite'));old.exec('PRAGMA foreign_keys=ON;CREATE TABLE app_migrations(name TEXT PRIMARY KEY,hash TEXT NOT NULL,appliedAt TEXT NOT NULL)');
  for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')&&n<'0009').sort()){const sql=readFileSync(join('drizzle',name),'utf8');old.exec(sql);old.prepare('INSERT INTO app_migrations VALUES (?,?,?)').run(name,createHash('sha256').update(sql).digest('hex'),date);}
  old.prepare("INSERT INTO models(id,scope,name,stock,cost,price,createdAt) VALUES ('m','gp-store','Moto anterior',1,500000,800000,?)").run(date);
  old.prepare("INSERT INTO customers(id,scope,name,createdAt) VALUES ('c','gp-store','Cliente anterior',?)").run(date);
  old.prepare("INSERT INTO stockLots(id,scope,code,createdAt) VALUES ('l','gp-store','LOTE ANTERIOR',?)").run(date);
  old.prepare("INSERT INTO stockLotBalances(id,scope,lotId,modelId,quantity,unitCost,createdAt) VALUES ('b','gp-store','l','m',1,500000,?)").run(date);
  for(const [id,status] of [['u1','sold'],['u2','available']])old.prepare("INSERT INTO bikeUnits(id,scope,modelId,lotId,chassis,chassisKey,status,condition,price,unitCost,image,createdAt) VALUES (?,'gp-store','m','l',?,?,?,'used',800000,500000,'/images/catalogo/tank-cinza.jpg',?)").run(id,'ANTERIOR-'+id,'ANTERIOR'+id,status,date);
  old.prepare("INSERT INTO sales(id,scope,number,customerId,modelId,quantity,unitPrice,cost,total,paid,payment,date,createdAt) VALUES ('s','gp-store','GP-ANTERIOR','c','m',1,800000,500000,800000,800000,'Pix',?,?)").run(date,date);
  old.prepare("INSERT INTO saleUnits(id,scope,saleId,unitId,modelId,lotId,chassis,condition,unitCost,createdAt) VALUES ('su','gp-store','s','u1','m','l','ANTERIOR-u1','used',500000,?)").run(date);
  old.prepare("INSERT INTO expenses(id,scope,description,category,lotId,quantity,unitAmount,amount,date,dueDate,createdAt) VALUES ('e','gp-store','Montagem anterior','Montagem','l',1,1001,1001,?,'2026-12-01',?)").run(date,date);
  old.prepare("INSERT INTO ledger(id,scope,type,amount,description,category,payment,date,createdAt) VALUES ('entrada','gp-store','in',800000,'Venda anterior','Venda','Pix',?,?)").run(date,date);old.close();
  await boot(dir);await setup();let d=await data();assert.equal(d.sales.length,1);assert.equal(d.ledger.length,1);assert.equal(d.expenses[0].amount,1001);assert.equal(d.expenses[0].paid,0);assert.equal(d.expenses[0].unitId,null);assert.deepEqual(JSON.parse(d.expenses[0].allocationUnits),['u1','u2']);assert.ok(d.bikeUnits.every(u=>u.image==='/images/catalogo/tank-cinza.jpg'&&u.condition==='used'));const p=saleProfit(d,d.sales[0]);assert.equal(p.expenses,501);assert.equal(p.profit,299499);assert.equal(p.partial,false);assert.ok(readdirSync(join(dir,'backups')).some(n=>n.startsWith('antes-iniciar-')));
  await stop();await boot(dir);d=await data();assert.equal(d.ledger.length,1);assert.equal(d.expenses.length,1);assert.equal(saleProfit(d,d.sales[0]).profit,299499);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});

test('demonstração, custos pendentes, prejuízo e venda de várias motos conservam totais',()=>{
 let d=demoAction(emptyData(),'stockLot',validate('stockLot',lotDraft));const lotId=d.stockLots[0].id;d=demoAction(d,'stockUnit',validate('stockUnit',{...unitDraft,lotId}));const unit=d.bikeUnits[0];d=demoAction(d,'stockUnit',validate('stockUnit',{...unitDraft,newModel:undefined,modelId:unit.modelId,lotId,chassis:'LUCRO-OUTRO',unitCost:null}));d=demoAction(d,'customer',customerDraft);const customerId=d.customers[0].id;
 d=demoAction(d,'expense',validate('expense',{...expenseDraft,lotId,unitAmount:101}));
 d=demoAction(d,'sale',validate('sale',saleDraft(unit,customerId,{unitId:undefined,quantity:2,unitPrice:200000,expenses:[commission('Funcionario A',10000),commission('Funcionario B',10000)]})));const p=saleProfit(d,d.sales[0]);assert.equal(p.partial,true);assert.equal(p.profit,400000-500000-20101);assert.equal(p.units.reduce((n,u)=>n+u.revenue,0),p.revenue);assert.equal(p.units.reduce((n,u)=>n+u.expenses,0),p.expenses);assert.equal(p.units.reduce((n,u)=>n+u.profit,0),p.profit);assert.equal(d.expenses.length,3);
 const loss=previewBikeProfit({...d,bikeUnits:d.bikeUnits.map(u=>({...u,unitCost:500000}))},unit.id,400000,10000);assert.ok(loss.profit<0);assert.equal(loss.partial,false);
 const old={...d.sales[0],id:'old',quantity:1,costKnown:1};assert.equal(saleProfit(d,old).partial,true);
 assert.deepEqual([...splitCents(1,['b','a','c']).entries()],[['a',1],['b',0],['c',0]]);
});
