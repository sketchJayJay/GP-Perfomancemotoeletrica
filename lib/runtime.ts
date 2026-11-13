import {ensureLegacyStockLots} from './legacy-lots.ts';
import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,readdirSync,readFileSync,existsSync,chmodSync,renameSync,unlinkSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';

export class Prepared {
 constructor(public db:DatabaseSync,public sql:string,public values:any[]=[]){ }
 bind(...values:any[]){return new Prepared(this.db,this.sql,values);}
 async first<T=Record<string,unknown>>(){return (this.db.prepare(this.sql).get(...this.values) as T)||null;}
 async all<T=Record<string,unknown>>(){return {results:this.db.prepare(this.sql).all(...this.values) as T[]};}
 async run(){const r=this.db.prepare(this.sql).run(...this.values);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}
 execute(){const s=this.db.prepare(this.sql);if(/^\s*(SELECT|PRAGMA|WITH)\b/i.test(this.sql))return {success:true,results:s.all(...this.values)};const r=s.run(...this.values);return {success:true,results:[],meta:{changes:Number(r.changes)}};}
}
export class Database {
 constructor(public raw:DatabaseSync){}
 prepare(sql:string){return new Prepared(this.raw,sql);}
 async batch(list:Prepared[]){this.raw.exec('BEGIN IMMEDIATE');try{const result=list.map(s=>s.execute());this.raw.exec('COMMIT');return result;}catch(e){this.raw.exec('ROLLBACK');throw e;}}
}
export const dataDir=resolve(process.env.DATA_DIR||'data');
export const env:{DB?:Database;ZAPI_INSTANCE_ID?:string;ZAPI_TOKEN?:string;ZAPI_CLIENT_TOKEN?:string}={ZAPI_INSTANCE_ID:process.env.ZAPI_INSTANCE_ID,ZAPI_TOKEN:process.env.ZAPI_TOKEN,ZAPI_CLIENT_TOKEN:process.env.ZAPI_CLIENT_TOKEN};
export const storeScope='gp-store';
const identities=new WeakMap<Request,string>();
export function authorizeRequest(req:Request){identities.set(req,storeScope);}
export function scopeFor(req:Request){const scope=identities.get(req);if(!scope)throw Error('AUTH_REQUIRED');return scope;}
let snapshotBusy=false;
export async function createSnapshot(prefix='manual'){
 if(!env.DB)throw Error('Banco indisponível.');
 if(snapshotBusy)throw Error('Uma cópia já está sendo criada. Tente novamente em instantes.');
 snapshotBusy=true;
 const dir=join(dataDir,'backups');mkdirSync(dir,{recursive:true});
 const name=prefix+'-'+new Date().toISOString().replaceAll(':','-').replaceAll('.','-')+'.sqlite';
 const target=join(dir,name),temporary=target+'.tmp';
 try{await backup(env.DB.raw,temporary);chmodSync(temporary,0o600);renameSync(temporary,target);return target;}finally{snapshotBusy=false;if(existsSync(temporary))unlinkSync(temporary);}
}
export async function openDatabase(){
 mkdirSync(dataDir,{recursive:true,mode:0o700});const file=join(dataDir,'gp-performance.sqlite'),existing=existsSync(file)&&statSync(file).size>0;
 const raw=new DatabaseSync(file);raw.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');chmodSync(file,0o600);env.DB=new Database(raw);
 if(existing)await createSnapshot('antes-iniciar');
 raw.exec('CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL, appliedAt TEXT NOT NULL)');
 for(const name of readdirSync(resolve('drizzle')).filter(f=>f.endsWith('.sql')).sort()){
  const sql=readFileSync(join('drizzle',name),'utf8'),hash=createHash('sha256').update(sql).digest('hex');
  const applied=raw.prepare('SELECT hash FROM app_migrations WHERE name=?').get(name) as any;
  if(applied){if(applied.hash!==hash)throw Error('Uma migração já aplicada foi alterada: '+name);continue;}
  raw.exec('BEGIN IMMEDIATE');try{raw.exec(sql);raw.prepare('INSERT INTO app_migrations VALUES (?,?,?)').run(name,hash,new Date().toISOString());raw.exec('COMMIT');}catch(e){raw.exec('ROLLBACK');throw e;}
 }
 ensureLegacyStockLots(raw);
 return env.DB;
}
