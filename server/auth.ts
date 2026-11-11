import {randomBytes,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {env} from '../lib/runtime.ts';
const derive=promisify(scrypt);
export const cookieName='gp_session';
const duration=7*86400;
const attempts=new Map<string,{count:number;until:number}>();
export function setupRequired(){return !env.DB!.raw.prepare('SELECT id FROM adminCredentials WHERE id=1').get();}
export async function createAdmin(username:unknown,password:unknown){
 if(!setupRequired())throw Error('O administrador já foi configurado.');
 if(typeof username!=='string'||username.trim().length<2||username.length>80)throw Error('Informe um usuário com 2 a 80 caracteres.');
 if(typeof password!=='string'||password.length<8||password.length>256)throw Error('Crie uma senha com pelo menos 8 caracteres.');
 const salt=randomBytes(24).toString('hex'),hash=(await derive(password,salt,64) as Buffer).toString('hex');
 try{env.DB!.raw.prepare('INSERT INTO adminCredentials VALUES (1,?,?,?,?)').run(username.trim(),salt,hash,new Date().toISOString());}catch{throw Error('O administrador já foi configurado. Entre com o usuário criado.');}
}
export async function bootstrapAdmin(){if(setupRequired()&&process.env.ADMIN_PASSWORD)await createAdmin(process.env.ADMIN_USERNAME||'admin',process.env.ADMIN_PASSWORD);}
export async function login(username:unknown,password:unknown,ip:string){
 const now=Date.now(),state=attempts.get(ip);if(state&&state.until>now&&state.count>=5)throw Error('Muitas tentativas. Aguarde 15 minutos e tente novamente.');
 const row=env.DB!.raw.prepare('SELECT * FROM adminCredentials WHERE id=1').get() as any;
 if(!row)throw Error('Configure o administrador no primeiro acesso.');
 const supplied=typeof password==='string'&&password.length<=256?password:'';
 const hash=await derive(supplied,row.salt,64) as Buffer;
 const valid=typeof username==='string'&&username.trim()===row.username&&timingSafeEqual(hash,Buffer.from(row.passwordHash,'hex'));
 if(!valid){attempts.set(ip,{count:state&&state.until>now?state.count+1:1,until:now+15*60000});if(attempts.size>3000)for(const [key,v] of attempts)if(v.until<now)attempts.delete(key);throw Error('Usuário ou senha incorretos.');}
 attempts.delete(ip);return createSession();
}
export function createSession(){const token=randomBytes(32).toString('hex'),tokenHash=createHash('sha256').update(token).digest('hex'),expiresAt=Date.now()+duration*1000;env.DB!.raw.prepare('DELETE FROM sessions WHERE expiresAt<?').run(Date.now());env.DB!.raw.prepare('INSERT INTO sessions VALUES (?,?,?)').run(tokenHash,expiresAt,new Date().toISOString());return token;}
export function cookieToken(req:Request){const m=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='));return m?m.slice(cookieName.length+1):'';}
export function authenticated(req:Request){const token=cookieToken(req);if(!/^[a-f0-9]{64}$/.test(token))return false;return !!env.DB!.raw.prepare('SELECT tokenHash FROM sessions WHERE tokenHash=? AND expiresAt>?').get(createHash('sha256').update(token).digest('hex'),Date.now());}
export function sessionCookie(token:string,secure:boolean){return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token?duration:0}${secure?'; Secure':''}`;}
export function logout(req:Request){const token=cookieToken(req);if(token)env.DB!.raw.prepare('DELETE FROM sessions WHERE tokenHash=?').run(createHash('sha256').update(token).digest('hex'));}
