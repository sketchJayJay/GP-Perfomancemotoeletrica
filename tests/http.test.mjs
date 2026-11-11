import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const dir=mkdtempSync(join(tmpdir(),'gp-coolify-test-'));
let proc,base,cookie='';
const password=randomBytes(20).toString('base64url');
async function boot(){
 proc=spawn(process.execPath,['build/server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:'0',HOST:'127.0.0.1',PUBLIC_URL:'',DATA_DIR:dir,DISABLE_SCHEDULER:'1',ZAPI_INSTANCE_ID:'',ZAPI_TOKEN:'',ZAPI_CLIENT_TOKEN:'',ADMIN_USERNAME:'',ADMIN_PASSWORD:''},stdio:['ignore','pipe','pipe']});
 let log='';await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Servidor não iniciou: '+log)),15000);proc.stdout.on('data',chunk=>{log+=chunk;const match=log.match(/pronta na porta (\d+)/);if(match){base='http://127.0.0.1:'+match[1];clearTimeout(timeout);resolve();}});proc.stderr.on('data',chunk=>{log+=chunk;});proc.once('exit',code=>{clearTimeout(timeout);reject(Error('Servidor encerrou '+code+': '+log));});});
}
async function stop(){const p=proc;proc=null;if(!p||p.exitCode!==null)return;await new Promise(resolve=>{p.once('exit',resolve);p.kill('SIGTERM');});}
async function api(path,body,options={}){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...options.headers},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();return {r,j};}
async function action(name,payload,requestId=randomUUID()){return api('/api/action',{action:name,payload,requestId});}

test('pacote Coolify: login, estoque, venda, concorrência, backup e reinício preservam dados',async()=>{
 try{
 await boot();assert.equal((await api('/api/data')).r.status,401);
 assert.equal((await api('/api/data',null,{headers:{'oai-authenticated-user-id':'forjado'}})).r.status,401);
 assert.equal((await api('/api/auth/status')).j.setupRequired,true);
 const setup=await api('/api/auth/setup',{username:'teste',password});assert.equal(setup.r.status,200);cookie=setup.r.headers.get('set-cookie').split(';')[0];
 assert.equal((await api('/api/auth/setup',{username:'outro',password})).r.status,400);
 let result=await api('/api/data');assert.equal(result.r.status,200);assert.equal(result.j.models.length,0);assert.equal(result.j.providerReady,false);
 const model={name:'Moto teste',brand:'GP',power:'2000W',rangeKm:60,battery:'60V',color:'Preta',cost:500000,price:800000,minStock:1,initialStock:1,image:''};
 const requestId=randomUUID();const created=await action('model',model,requestId),duplicate=await action('model',model,requestId);assert.equal(created.r.status,200);assert.equal(duplicate.j.id,created.j.id);const modelId=created.j.id;
 const customer=await action('customer',{name:'Cliente fictício de teste',phone:'',document:'',birthday:'',email:'',city:'',address:'',notes:'',consent:0});assert.equal(customer.r.status,200);const customerId=customer.j.id;
 const sale={modelId,customerId,quantity:1,unitPrice:800000,discount:50000,paid:200000,payment:'Pix',dueDate:'2026-11-12',date:'2026-11-11',chassis:'',notes:''};
 assert.equal((await action('sale',{...sale,quantity:2})).r.status,400);
 const saleKey=randomUUID(),both=await Promise.all([action('sale',sale,saleKey),action('sale',sale,saleKey)]);assert.equal(both[0].r.status,200);assert.equal(both[1].r.status,200);
 result=await api('/api/data');assert.equal(result.j.models[0].stock,0);assert.equal(result.j.sales.length,1);assert.equal(result.j.ledger.length,1);
 const saleId=result.j.sales[0].id,payment={id:saleId,revision:0,amount:550000,payment:'Pix',date:'2026-11-11'};
 const pays=await Promise.all([action('payment',payment),action('payment',payment)]);assert.deepEqual(pays.map(x=>x.r.status).sort(),[200,400]);
 result=await api('/api/data');assert.equal(result.j.sales[0].paid,750000);assert.equal(result.j.ledger.reduce((a,e)=>a+e.amount,0),750000);
 const cancelKey=randomUUID();assert.equal((await action('cancelSale',{id:saleId,revision:1},cancelKey)).r.status,200);assert.equal((await action('cancelSale',{id:saleId,revision:1},cancelKey)).r.status,200);
 result=await api('/api/data');assert.equal(result.j.models[0].stock,1);assert.equal(result.j.sales[0].status,'cancelled');assert.equal(result.j.ledger.reduce((a,e)=>a+(e.type==='in'?e.amount:-e.amount),0),0);
 const badOrigin=await api('/api/action',{action:'entry',payload:{}},{headers:{Origin:'https://exemplo-invalido.test'}});assert.equal(badOrigin.r.status,400);
 const birthday=await api('/api/birthdays/run',{});assert.equal(birthday.j.status,'not_connected');assert.equal(birthday.j.accepted,0);
 const snapshot=await fetch(base+'/api/backup/sqlite',{headers:{Cookie:cookie}});assert.equal(snapshot.status,200);const path=join(dir,'restore-check.sqlite');writeFileSync(path,new Uint8Array(await snapshot.arrayBuffer()));const db=new DatabaseSync(path,{readOnly:true});assert.equal(db.prepare('SELECT count(*) AS n FROM sales').get().n,1);db.close();
 await stop();await boot();result=await api('/api/data');assert.equal(result.r.status,200);assert.equal(result.j.models[0].stock,1);assert.equal(result.j.customers.length,1);assert.equal((await api('/api/auth/status')).j.setupRequired,false);assert.ok(readdirSync(join(dir,'backups')).some(s=>s.startsWith('antes-iniciar-')));
 await api('/api/auth/logout',{});assert.equal((await api('/api/data')).r.status,401);
 const bad=await api('/api/auth/login',{username:'teste',password:'senha-errada'});assert.equal(bad.r.status,400);
 const valid=await api('/api/auth/login',{username:'teste',password});assert.equal(valid.r.status,200);assert.ok(valid.r.headers.get('set-cookie').includes('HttpOnly'));
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});
