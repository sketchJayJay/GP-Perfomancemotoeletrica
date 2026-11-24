import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {emptyData} from '../lib/domain.ts';
import {withCostPrivacy,costsHidden,costCsv} from '../lib/costs-domain.ts';

const date='2026-11-24',scope='gp-store';
let proc,base,cookie='',grant='',adminPassword='';
async function boot(dir){
 proc=spawn(process.execPath,['build/server.mjs'],{cwd:process.cwd(),env:{...process.env,DATA_DIR:dir,PORT:'0',HOST:'127.0.0.1',PUBLIC_URL:'',SEED_GP_BIKES:'0',DISABLE_SCHEDULER:'1',ZAPI_INSTANCE_ID:'',ZAPI_TOKEN:'',ZAPI_CLIENT_TOKEN:'',ADMIN_USERNAME:'',ADMIN_PASSWORD:''},stdio:['ignore','pipe','pipe']});
 let log='';await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Servidor não iniciou: '+log)),15000);proc.stdout.on('data',chunk=>{log+=chunk;const match=log.match(/pronta na porta (\d+)/);if(match){base='http://127.0.0.1:'+match[1];clearTimeout(timer);resolve();}});proc.stderr.on('data',chunk=>{log+=chunk;});proc.once('exit',code=>{clearTimeout(timer);reject(Error('Servidor encerrou '+code+': '+log));});});
}
async function stop(){const p=proc;proc=null;if(!p||p.exitCode!==null)return;await new Promise(resolve=>{p.once('exit',resolve);p.kill('SIGTERM');});}
const headers=(token=grant,session=cookie)=>({...session?{Cookie:session}:{},...token?{'X-GP-Cost-Token':token}:{}});
async function api(path,body,token=grant,session=cookie,origin){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...headers(token,session),...(body?{'Content-Type':'application/json'}:{}),...(origin?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})});return {r,j:await r.json()};}
const action=(name,payload,token=grant)=>api('/api/action',{action:name,payload,requestId:randomUUID()},token);
const data=async(token=grant)=>(await api('/api/data',undefined,token)).j;
async function setup(){adminPassword=randomBytes(24).toString('base64url');const r=await api('/api/auth/setup',{username:'teste',password:adminPassword});assert.equal(r.r.status,200);cookie=r.r.headers.get('set-cookie').split(';')[0];grant='';}
async function ok(name,payload,token=grant){const r=await action(name,payload,token);assert.equal(r.r.status,200,r.j.error);return r.j.id;}
async function enable(password){const r=await api('/api/costs/settings',{action:'enable',adminPassword,newPassword:password});assert.equal(r.r.status,200,r.j.error);grant='';}
async function unlock(password){const r=await api('/api/costs/unlock',{password});assert.equal(r.r.status,200,r.j.error);assert.match(r.j.token,/^[a-f0-9]{64}$/);assert.ok(r.j.expiresAt>Date.now()&&r.j.expiresAt<=Date.now()+5*60000);grant=r.j.token;return r.j;}
const unitDraft={newModel:{name:'Moto confidencial',brand:'',color:'Cinza'},chassis:'TESTE-PRIVACIDADE-01',condition:'new',price:800000,unitCost:514321,image:'',odometer:null,year:null,date,notes:'',registerPayment:false,payment:'Pix'};
const customerDraft={name:'Cliente de teste',phone:'',document:'',birthday:'',email:'',city:'',address:'',notes:'',consent:0};
const lotDraft={code:'LOTE PRIVACIDADE',supplier:'Fornecedor de teste',carrier:'Transportador de teste',receivedDate:date,notes:''};
const editUnit=(u,fields={})=>({id:u.id,revision:u.revision,modelId:u.modelId,lotId:u.lotId,chassis:u.chassis,condition:u.condition,price:u.price,unitCost:u.unitCost,image:u.image,odometer:u.odometer,year:u.year,date:u.receivedDate,notes:u.notes,registerPayment:false,payment:'Pix',...fields});
const sale=(u,customerId)=>({unitId:u.id,lotId:u.lotId,modelId:u.modelId,customerId,quantity:1,unitPrice:800000,discount:0,paid:800000,payment:'Pix',date,dueDate:'',chassis:u.chassis,notes:''});
async function fixture(){const lotId=await ok('stockLot',lotDraft),unitId=await ok('stockUnit',{...unitDraft,lotId}),customerId=await ok('customer',customerDraft);return {lotId,unitId,customerId};}
function inspect(dir,fn){const db=new DatabaseSync(join(dir,'gp-performance.sqlite'));try{return fn(db);}finally{db.close();}}

test('custos ficam ocultos no servidor, são liberados com senha e grant por sessão; backup exige liberação',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gp-costs-read-'));cookie='';grant='';
 try{
  await boot(dir);await setup();const {unitId,customerId}=await fixture();let d=await data();const modelId=d.bikeUnits.find(u=>u.id===unitId).modelId;
  const purchaseId=await ok('purchase',{lotCode:'LOTE FORNECEDOR',date,supplier:'Fornecedor de exemplo',buyer:'Comprador',carrier:'Transportador',expectedDate:date,freight:10000,status:'in_transit',notes:'',items:[{modelId,quantity:1,unitCost:469381}]});
  await ok('receivePurchase',{id:purchaseId,revision:0,date,registerPayment:true,payment:'Pix'});d=await data();const saleId=await ok('sale',sale(d.bikeUnits.find(u=>u.id===unitId),customerId));
  const secret=randomBytes(20).toString('base64url');await enable(secret);d=await data();assert.deepEqual(d.costAccess,{enabled:true,unlocked:false,expiresAt:null});assert.equal(d.bikeUnits.find(u=>u.id===unitId).unitCost,null);assert.ok(d.models.every(m=>m.cost===0));assert.ok(d.sales.every(s=>s.cost===0));assert.ok(d.saleUnits.every(s=>s.unitCost===null));assert.ok(d.stockLotBalances.every(b=>b.unitCost===0));assert.ok(d.saleLots.every(l=>l.unitCost===0));assert.ok(d.movements.every(m=>m.unitCost===0));assert.ok(d.purchaseItems.every(i=>i.unitCost===0));assert.ok(d.purchases.every(p=>p.total===0));assert.equal(d.ledger.filter(e=>e.category==='Fornecedor').length,0);assert.equal(d.sales[0].total,800000);assert.equal(d.models[0].price,800000);assert.equal(d.customers.length,1);
  const serialized=JSON.stringify(d);assert.ok(!serialized.includes('514321'));assert.ok(!serialized.includes('469381'));assert.ok(!serialized.includes(secret));assert.ok(!serialized.includes('passwordHash'));assert.equal((await fetch(base+'/api/backup/sqlite',{headers:headers('')})).status,403);assert.equal((await api('/api/costs/unlock',{password:'incorreta'},'')).r.status,403);
  await unlock(secret);d=await data();assert.equal(d.costAccess.unlocked,true);assert.equal(d.bikeUnits.find(u=>u.id===unitId).unitCost,514321);assert.equal(d.sales.find(s=>s.id===saleId).cost,514321);assert.equal(d.purchases.find(p=>p.id===purchaseId).total,479381);assert.equal((await data('')).bikeUnits.find(u=>u.id===unitId).unitCost,null,'Reabrir sem o grant continua oculto');assert.equal((await api('/api/data?token='+grant,undefined,'')).j.costAccess.unlocked,false);
  const login=await api('/api/auth/login',{username:'teste',password:adminPassword},'');assert.equal(login.r.status,200);const otherSession=login.r.headers.get('set-cookie').split(';')[0];assert.equal((await api('/api/data',undefined,grant,otherSession)).j.costAccess.unlocked,false,'Um grant não vale para outra sessão');
  const backup=await fetch(base+'/api/backup/sqlite',{headers:headers()});assert.equal(backup.status,200);const file=join(dir,'authorized-backup.sqlite');writeFileSync(file,new Uint8Array(await backup.arrayBuffer()));const snapshot=new DatabaseSync(file,{readOnly:true});assert.equal(snapshot.prepare('SELECT unitCost FROM bikeUnits WHERE id=?').get(unitId).unitCost,514321);assert.deepEqual(snapshot.prepare('PRAGMA foreign_key_check').all(),[]);snapshot.close();
  inspect(dir,db=>{const state=db.prepare('SELECT * FROM costProtection').get();assert.equal(state.enabled,1);assert.notEqual(state.passwordHash,secret);assert.equal(state.passwordHash.length,128);assert.ok(!JSON.stringify(db.prepare('SELECT * FROM costGrants').all()).includes(grant));});
  const old=grant;assert.equal((await api('/api/costs/lock',{})).r.status,200);assert.equal((await data(old)).costAccess.unlocked,false);grant='';await stop();await boot(dir);d=await data();assert.equal(d.costAccess.enabled,true);assert.equal(d.costAccess.unlocked,false);assert.equal(d.bikeUnits.find(u=>u.id===unitId).unitCost,null);await unlock(secret);assert.equal((await data()).bikeUnits.find(u=>u.id===unitId).unitCost,514321);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});

test('com custos ocultos, venda e edição de chassi preservam o custo; alterações de custos e compras são bloqueadas',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gp-costs-write-'));cookie='';grant='';
 try{
  await boot(dir);await setup();const {lotId,unitId,customerId}=await fixture(),secret=randomBytes(20).toString('base64url');await enable(secret);let d=await data(),u=d.bikeUnits.find(u=>u.id===unitId);
  await ok('stockUnit',editUnit(u,{notes:'Chassi conferido com custo oculto'}));d=await data();assert.equal(d.bikeUnits[0].notes,'Chassi conferido com custo oculto');assert.equal(d.bikeUnits[0].unitCost,null);assert.equal(inspect(dir,db=>db.prepare('SELECT unitCost FROM bikeUnits WHERE id=?').get(unitId).unitCost),514321);
  u=d.bikeUnits.find(u=>u.id===unitId);assert.equal((await action('stockUnit',editUnit(u,{unitCost:1}))).r.status,403);assert.equal((await action('stockUnit',editUnit(u,{unitCost:514321}))).r.status,403);assert.equal((await action('stockUnit',{...unitDraft,lotId,chassis:'TESTE-NOVA-COM-CUSTO'})).r.status,403);
  const unknown=await ok('stockUnit',{...unitDraft,newModel:undefined,modelId:u.modelId,lotId,chassis:'TESTE-SEM-CUSTO',unitCost:null});d=await data();assert.equal(d.bikeUnits.find(u=>u.id===unknown).unitCost,null);
  assert.equal((await action('movement',{kind:'entrada',modelId:u.modelId,quantity:1,unitCost:1,lotCode:lotDraft.code,date,reference:'Teste',notes:'',registerPayment:false,payment:'Pix'})).r.status,403);
  assert.equal((await action('model',{...d.models[0],cost:0})).r.status,403);assert.equal((await action('entry',{type:'out',category:'Fornecedor',amount:1,description:'Tentativa de compra',payment:'Pix',date})).r.status,403);assert.equal((await action('purchase',{})).r.status,403);assert.equal((await action('receivePurchase',{id:'x',revision:0,date,registerPayment:false,payment:'Pix'})).r.status,403);
  const saleId=await ok('sale',sale(u,customerId));d=await data();assert.equal(d.sales.find(s=>s.id===saleId).cost,0);assert.equal(d.sales[0].paid,800000);assert.equal(inspect(dir,db=>db.prepare('SELECT cost FROM sales WHERE id=?').get(saleId).cost),514321);assert.equal(inspect(dir,db=>db.prepare('SELECT unitCost FROM saleUnits WHERE saleId=?').get(saleId).unitCost),514321);
  await unlock(secret);d=await data();assert.equal(d.sales.find(s=>s.id===saleId).cost,514321);assert.equal(d.bikeUnits.find(u=>u.id===unitId).unitCost,514321);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});

test('troca/desativação exigem senha atual, revogam grants e nunca alteram custos; grant expira e logout invalida',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gp-costs-manage-'));cookie='';grant='';
 try{
  await boot(dir);await setup();const {unitId}=await fixture(),secret=randomBytes(20).toString('base64url'),next=randomBytes(20).toString('base64url');
  assert.equal((await api('/api/costs/settings',{action:'enable',adminPassword:'errada',newPassword:secret})).r.status,403);assert.equal((await data()).costAccess.enabled,false);assert.equal((await api('/api/costs/settings',{action:'enable',adminPassword,newPassword:'curta'})).r.status,400);
  await enable(secret);await unlock(secret);const first=grant;
  assert.equal((await api('/api/costs/settings',{action:'disable',adminPassword})).r.status,403);assert.equal((await api('/api/costs/settings',{action:'change',password:'errada',newPassword:next})).r.status,403);assert.equal((await data(first)).costAccess.unlocked,true);
  assert.equal((await api('/api/costs/settings',{action:'change',password:secret,newPassword:next})).r.status,200);assert.equal((await data(first)).costAccess.unlocked,false);grant='';assert.equal((await api('/api/costs/unlock',{password:secret})).r.status,403);await unlock(next);
  inspect(dir,db=>db.prepare('UPDATE costGrants SET expiresAt=?').run(Date.now()-1));assert.equal((await data()).costAccess.unlocked,false);assert.equal((await fetch(base+'/api/backup/sqlite',{headers:headers()})).status,403);
  grant='';await unlock(next);const beforeLogout=grant;assert.equal((await api('/api/auth/logout',{})).r.status,200);assert.equal((await api('/api/data',undefined,beforeLogout)).r.status,401);assert.equal(inspect(dir,db=>db.prepare('SELECT count(*) n FROM costGrants').get().n),0);
  const login=await api('/api/auth/login',{username:'teste',password:adminPassword},'');assert.equal(login.r.status,200);cookie=login.r.headers.get('set-cookie').split(';')[0];grant='';assert.equal((await api('/api/data',undefined,beforeLogout)).j.costAccess.unlocked,false);await unlock(next);
  assert.equal((await api('/api/costs/settings',{action:'disable',password:next})).r.status,200);grant='';const d=await data();assert.equal(d.costAccess.enabled,false);assert.equal(d.bikeUnits.find(u=>u.id===unitId).unitCost,514321);assert.equal(inspect(dir,db=>db.prepare('SELECT count(*) n FROM costGrants').get().n),0);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});

test('tentativas são limitadas e persistem no reinício; sem login ou de outra origem não há liberação',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gp-costs-attempts-'));cookie='';grant='';
 try{
  await boot(dir);await setup();const secret=randomBytes(20).toString('base64url');await enable(secret);
  assert.equal((await api('/api/costs/unlock',{password:secret},'','')).r.status,401);assert.equal((await api('/api/costs/unlock',{password:secret},'',cookie,'https://outro.example')).r.status,400);
  for(let i=0;i<5;i++)assert.equal((await api('/api/costs/unlock',{password:'incorreta'})).r.status,403);assert.equal((await api('/api/costs/unlock',{password:secret})).r.status,429);await stop();await boot(dir);assert.equal((await api('/api/costs/unlock',{password:secret})).r.status,429);
  inspect(dir,db=>db.prepare('UPDATE costFailures SET windowStart=?,blockedUntil=0').run(Date.now()-16*60000));await unlock(secret);assert.equal((await data()).costAccess.unlocked,true);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});

test('projeção não modifica o banco/dado original e máscara/CSV não exibem zero como custo real',()=>{
 const source={...emptyData(),models:[{id:'m',cost:123456,price:800000}],bikeUnits:[{id:'u',unitCost:123456}],sales:[{id:'s',cost:123456,total:800000}],saleUnits:[{unitCost:123456}],movements:[{unitCost:123456}],stockLotBalances:[{unitCost:123456}],saleLots:[{unitCost:123456}],purchases:[{total:123456}],purchaseItems:[{unitCost:123456}],ledger:[{id:'l',category:'Fornecedor',amount:123456}]};
 const locked=withCostPrivacy(source,{enabled:true,unlocked:false});assert.equal(costsHidden(locked),true);assert.equal(costCsv(locked,123456),'Protegido');assert.equal(source.bikeUnits[0].unitCost,123456);assert.equal(source.ledger.length,1);assert.equal(locked.ledger.length,0);assert.equal(withCostPrivacy(source,{enabled:true,unlocked:true}).bikeUnits[0].unitCost,123456);assert.equal(costsHidden({costAccess:{enabled:true,unlocked:true,expiresAt:Date.now()-1}}),true);assert.equal(costsHidden(emptyData()),false);
});
