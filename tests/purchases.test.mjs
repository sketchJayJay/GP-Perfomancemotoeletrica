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


test('compras: migração preserva dados antigos e lote só entra uma vez após confirmação',async()=>{
 try{
 const old=new DatabaseSync(join(dir,'gp-performance.sqlite'));
 old.exec('CREATE TABLE app_migrations (name TEXT PRIMARY KEY,hash TEXT NOT NULL,appliedAt TEXT NOT NULL)');
 for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')&&n<'0004').sort()){
  const sql=readFileSync(join('drizzle',name),'utf8');old.exec(sql);old.prepare('INSERT INTO app_migrations VALUES (?,?,?)').run(name,createHash('sha256').update(sql).digest('hex'),new Date().toISOString());
 }
 old.prepare("INSERT INTO models(id,scope,name,stock,createdAt) VALUES ('legado','gp-store','Modelo antigo',3,'2026-01-01')").run();old.close();
 await boot();const setup=await api('/api/auth/setup',{username:'teste',password});cookie=setup.r.headers.get('set-cookie').split(';')[0];
 assert.equal((await api('/api/data')).j.models.find(m=>m.id==='legado').stock,3);
 const model={name:'Moto A',brand:'GP',power:'2000W',rangeKm:60,battery:'60V',color:'Preta',cost:10000,price:30000,minStock:1,initialStock:0,image:''};
 const a=(await action('model',model)).j.id,b=(await action('model',{...model,name:'Moto B',cost:20000})).j.id;
 const purchase={date:'2026-11-12',supplier:'Fornecedor de teste',buyer:'Gigante',carrier:'Frete teste',expectedDate:'2026-11-15',freight:8000,status:'planned',notes:'Lote de teste',items:[{modelId:a,quantity:2,unitCost:10000},{modelId:b,quantity:3,unitCost:20000}]};
 const key=randomUUID(),created=await action('purchase',purchase,key);assert.equal(created.r.status,200);assert.equal((await action('purchase',purchase,key)).j.id,created.j.id);const id=created.j.id;
 let d=(await api('/api/data')).j;assert.equal(d.purchases.length,1);assert.equal(d.purchases[0].total,88000);assert.equal(d.models.find(m=>m.id===a).stock,0);assert.equal(d.models.find(m=>m.id===b).stock,0);assert.equal(d.ledger.length,0);
 assert.equal((await action('purchase',{...purchase,id,revision:0,status:'in_transit'})).r.status,200);
 assert.equal((await action('purchase',{...purchase,id,revision:0,status:'purchased'})).r.status,400);
 d=(await api('/api/data')).j;assert.equal(d.purchases[0].status,'in_transit');assert.equal(d.models.find(m=>m.id===a).stock,0);
 const receive={id,revision:1,date:'2026-11-12',registerPayment:true,payment:'Pix'},keys=[randomUUID(),randomUUID()];
 const results=await Promise.all(keys.map(k=>action('receivePurchase',receive,k)));assert.deepEqual(results.map(x=>x.r.status).sort(),[200,400]);
 const successful=results.findIndex(x=>x.r.status===200);assert.equal((await action('receivePurchase',receive,keys[successful])).r.status,200);
 d=(await api('/api/data')).j;assert.equal(d.purchases[0].status,'received');assert.equal(d.models.find(m=>m.id===a).stock,2);assert.equal(d.models.find(m=>m.id===a).cost,11000);assert.equal(d.models.find(m=>m.id===b).stock,3);assert.equal(d.models.find(m=>m.id===b).cost,22000);assert.equal(d.ledger.length,1);assert.equal(d.ledger[0].amount,88000);assert.equal(d.movements.filter(m=>m.reference===d.purchases[0].number).length,2);
 assert.equal((await action('receivePurchase',receive)).r.status,400);assert.equal((await action('purchase',{...purchase,id,revision:2})).r.status,400);assert.equal((await action('cancelPurchase',{id,revision:2})).r.status,400);
 const cancelled=(await action('purchase',{...purchase,status:'purchased'})).j.id;assert.equal((await action('cancelPurchase',{id:cancelled,revision:0})).r.status,200);assert.equal((await action('receivePurchase',{...receive,id:cancelled,revision:1})).r.status,400);
 const invalid=await action('purchase',{...purchase,items:[{modelId:'inexistente',quantity:1,unitCost:1000}]});assert.equal(invalid.r.status,400);
 assert.equal((await action('purchase',{...purchase,items:[purchase.items[0],purchase.items[0]]})).r.status,400);
 assert.equal((await action('purchase',{...purchase,items:[{modelId:a,quantity:0,unitCost:1}]})).r.status,400);
 const unpaid=(await action('purchase',{...purchase,freight:0,items:[{modelId:a,quantity:1,unitCost:11000}]})).j.id;
 assert.equal((await action('receivePurchase',{id:unpaid,revision:0,date:'2026-11-12',registerPayment:false,payment:'Pix'})).r.status,200);
 d=(await api('/api/data')).j;assert.equal(d.ledger.length,1);assert.equal(d.models.find(m=>m.id===a).stock,3);assert.equal(d.purchases.length,3);
 await stop();await boot();d=(await api('/api/data')).j;assert.equal(d.purchases.length,3);assert.equal(d.purchaseItems.length,5);assert.equal(d.models.find(m=>m.id==='legado').stock,3);assert.equal(d.models.find(m=>m.id===a).stock,3);assert.equal(d.purchases.filter(p=>p.status==='received').length,2);
 const snapshot=await fetch(base+'/api/backup/sqlite',{headers:{Cookie:cookie}});assert.equal(snapshot.status,200);const file=join(dir,'compras-backup.sqlite');writeFileSync(file,new Uint8Array(await snapshot.arrayBuffer()));const snapshotDb=new DatabaseSync(file,{readOnly:true});assert.equal(snapshotDb.prepare('SELECT count(*) AS n FROM purchases').get().n,3);snapshotDb.close();
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});
