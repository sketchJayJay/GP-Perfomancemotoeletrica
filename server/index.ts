import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,unlinkSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openDatabase,authorizeRequest,storeScope,createSnapshot,env} from '../lib/runtime.ts';
import {readData,action,assertOrigin,processBirthdays} from '../lib/server.ts';
import {setupRequired,bootstrapAdmin,createAdmin,createSession,login,authenticated,sessionCookie,logout} from './auth.ts';
import {startJobs} from './jobs.ts';

const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json; charset=utf-8','.ico':'image/x-icon'};
export async function startServer(){
 await openDatabase();await bootstrapAdmin();
 const dist=resolve('dist'),publicUrl=process.env.PUBLIC_URL?new URL(process.env.PUBLIC_URL).origin:'';
 const server=createServer(async (incoming,outgoing)=>{
  outgoing.setHeader('X-Content-Type-Options','nosniff');outgoing.setHeader('X-Frame-Options','SAMEORIGIN');outgoing.setHeader('Referrer-Policy','same-origin');
  const send=(status:number,body:any,headers:Record<string,string>={})=>{outgoing.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});outgoing.end(JSON.stringify(body));};
  try{
   const host=incoming.headers.host||'localhost',forwarded=String(incoming.headers['x-forwarded-proto']||'').split(',')[0].trim(),protocol=forwarded==='https'?'https':'http';
   const base=publicUrl||`${protocol}://${host}`,url=new URL(incoming.url||'/',base);if(url.origin!==base)throw Error('Endereço inválido.');
   const headers=new Headers();for(const [key,value] of Object.entries(incoming.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);
   const req=new Request(url,{method:incoming.method,headers}),secure=base.startsWith('https://'),path=url.pathname;
   if(path==='/api/health'&&incoming.method==='GET'){env.DB!.raw.prepare('SELECT 1').get();send(200,{status:'ok',app:'GP Performance',version:'1.4.0'});return;}
   if(!path.startsWith('/api/')){
    if(incoming.method!=='GET'&&incoming.method!=='HEAD'){send(405,{error:'Método não permitido.'});return;}
    let requested=resolve(dist,'.'+decodeURIComponent(path));if(requested!==dist&&!requested.startsWith(dist+sep)){send(404,{error:'Não encontrado.'});return;}
    if(!existsSync(requested)||!statSync(requested).isFile()){if(extname(path)){send(404,{error:'Não encontrado.'});return;}requested=resolve(dist,'index.html');}
    if(!existsSync(requested)){send(503,{error:'Execute npm run build antes de iniciar.'});return;}
    outgoing.writeHead(200,{'Content-Type':mime[extname(requested)]||'application/octet-stream','Cache-Control':path.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache'});outgoing.end(incoming.method==='HEAD'?undefined:readFileSync(requested));return;
   }
   if(path==='/api/auth/status'&&incoming.method==='GET'){send(200,{authenticated:authenticated(req),setupRequired:setupRequired()});return;}
   if(incoming.method!=='GET')assertOrigin(req);
   const protectedRoute=!['/api/auth/setup','/api/auth/login'].includes(path);
   if(protectedRoute&&!authenticated(req)){send(401,{error:'Entre com o usuário e a senha da loja.'});return;}
   let body:any={};if(incoming.method==='POST'){
    let bytes=0;const chunks:Buffer[]=[];for await(const chunk of incoming){bytes+=chunk.length;if(bytes>650000){send(413,{error:'O arquivo ou formulário é muito grande.'});return;}chunks.push(chunk);}
    try{body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{send(400,{error:'Formulário inválido.'});return;}
   }
   if(path==='/api/auth/setup'&&incoming.method==='POST'){await createAdmin(body.username,body.password);send(200,{ok:true},{'Set-Cookie':sessionCookie(createSession(),secure)});return;}
   if(path==='/api/auth/login'&&incoming.method==='POST'){const ip=String(incoming.headers['x-forwarded-for']||incoming.socket.remoteAddress||'local').split(',')[0].trim();const token=await login(body.username,body.password,ip);send(200,{ok:true},{'Set-Cookie':sessionCookie(token,secure)});return;}
   if(path==='/api/auth/logout'&&incoming.method==='POST'){logout(req);send(200,{ok:true},{'Set-Cookie':sessionCookie('',secure)});return;}
   authorizeRequest(req);
   if(path==='/api/data'&&incoming.method==='GET'){send(200,await readData(storeScope));return;}
   if(path==='/api/action'&&incoming.method==='POST'){send(200,{ok:true,...await action(storeScope,body.action,body.payload,body.requestId||'')});return;}
   if(path==='/api/birthdays/run'&&incoming.method==='POST'){send(200,await processBirthdays(storeScope));return;}
   if(path==='/api/backup/sqlite'&&incoming.method==='GET'){
    const file=await createSnapshot('download');try{const bytes=readFileSync(file);outgoing.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Disposition':'attachment; filename="GP_Performance_Backup.sqlite"','Cache-Control':'no-store'});outgoing.end(bytes);}finally{unlinkSync(file);}return;
   }
   send(404,{error:'Não encontrado.'});
  }catch(error:any){const message=error.issues?.[0]?.message||(/bikeUnits.*chassisKey/.test(error.message)?'Já existe uma moto com esse chassi.':/constraint|SQLITE|D1_ERROR/i.test(error.message)?'O estoque ou a venda mudou. Atualize e confira os valores.':error.message||'Não foi possível concluir a operação.');send(400,{error:message});}
 });
 const port=Number(process.env.PORT||3000);await new Promise<void>((ok,reject)=>{server.once('error',reject);server.listen(port,process.env.HOST||'0.0.0.0',ok);});
 const address=server.address();console.log('GP Performance pronta na porta '+(typeof address==='object'?address?.port:port));
 const stopJobs=process.env.DISABLE_SCHEDULER==='1'?()=>{}:startJobs();
 const shutdown=()=>{stopJobs();server.close(()=>{env.DB?.raw.close();process.exit(0);});setTimeout(()=>process.exit(0),8000).unref();};process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
 return server;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))startServer().catch(()=>{console.error('Não foi possível iniciar a GP Performance. Verifique DATA_DIR, permissões, migrações e configuração do administrador.');process.exit(1);});
