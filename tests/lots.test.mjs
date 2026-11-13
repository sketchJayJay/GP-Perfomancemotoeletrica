import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const dir=mkdtempSync(join(tmpdir(),'gp-coolify-test-'));
let proc,base,cookie='';
const password=randomBytes(20).toString('base64url');
async function boot(){
 proc=spawn(process.execPath,['build/server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:'0',HOST:'127.0.0.1',PUBLIC_URL:'',DATA_DIR:dir,SEED_GP_BIKES:'0',DISABLE_SCHEDULER:'1',ZAPI_INSTANCE_ID:'',ZAPI_TOKEN:'',ZAPI_CLIENT_TOKEN:'',ADMIN_USERNAME:'',ADMIN_PASSWORD:''},stdio:['ignore','pipe','pipe']});
 let log='';await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Servidor não iniciou: '+log)),15000);proc.stdout.on('data',chunk=>{log+=chunk;const match=log.match(/pronta na porta (\d+)/);if(match){base='http://127.0.0.1:'+match[1];clearTimeout(timeout);resolve();}});proc.stderr.on('data',chunk=>{log+=chunk;});proc.once('exit',code=>{clearTimeout(timeout);reject(Error('Servidor encerrou '+code+': '+log));});});
}
async function stop(){const p=proc;proc=null;if(!p||p.exitCode!==null)return;await new Promise(resolve=>{p.once('exit',resolve);p.kill('SIGTERM');});}
async function api(path,body,options={}){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...options.headers},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();return {r,j};}
async function action(name,payload,requestId=randomUUID()){return api('/api/action',{action:name,payload,requestId});}


const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const month=date.slice(0,7);
const {monthlyResult}=await import('../lib/monthly.ts');
test('lotes: origem persiste até a venda; baixa, estorno, custo real e migração são consistentes',async()=>{
 try{
 const old=new DatabaseSync(join(dir,'gp-performance.sqlite'));
 old.exec('PRAGMA foreign_keys=ON;CREATE TABLE app_migrations(name TEXT PRIMARY KEY,hash TEXT NOT NULL,appliedAt TEXT NOT NULL)');
 for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')&&n<'0005').sort()){
  const sql=readFileSync(join('drizzle',name),'utf8');old.exec(sql);old.prepare('INSERT INTO app_migrations VALUES (?,?,?)').run(name,createHash('sha256').update(sql).digest('hex'),date);
 }
 old.prepare("INSERT INTO models(id,scope,name,cost,price,stock,createdAt) VALUES ('antigo','gp-store','Moto existente',50000,400000,3,'2020-01-01')").run();
 old.prepare("INSERT INTO customers(id,scope,name,createdAt) VALUES ('cliente','gp-store','Cliente fictício','2020-01-01')").run();
 old.prepare("INSERT INTO sales(id,scope,number,customerId,modelId,quantity,unitPrice,cost,total,paid,payment,date,createdAt) VALUES ('antiga','gp-store','VENDA ANTIGA','cliente','antigo',1,70000,50000,70000,70000,'Pix','2020-01-01','2020-01-01')").run();old.close();
 await boot();const setup=await api('/api/auth/setup',{username:'teste',password});cookie=setup.r.headers.get('set-cookie').split(';')[0];
 let d=(await api('/api/data')).j;assert.equal(d.models[0].stock,3);assert.equal(d.sales.find(s=>s.id==='antiga').cost,50000);assert.equal(d.stockLots[0].code,'ESTOQUE ANTERIOR');assert.equal(d.stockLotBalances[0].quantity,3);assert.equal(d.saleLots.length,0);
 const legacyId=d.stockLots[0].id;
 assert.equal((await action('assignLot',{modelId:'antigo',fromLotId:legacyId,quantity:1,lotCode:'ANTIGO 01',date})).r.status,200);
 d=(await api('/api/data')).j;assert.equal(d.models[0].stock,3);assert.equal(d.stockLotBalances.find(b=>b.lotId===legacyId).quantity,2);assert.equal(d.ledger.length,0);
 const createPurchase=async(code,quantity,unitCost,freight)=>{const payload={lotCode:code,date,supplier:'Fornecedor '+code,buyer:'Gigante',carrier:'Transportador '+code,expectedDate:date,freight,status:'in_transit',notes:'',items:[{modelId:'antigo',quantity,unitCost}]};const created=await action('purchase',payload);assert.equal(created.r.status,200,JSON.stringify(created.j));const received=await action('receivePurchase',{id:created.j.id,revision:0,date,registerPayment:true,payment:'Pix'});assert.equal(received.r.status,200,JSON.stringify(received.j));return {payload,id:created.j.id};};
 const one=await createPurchase('LOTE 001',2,100000,10000),two=await createPurchase('LOTE 002',2,200000,20000);await createPurchase('LOTE 003',1,300000,0);
 d=(await api('/api/data')).j;assert.equal(d.models[0].stock,8);assert.equal(d.stockLots.find(l=>l.code==='LOTE 001').supplier,'Fornecedor LOTE 001');assert.equal(d.purchases.find(p=>p.id===one.id).carrier,'Transportador LOTE 001');
 const idFor=code=>d.stockLots.find(l=>l.code===code).id,l1=idFor('LOTE 001'),l2=idFor('LOTE 002'),l3=idFor('LOTE 003');
 const sale={customerId:'cliente',modelId:'antigo',quantity:1,unitPrice:400000,discount:0,paid:100000,payment:'Pix',dueDate:date,date,chassis:'CHASSI-TESTE',notes:'',lotId:l1};
 const key=randomUUID(),sold=await action('sale',sale,key);assert.equal(sold.r.status,200);assert.equal((await action('sale',sale,key)).j.id,sold.j.id);
 d=(await api('/api/data')).j;assert.equal(d.sales.find(s=>s.id===sold.j.id).cost,105000);assert.equal(d.saleLots.find(s=>s.saleId===sold.j.id).lotId,l1);assert.equal(d.stockLotBalances.find(b=>b.lotId===l1).quantity,1);assert.equal(d.stockLotBalances.find(b=>b.lotId===l2).quantity,2);
 assert.equal((await action('sale',{...sale,lotId:l3,quantity:2,paid:0})).r.status,400);
 const soldTwo=await action('sale',{...sale,lotId:l2,paid:400000});assert.equal(soldTwo.r.status,200);
 assert.equal((await action('movement',{modelId:'antigo',lotCode:'LOTE 002',kind:'entrada',quantity:1,unitCost:500000,reference:'Ajuste de teste',notes:'',date,registerPayment:false,payment:'Pix'})).r.status,200);
 d=(await api('/api/data')).j;assert.equal(d.sales.find(s=>s.id===soldTwo.j.id).cost,210000);
 assert.equal((await action('cancelSale',{id:soldTwo.j.id,revision:0})).r.status,200);
 d=(await api('/api/data')).j;assert.equal(d.stockLotBalances.find(b=>b.lotId===l2).quantity,3);assert.equal(d.stockLotBalances.find(b=>b.lotId===l1).quantity,1);assert.equal(d.saleLots.find(s=>s.saleId===soldTwo.j.id).lotId,l2);
 const entry={type:'out',amount:50000,description:'Aluguel teste',category:'Despesa operacional',payment:'Pix',date};assert.equal((await action('entry',entry)).r.status,200);await action('entry',{...entry,amount:10000,category:'Retirada',description:'Retirada teste'});await action('entry',{...entry,type:'in',amount:20000,category:'Aporte',description:'Aporte teste'});
 d=(await api('/api/data')).j;const result=monthlyResult(d,month);assert.equal(result.revenue,400000);assert.equal(result.cost,105000);assert.equal(result.operating,50000);assert.equal(result.result,245000);assert.equal(result.withdrawals,10000);assert.equal(result.cash,-870000);
 const both=await Promise.all([action('sale',{...sale,lotId:l3,paid:400000}),action('sale',{...sale,lotId:l3,paid:400000})]);assert.deepEqual(both.map(x=>x.r.status).sort(),[200,400]);
 d=(await api('/api/data')).j;assert.equal(d.stockLotBalances.find(b=>b.lotId===l3).quantity,0);assert.equal(d.models.find(m=>m.id==='antigo').stock,d.stockLotBalances.filter(b=>b.modelId==='antigo').reduce((n,b)=>n+b.quantity,0));
 assert.equal((await action('purchase',{...one.payload,lotCode:'LOTE 001'})).r.status,400);

 const oldCancel=await action('cancelSale',{id:'antiga',revision:0});assert.equal(oldCancel.r.status,200,JSON.stringify(oldCancel.j));
 d=(await api('/api/data')).j;const oldReturn=d.stockLots.find(l=>l.code==='ESTORNO ANTERIOR');assert.ok(oldReturn);assert.equal(d.stockLotBalances.find(b=>b.lotId===oldReturn.id).quantity,1);
 const extra={name:'Teste FIFO',brand:'',power:'',rangeKm:0,battery:'',color:'Preta',cost:100,price:1000,minStock:0,initialStock:1,initialLotCode:'FIFO 001',image:''};const extraId=(await action('model',extra)).j.id;
 await action('movement',{modelId:extraId,kind:'entrada',quantity:1,unitCost:200,lotCode:'FIFO 002',reference:'Teste',notes:'',date,registerPayment:false,payment:'Pix'});
 const fifoSale=await action('sale',{...sale,modelId:extraId,lotId:undefined,quantity:2,unitPrice:1000,paid:2000});assert.equal(fifoSale.r.status,200,JSON.stringify(fifoSale.j));d=(await api('/api/data')).j;assert.equal(d.sales.find(s=>s.id===fifoSale.j.id).cost,300);assert.equal(d.saleLots.filter(s=>s.saleId===fifoSale.j.id).length,2);assert.equal((await action('cancelSale',{id:fifoSale.j.id,revision:0})).r.status,200);
 d=(await api('/api/data')).j;assert.equal(d.stockLotBalances.filter(b=>b.modelId===extraId).reduce((n,b)=>n+b.quantity,0),2);
 const before=JSON.stringify(d.stockLotBalances.map(b=>({id:b.id,quantity:b.quantity,unitCost:b.unitCost})).sort((a,b)=>a.id.localeCompare(b.id)));
 await stop();await boot();d=(await api('/api/data')).j;assert.equal(JSON.stringify(d.stockLotBalances.map(b=>({id:b.id,quantity:b.quantity,unitCost:b.unitCost})).sort((a,b)=>a.id.localeCompare(b.id))),before);assert.equal(d.models.find(m=>m.id==='antigo').stock,d.stockLotBalances.filter(b=>b.modelId==='antigo').reduce((n,b)=>n+b.quantity,0));
 const backup=await fetch(base+'/api/backup/sqlite',{headers:{Cookie:cookie}});const file=join(dir,'lotes.sqlite');writeFileSync(file,new Uint8Array(await backup.arrayBuffer()));const db=new DatabaseSync(file,{readOnly:true});assert.equal(db.prepare('SELECT count(*) AS n FROM stockLots').get().n,d.stockLots.length);assert.equal(db.prepare('SELECT count(*) AS n FROM saleLots').get().n,d.saleLots.length);db.close();
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});
