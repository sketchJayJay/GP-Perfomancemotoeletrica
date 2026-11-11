import {existsSync,readdirSync,statSync,unlinkSync} from 'node:fs';
import {join,basename} from 'node:path';
import {createSnapshot,dataDir,env} from '../lib/runtime.ts';
import {runBirthdayJob,providerReady} from '../lib/server.ts';
import {today} from '../lib/domain.ts';
export function startJobs(){
 let running=false;
 const tick=async()=>{
  if(running)return;running=true;
  try{
   const date=today(),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
   const get=(key:string)=>(env.DB!.raw.prepare('SELECT value FROM systemMeta WHERE key=?').get(key) as any)?.value;
   const set=(key:string,value:string)=>env.DB!.raw.prepare('INSERT INTO systemMeta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,value);
   if(hour>=9&&providerReady()&&get('birthdayLastDate')!==date&&env.DB!.raw.prepare('SELECT scope FROM settings WHERE birthdayEnabled=1 LIMIT 1').get()){
    const result=await runBirthdayJob();set('birthdayLastDate',date);console.log(`[aniversarios] ${result.status}: ${result.accepted} aceitas`);
   }
   if(get('backupLastDate')!==date){await createSnapshot('diario');set('backupLastDate',date);}
   const folder=join(dataDir,'backups'),cutoff=Date.now()-14*86400000;
   if(existsSync(folder))for(const name of readdirSync(folder)){const path=join(folder,name);if(/^(diario|antes-iniciar)-.*\.sqlite$/.test(basename(path))&&statSync(path).mtimeMs<cutoff)unlinkSync(path);}
  }catch{console.error('[rotinas] Não foi possível concluir uma rotina. Verifique o banco e a conexão WhatsApp.');}finally{running=false;}
 };
 const timer=setInterval(()=>{void tick();},60000);timer.unref();void tick();return ()=>clearInterval(timer);
}
