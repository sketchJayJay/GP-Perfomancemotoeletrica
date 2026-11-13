import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {monthlyResult} from '../lib/monthly.ts';
import {providedBikes} from '../lib/provided-bikes.ts';
import {emptyData,demoAction} from '../lib/domain.ts';
import {validate} from '../lib/validation.ts';

let proc,base,cookie='';
const date='2026-11-13';
async function boot(dir,seed=false){
 proc=spawn(process.execPath,['build/server.mjs'],{cwd:process.cwd(),env:{...process.env,DATA_DIR:dir,PORT:'0',HOST:'127.0.0.1',PUBLIC_URL:'',SEED_GP_BIKES:seed?'1':'0',DISABLE_SCHEDULER:'1',ZAPI_INSTANCE_ID:'',ZAPI_TOKEN:'',ZAPI_CLIENT_TOKEN:'',ADMIN_USERNAME:'',ADMIN_PASSWORD:''},stdio:['ignore','pipe','pipe']});
 let log='';await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Servidor não iniciou: '+log)),15000);proc.stdout.on('data',chunk=>{log+=chunk;const match=log.match(/pronta na porta (\d+)/);if(match){base='http://127.0.0.1:'+match[1];clearTimeout(timer);resolve();}});proc.stderr.on('data',chunk=>{log+=chunk;});proc.once('exit',code=>{clearTimeout(timer);reject(Error('Servidor encerrou '+code+': '+log));});});
}
async function stop(){const p=proc;proc=null;if(!p||p.exitCode!==null)return;await new Promise(resolve=>{p.once('exit',resolve);p.kill('SIGTERM');});}
async function api(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {r,j:await r.json()};}
const action=(action,payload,requestId=randomUUID())=>api('/api/action',{action,payload,requestId});
const data=async()=>(await api('/api/data')).j;
async function setup(){const r=await api('/api/auth/setup',{username:'teste',password:randomBytes(20).toString('base64url')});assert.equal(r.r.status,200);cookie=r.r.headers.get('set-cookie').split(';')[0];}
async function ok(name,payload,key){const r=await action(name,payload,key);assert.equal(r.r.status,200,JSON.stringify(r.j));return r.j.id;}
const lotDraft={code:'LOTE CHASSIS',supplier:'Fornecedor fictício',carrier:'Frete fictício',receivedDate:date,notes:''};
const unitDraft={newModel:{name:'Moto por chassi',color:'Preta',brand:''},chassis:'ABC12345678901234',condition:'used',price:800000,unitCost:100000,image:'',odometer:4700,year:2024,date,notes:'',registerPayment:false,payment:'Pix'};
const edit=(u,fields={})=>({id:u.id,revision:u.revision,modelId:u.modelId,lotId:u.lotId,chassis:u.chassis,condition:u.condition,price:u.price,unitCost:u.unitCost,image:u.image,odometer:u.odometer,year:u.year,date:u.receivedDate,notes:u.notes,registerPayment:false,payment:'Pix',...fields});
function reconciles(d){for(const m of d.models)assert.equal(m.stock,d.bikeUnits.filter(u=>u.modelId===m.id&&u.status==='available').length,'Saldo do modelo '+m.name);for(const b of d.stockLotBalances)assert.equal(b.quantity,d.bikeUnits.filter(u=>u.modelId===b.modelId&&u.lotId===b.lotId&&u.status==='available').length,'Saldo do lote');}

test('motos por chassi: migração, usadas, custo individual, baixa exata, estorno e identificação preservados',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gp-units-'));cookie='';
 try{
  const old=new DatabaseSync(join(dir,'gp-performance.sqlite'));old.exec('PRAGMA foreign_keys=ON;CREATE TABLE app_migrations(name TEXT PRIMARY KEY,hash TEXT NOT NULL,appliedAt TEXT NOT NULL)');
  for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')&&n<'0007').sort()){const sql=readFileSync(join('drizzle',name),'utf8');old.exec(sql);old.prepare('INSERT INTO app_migrations VALUES (?,?,?)').run(name,createHash('sha256').update(sql).digest('hex'),date);}
  old.prepare("INSERT INTO models(id,scope,name,cost,price,stock,createdAt) VALUES ('legado','gp-store','Modelo anterior',50000,800000,2,?)").run(date);old.close();
  await boot(dir);await setup();let d=await data();assert.equal(d.bikeUnits.length,2);assert.ok(d.bikeUnits.every(u=>u.chassis===''&&u.condition==='unknown'&&u.unitCost===50000));reconciles(d);
  const lotId=await ok('stockLot',lotDraft);d=await data();assert.equal(d.models[0].stock,2);assert.equal(d.bikeUnits.length,2);assert.equal((await action('stockLot',{...lotDraft,code:'lote chassis'})).r.status,400);
  const u1=await ok('stockUnit',{...unitDraft,lotId});d=await data();const modelId=d.bikeUnits.find(u=>u.id===u1).modelId;
  const u2=await ok('stockUnit',{...unitDraft,newModel:undefined,modelId,lotId,chassis:'ABC12345678901235',condition:'new',unitCost:200000,price:950000,odometer:null,year:null});
  assert.equal((await action('stockUnit',{...unitDraft,lotId,chassis:'abc-12345678901234'})).r.status,400);d=await data();assert.equal(d.models.find(m=>m.id===modelId).cost,150000);assert.equal(d.bikeUnits.find(u=>u.id===u1).odometer,4700);
  const customerId=await ok('customer',{name:'Cliente fictício',phone:'',document:'',birthday:'',email:'',city:'',address:'',notes:'',consent:0});
  const sale={unitId:u1,lotId,modelId,customerId,quantity:1,unitPrice:800000,discount:0,paid:800000,payment:'Pix',date,dueDate:'',chassis:unitDraft.chassis,notes:''};
  assert.equal((await action('sale',{...sale,quantity:2,paid:0})).r.status,400);assert.equal((await action('sale',{...sale,lotId:d.stockLots.find(l=>l.code==='ESTOQUE ANTERIOR').id})).r.status,400);
  const key=randomUUID(),saleId=await ok('sale',sale,key);assert.equal(await ok('sale',sale,key),saleId);d=await data();assert.equal(d.bikeUnits.find(u=>u.id===u1).status,'sold');assert.equal(d.bikeUnits.find(u=>u.id===u2).status,'available');assert.equal(d.sales.find(s=>s.id===saleId).cost,100000);assert.equal(d.sales.find(s=>s.id===saleId).chassis,unitDraft.chassis);assert.equal(d.saleUnits.find(s=>s.saleId===saleId).condition,'used');assert.equal(d.models.find(m=>m.id===modelId).cost,200000);
  const second={...sale,unitId:u2,chassis:'ABC12345678901235',unitPrice:950000,paid:950000},race=await Promise.all([action('sale',second),action('sale',second)]);assert.deepEqual(race.map(r=>r.r.status).sort(),[200,400]);const winner=race.find(r=>r.r.status===200).j.id;
  await ok('cancelSale',{id:winner,revision:0});await ok('cancelSale',{id:saleId,revision:0});d=await data();assert.equal(d.bikeUnits.find(u=>u.id===u1).status,'available');assert.equal(d.bikeUnits.find(u=>u.id===u1).chassis,unitDraft.chassis);assert.equal(d.bikeUnits.find(u=>u.id===u1).condition,'used');assert.equal(d.models.find(m=>m.id===modelId).stock,2);reconciles(d);
  const target=await ok('stockLot',{...lotDraft,code:'LOTE DESTINO'});await ok('stockUnit',edit(d.bikeUnits.find(u=>u.id===u1),{lotId:target}));d=await data();assert.equal(d.bikeUnits.find(u=>u.id===u1).lotId,target);assert.equal(d.stockLotBalances.find(b=>b.lotId===lotId&&b.modelId===modelId).quantity,1);
  await ok('stockUnit',edit(d.bikeUnits.find(u=>u.id===u1),{unitCost:120000}));d=await data();assert.equal(d.sales.find(s=>s.id===saleId).cost,100000,'Custo de venda anterior permanece registrado');
  await ok('movement',{unitId:u2,lotId,modelId,kind:'saida',quantity:1,unitCost:200000,date,reference:'Devolução de teste',notes:'',registerPayment:false,payment:'Pix'});d=await data();assert.equal(d.bikeUnits.find(u=>u.id===u2).status,'out');assert.ok(d.movements.some(m=>m.unitId===u2&&m.kind==='saida'));
  const missing=await ok('stockUnit',{...unitDraft,newModel:undefined,modelId,lotId:target,chassis:'',condition:'unknown',unitCost:null,odometer:null,year:null});
  const unknownSale=await ok('sale',{...sale,unitId:missing,lotId:target,chassis:''});d=await data();assert.equal(d.sales.find(s=>s.id===unknownSale).costKnown,0);assert.equal(monthlyResult(d,'2026-11').incompleteCosts,1);
  await ok('stockUnit',edit(d.bikeUnits.find(u=>u.id===missing),{unitCost:320000,chassis:'PENDENTE-001'}));d=await data();assert.equal(d.sales.find(s=>s.id===unknownSale).costKnown,1);assert.equal(d.sales.find(s=>s.id===unknownSale).cost,320000);assert.equal(d.sales.find(s=>s.id===unknownSale).chassis,'PENDENTE-001');assert.equal(monthlyResult(d,'2026-11').incompleteCosts,0);
  assert.equal((await action('stockUnit',edit(d.bikeUnits.find(u=>u.id===missing),{unitCost:400000}))).r.status,400);assert.equal((await action('stockUnit',edit(d.bikeUnits.find(u=>u.id===missing),{condition:'used'}))).r.status,400);reconciles(d);
  const before=d.bikeUnits.map(u=>({id:u.id,chassis:u.chassis,status:u.status,unitCost:u.unitCost,lotId:u.lotId})).sort((a,b)=>a.id.localeCompare(b.id));await stop();await boot(dir);d=await data();assert.deepEqual(d.bikeUnits.map(u=>({id:u.id,chassis:u.chassis,status:u.status,unitCost:u.unitCost,lotId:u.lotId})).sort((a,b)=>a.id.localeCompare(b.id)),before);reconciles(d);
  const snapshot=await fetch(base+'/api/backup/sqlite',{headers:{Cookie:cookie}});assert.equal(snapshot.status,200);const file=join(dir,'units-backup.sqlite');writeFileSync(file,new Uint8Array(await snapshot.arrayBuffer()));const db=new DatabaseSync(file,{readOnly:true});assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('SELECT count(*) AS n FROM bikeUnits').get().n,d.bikeUnits.length);db.close();
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});

test('sete motos das fotos: cadastro único a R$ 8.000, seis chassis transcritos e dados ausentes pendentes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gp-provided-'));cookie='';
 try{
  await boot(dir,true);await setup();let d=await data();assert.equal(d.bikeUnits.length,7);assert.equal(d.models.length,7);assert.equal(d.ledger.length,0);assert.equal(d.dataImports.length,1);
  for(const b of providedBikes){const u=d.bikeUnits.find(u=>u.sourceKey?.endsWith('/'+b.key));assert.ok(u,b.key);assert.equal(u.chassis,b.chassis);assert.equal(u.price,800000);assert.equal(u.unitCost,null);assert.equal(u.condition,'unknown');assert.equal(u.image,b.image);assert.equal(d.models.find(m=>m.id===u.modelId).name,b.name);assert.equal((await fetch(base+b.image)).status,200);}
  const lot=d.stockLots.find(l=>l.code==='MOTOS-ENVIADAS-13112026');assert.equal(lot.receivedDate,'');await ok('stockLot',{...lotDraft,id:lot.id,revision:lot.revision,code:'LOTE 017'});const g=d.bikeUnits.find(u=>u.sourceKey?.endsWith('/gmax-branca'));assert.equal(g.chassis,'');await ok('stockUnit',edit(g,{chassis:'GMAX-EXEMPLO-007',condition:'used',odometer:1200,year:2023}));
  await stop();await boot(dir,true);d=await data();assert.equal(d.bikeUnits.length,7);assert.equal(d.dataImports.length,1);assert.equal(d.stockLots.length,1);assert.equal(d.stockLots[0].code,'LOTE 017');assert.equal(d.bikeUnits.find(u=>u.id===g.id).chassis,'GMAX-EXEMPLO-007');assert.equal(d.bikeUnits.find(u=>u.id===g.id).condition,'used');reconciles(d);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
 const overlap=mkdtempSync(join(tmpdir(),'gp-provided-existing-'));cookie='';
 try{
  await boot(overlap,false);await setup();const lotId=await ok('stockLot',lotDraft),id=await ok('stockUnit',{...unitDraft,lotId,newModel:{name:'Tank',color:'Cinza',brand:''},chassis:providedBikes[0].chassis,unitCost:222000,price:900000});await stop();await boot(overlap,true);const d=await data();assert.equal(d.bikeUnits.length,7);const u=d.bikeUnits.find(u=>u.id===id);assert.equal(u.unitCost,222000);assert.equal(u.condition,'used');assert.equal(u.price,800000);assert.equal(JSON.parse(d.dataImports[0].result).existing,1);assert.equal(JSON.parse(d.dataImports[0].result).added,6);reconciles(d);
 }finally{await stop();rmSync(overlap,{recursive:true,force:true});}
});

test('demonstração mantém chassi e condição na venda e no cancelamento',()=>{
 let d=demoAction(emptyData(),'stockLot',validate('stockLot',lotDraft));const lotId=d.stockLots[0].id;
 d=demoAction(d,'stockUnit',validate('stockUnit',{...unitDraft,lotId}));const u=d.bikeUnits[0];d=demoAction(d,'customer',{name:'Cliente fictício',phone:'',document:'',birthday:'',email:'',city:'',address:'',notes:'',consent:0});
 d=demoAction(d,'sale',validate('sale',{unitId:u.id,lotId,modelId:u.modelId,customerId:d.customers[0].id,quantity:1,unitPrice:800000,discount:0,paid:800000,payment:'Pix',date,dueDate:'',chassis:u.chassis,notes:''}));assert.equal(d.bikeUnits[0].status,'sold');assert.equal(d.saleUnits[0].unitId,u.id);assert.equal(d.saleUnits[0].condition,'used');
 d=demoAction(d,'cancelSale',{id:d.sales[0].id,revision:0});assert.equal(d.bikeUnits[0].status,'available');assert.equal(d.bikeUnits[0].chassis,unitDraft.chassis);assert.equal(d.bikeUnits[0].condition,'used');reconciles(d);
});
