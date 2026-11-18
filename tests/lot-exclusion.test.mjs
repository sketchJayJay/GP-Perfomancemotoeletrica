import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {emptyData,demoAction} from '../lib/domain.ts';
import {validate} from '../lib/validation.ts';
import {monthlyResult} from '../lib/monthly.ts';

// Compile the native server modules, including TypeScript parameter properties,
// the same way as the production server bundle.
const compiled=await build({stdin:{contents:"export {Database} from './lib/runtime.ts';export {bikeStatements} from './lib/bikes-server.ts';export {lotExclusionStatements} from './lib/lot-exclusion-server.ts';",resolveDir:process.cwd(),sourcefile:'lot-exclusion-test-entry.ts'},bundle:true,platform:'node',format:'esm',target:'node24',write:false});
const {Database,bikeStatements,lotExclusionStatements}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));

const date='2026-11-13',scope='gp-store',stamp=date+'T12:00:00Z';
const lotDraft={code:'LOTE EXCLUSÃO',supplier:'Fornecedor fictício',carrier:'Transporte fictício',receivedDate:date,notes:''};
const unitDraft={newModel:{name:'Moto de teste',color:'Preta',brand:''},chassis:'TESTE-EXCLUSAO-01',condition:'used',price:800000,unitCost:100000,image:'/images/catalogo/tank-cinza.jpg',odometer:1250,year:2024,date,notes:'Unidade fictícia',registerPayment:false,payment:'Pix'};
let proc,base,cookie='';
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
function reconciles(d){for(const m of d.models)assert.equal(m.stock,d.bikeUnits.filter(u=>u.modelId===m.id&&u.status==='available').length);for(const b of d.stockLotBalances)assert.equal(b.quantity,d.bikeUnits.filter(u=>u.modelId===b.modelId&&u.lotId===b.lotId&&u.status==='available').length);}
const requestFor=(d,id)=>({id,revision:d.stockLots.find(l=>l.id===id).revision});
const unitEdit=u=>({id:u.id,revision:u.revision,modelId:u.modelId,lotId:u.lotId,chassis:u.chassis,condition:u.condition,price:u.price,unitCost:u.unitCost,image:u.image,odometer:u.odometer,year:u.year,date:u.receivedDate,notes:u.notes,registerPayment:false,payment:'Pix'});

test('excluir e restaurar lote ajusta saldo, conserva identificação e financeiro e não restaura saídas anteriores',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gp-delete-lot-'));cookie='';
 try{
  await boot(dir);await setup();const lotId=await ok('stockLot',lotDraft),empty=await ok('stockLot',{...lotDraft,code:'LOTE VAZIO'});
  let d=await data();await ok('deleteLot',requestFor(d,empty));d=await data();assert.ok(d.stockLots.find(l=>l.id===empty).deletedAt);await ok('restoreLot',requestFor(d,empty));
  const u1=await ok('stockUnit',{...unitDraft,lotId});d=await data();const modelId=d.bikeUnits.find(u=>u.id===u1).modelId;
  const u2=await ok('stockUnit',{...unitDraft,newModel:undefined,modelId,lotId,chassis:'TESTE-EXCLUSAO-02',unitCost:null});
  const other=await ok('stockUnit',{...unitDraft,newModel:undefined,modelId,lotId:empty,chassis:'TESTE-OUTRO-LOTE',unitCost:250000});
  const out=await ok('stockUnit',{...unitDraft,newModel:undefined,modelId,lotId,chassis:'TESTE-SAIDA-ANTERIOR'});
  await ok('movement',{unitId:out,lotId,modelId,kind:'saida',quantity:1,unitCost:100000,date,reference:'Devolução anterior à exclusão',notes:'',registerPayment:false,payment:'Pix'});
  const expenseId=await ok('expense',{description:'Montagem do lote',category:'Montagem',payee:'Montador fictício',purchaseId:null,lotId,saleId:null,quantity:3,unitAmount:5000,paid:5000,date,dueDate:'2026-11-30',notes:'',payment:'Pix',paymentDate:date});
  const before=await data(),identities=before.bikeUnits.map(u=>({id:u.id,chassis:u.chassis,unitCost:u.unitCost,image:u.image,odometer:u.odometer,condition:u.condition,lotId:u.lotId}));
  const deletion=requestFor(before,lotId),key=randomUUID();const result=await ok('deleteLot',deletion,key);assert.equal(await ok('deleteLot',deletion,key),result);
  d=await data();assert.ok(d.stockLots.find(l=>l.id===lotId).deletedAt);assert.equal(d.bikeUnits.find(u=>u.id===u1).excludedWithLot,1);assert.equal(d.bikeUnits.find(u=>u.id===u2).excludedWithLot,1);assert.equal(d.bikeUnits.find(u=>u.id===out).excludedWithLot,0);assert.equal(d.bikeUnits.find(u=>u.id===other).status,'available');assert.equal(d.models.find(m=>m.id===modelId).stock,1);assert.equal(d.models.find(m=>m.id===modelId).cost,250000);reconciles(d);
  assert.equal(d.movements.filter(m=>m.kind==='exclusao_lote').length,2);assert.deepEqual(d.ledger,before.ledger);assert.deepEqual(d.expenses,before.expenses);assert.equal(d.expenses.find(e=>e.id===expenseId).paid,5000);assert.equal(monthlyResult(d,'2026-11').result,monthlyResult(before,'2026-11').result);
  assert.deepEqual(d.bikeUnits.map(u=>({id:u.id,chassis:u.chassis,unitCost:u.unitCost,image:u.image,odometer:u.odometer,condition:u.condition,lotId:u.lotId})),identities);
  for(const [name,payload] of [['deleteLot',deletion],['restoreLot',deletion],['stockLot',{...lotDraft,code:'lote exclusão'}],['stockUnit',{...unitDraft,newModel:undefined,modelId,lotId,chassis:'TESTE-BLOQUEADO'}],['stockUnit',{...unitEdit(d.bikeUnits.find(u=>u.id===other)),lotId}],['movement',{modelId,lotCode:lotDraft.code,kind:'entrada',quantity:1,unitCost:100,date,reference:'Teste bloqueado',notes:'',registerPayment:false,payment:'Pix'}],['assignLot',{modelId,fromLotId:empty,quantity:1,lotCode:lotDraft.code,date}]])assert.equal((await action(name,payload)).r.status,400,name);
  await stop();await boot(dir);d=await data();assert.ok(d.stockLots.find(l=>l.id===lotId).deletedAt);assert.equal(d.models.find(m=>m.id===modelId).stock,1);reconciles(d);
  await ok('restoreLot',requestFor(d,lotId));d=await data();assert.equal(d.bikeUnits.find(u=>u.id===u1).status,'available');assert.equal(d.bikeUnits.find(u=>u.id===u2).status,'available');assert.equal(d.bikeUnits.find(u=>u.id===out).status,'out');assert.equal(d.bikeUnits.find(u=>u.id===out).excludedWithLot,0);assert.equal(d.models.find(m=>m.id===modelId).stock,3);assert.equal(d.movements.filter(m=>m.kind==='restauracao_lote').length,2);assert.deepEqual(d.ledger,before.ledger);assert.deepEqual(d.expenses,before.expenses);reconciles(d);
  const snapshot=await fetch(base+'/api/backup/sqlite',{headers:{Cookie:cookie}});assert.equal(snapshot.status,200);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});

test('lote com venda ativa fica protegido; estorno permite exclusão e mantém histórico e pagamentos',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gp-delete-sale-'));cookie='';
 try{
  await boot(dir);await setup();const lotId=await ok('stockLot',lotDraft),unitId=await ok('stockUnit',{...unitDraft,lotId});let d=await data();const u=d.bikeUnits.find(u=>u.id===unitId);
  const customerId=await ok('customer',{name:'Cliente fictício',phone:'',document:'',birthday:'',email:'',city:'',address:'',notes:'',consent:0});
  const saleId=await ok('sale',{unitId,modelId:u.modelId,lotId,customerId,quantity:1,unitPrice:800000,discount:0,paid:800000,payment:'Pix',date,dueDate:'',chassis:u.chassis,notes:''});
  d=await data();const blocked=await action('deleteLot',requestFor(d,lotId));assert.equal(blocked.r.status,400);assert.match(JSON.stringify(blocked.j),/venda ativa/);assert.deepEqual((await data()).ledger,d.ledger);
  await ok('cancelSale',{id:saleId,revision:0});d=await data();const history={sales:d.sales,saleUnits:d.saleUnits,saleLots:d.saleLots,ledger:d.ledger};await ok('deleteLot',requestFor(d,lotId));d=await data();for(const k of Object.keys(history))assert.deepEqual(d[k],history[k]);assert.equal(d.sales[0].status,'cancelled');assert.equal(d.bikeUnits[0].status,'out');reconciles(d);
  const sale=await action('sale',{unitId,modelId:u.modelId,lotId,customerId,quantity:1,unitPrice:800000,discount:0,paid:800000,payment:'Pix',date,dueDate:'',chassis:u.chassis,notes:''});assert.equal(sale.r.status,400);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});

test('motos fornecidas não reaparecem após excluir lote e reiniciar com importação ativada',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gp-delete-provided-'));cookie='';
 try{
  await boot(dir,true);await setup();let d=await data();assert.equal(d.bikeUnits.length,7);const lotId=d.stockLots[0].id;await ok('deleteLot',requestFor(d,lotId));await stop();await boot(dir,true);d=await data();assert.equal(d.bikeUnits.length,7);assert.equal(d.dataImports.length,1);assert.ok(d.stockLots[0].deletedAt);assert.ok(d.bikeUnits.every(u=>u.status==='out'&&u.excludedWithLot===1));assert.ok(d.models.every(m=>m.stock===0));reconciles(d);
  await ok('restoreLot',requestFor(d,lotId));d=await data();assert.ok(d.bikeUnits.every(u=>u.status==='available'));assert.equal(d.bikeUnits.filter(u=>u.chassis).length,6);assert.ok(d.bikeUnits.every(u=>u.price===800000));reconciles(d);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});

test('exclusão com estoque alterado e inclusão concorrente são atômicas; escopo e demo seguem as regras',async()=>{
 const raw=new DatabaseSync(':memory:');raw.exec('PRAGMA foreign_keys=ON');for(const n of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())raw.exec(readFileSync(join('drizzle',n),'utf8'));const db=new Database(raw);
 try{
  raw.prepare('INSERT INTO stockLots(id,scope,code,createdAt) VALUES (?,?,?,?)').run('lot',scope,'LOTE CONCORRENTE',stamp);
  raw.prepare('INSERT INTO models(id,scope,name,createdAt) VALUES (?,?,?,?)').run('model',scope,'Modelo fictício',stamp);
  const draft=validate('stockUnit',{...unitDraft,newModel:undefined,lotId:'lot',modelId:'model'});
  const pendingDelete=await lotExclusionStatements(db,scope,'deleteLot',{id:'lot',revision:0},stamp,date);
  await db.batch(await bikeStatements(db,scope,'stockUnit',draft,'u1',stamp,date));
  await assert.rejects(db.batch(pendingDelete));assert.equal(raw.prepare('SELECT deletedAt FROM stockLots').get().deletedAt,'');assert.equal(raw.prepare('SELECT status FROM bikeUnits').get().status,'available');
  const pendingAdd=await bikeStatements(db,scope,'stockUnit',{...draft,chassis:'TESTE-CONCORRENTE-02'},'u2',stamp,date);
  const lot=raw.prepare('SELECT * FROM stockLots').get();await db.batch(await lotExclusionStatements(db,scope,'deleteLot',{id:lot.id,revision:lot.revision},stamp,date));await assert.rejects(db.batch(pendingAdd));assert.equal(raw.prepare('SELECT count(*) n FROM bikeUnits').get().n,1);assert.equal(raw.prepare('SELECT stock FROM models').get().stock,0);assert.equal(raw.prepare('SELECT count(*) n FROM movements').get().n,2);
  await assert.rejects(lotExclusionStatements(db,'outro','restoreLot',{id:'lot',revision:raw.prepare('SELECT revision FROM stockLots').get().revision},stamp,date));assert.deepEqual(raw.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{raw.close();}
 let d=demoAction(emptyData(),'stockLot',validate('stockLot',lotDraft));const lotId=d.stockLots[0].id;d=demoAction(d,'stockUnit',validate('stockUnit',{...unitDraft,lotId}));const identity=d.bikeUnits[0].chassis;d=demoAction(d,'deleteLot',requestFor(d,lotId));assert.equal(d.models[0].stock,0);assert.equal(d.bikeUnits[0].status,'out');assert.throws(()=>demoAction(d,'stockUnit',validate('stockUnit',{...unitDraft,lotId,chassis:'TESTE-OUTRA'})));d=demoAction(d,'restoreLot',requestFor(d,lotId));assert.equal(d.models[0].stock,1);assert.equal(d.bikeUnits[0].chassis,identity);assert.equal(d.bikeUnits[0].status,'available');reconciles(d);
});
