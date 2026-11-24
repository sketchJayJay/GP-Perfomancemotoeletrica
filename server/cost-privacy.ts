import {randomBytes,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {z} from 'zod';
import {env} from '../lib/runtime.ts';
import {cookieToken} from './auth.ts';
import type {CostAccess} from '../lib/costs-domain.ts';

const derive=promisify(scrypt),duration=5*60000,windowMs=15*60000;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const failure=(message:string,status=403)=>Object.assign(new Error(message),{status});
const config=(scope:string)=>env.DB!.raw.prepare('SELECT * FROM costProtection WHERE scope=?').get(scope) as any;
export function costAccess(req:Request,scope:string):CostAccess{
 const state=config(scope);if(!state?.enabled)return {enabled:false,unlocked:true,expiresAt:null};
 const token=req.headers.get('X-GP-Cost-Token')||'',session=cookieToken(req);
 if(!/^[a-f0-9]{64}$/.test(token)||!session)return {enabled:true,unlocked:false,expiresAt:null};
 const grant=env.DB!.raw.prepare('SELECT expiresAt FROM costGrants WHERE tokenHash=? AND sessionHash=? AND scope=? AND expiresAt>?').get(hash(token),hash(session),scope,Date.now()) as any;
 return {enabled:true,unlocked:!!grant,expiresAt:grant?.expiresAt||null};
}
export function requireCosts(req:Request,scope:string){if(!costAccess(req,scope).unlocked)throw failure('Digite a senha dos custos para acessar esta informação.');}
function checkAttempts(scope:string){const state=env.DB!.raw.prepare('SELECT * FROM costFailures WHERE scope=?').get(scope) as any;if(state?.blockedUntil>Date.now())throw failure('Muitas tentativas. Aguarde 15 minutos e tente novamente.',429);}
function failedAttempt(scope:string){
 const now=Date.now(),db=env.DB!.raw;
 db.prepare('INSERT INTO costFailures(scope,attempts,windowStart,blockedUntil) VALUES (?,1,?,0) ON CONFLICT(scope) DO UPDATE SET attempts=CASE WHEN windowStart<=? THEN 1 ELSE attempts+1 END,windowStart=CASE WHEN windowStart<=? THEN ? ELSE windowStart END,blockedUntil=CASE WHEN windowStart>? AND attempts+1>=5 THEN ? ELSE 0 END').run(scope,now,now-windowMs,now-windowMs,now,now-windowMs,now+windowMs);
}
async function matches(password:unknown,salt:string,passwordHash:string){
 const supplied=typeof password==='string'&&password.length<=256?password:'';
 const derived=await derive(supplied,salt,64) as Buffer,target=Buffer.from(passwordHash,'hex');
 return target.length===derived.length&&timingSafeEqual(derived,target);
}
async function verify(scope:string,password:unknown,row:any){
 checkAttempts(scope);
 if(!await matches(password,row.salt,row.passwordHash)){failedAttempt(scope);throw failure('Senha dos custos incorreta.',403);}
 env.DB!.raw.prepare('DELETE FROM costFailures WHERE scope=?').run(scope);
}
export async function unlockCosts(req:Request,scope:string,password:unknown){
 const row=config(scope);if(!row?.enabled)return {costAccess:costAccess(req,scope)};
 await verify(scope,password,row);
 if(config(scope)?.revision!==row.revision)throw failure('A senha foi alterada. Tente novamente.');
 const token=randomBytes(32).toString('hex'),now=Date.now(),expiresAt=now+duration,db=env.DB!.raw;
 db.prepare('DELETE FROM costGrants WHERE expiresAt<=?').run(now);
 db.prepare('INSERT INTO costGrants(tokenHash,sessionHash,scope,expiresAt,createdAt) VALUES (?,?,?,?,?)').run(hash(token),hash(cookieToken(req)),scope,expiresAt,new Date(now).toISOString());
 return {token,expiresAt,costAccess:{enabled:true,unlocked:true,expiresAt}};
}
export function lockCosts(req:Request,scope:string){const token=req.headers.get('X-GP-Cost-Token')||'';if(token)env.DB!.raw.prepare('DELETE FROM costGrants WHERE tokenHash=? AND sessionHash=? AND scope=?').run(hash(token),hash(cookieToken(req)),scope);return {enabled:!!config(scope)?.enabled,unlocked:!config(scope)?.enabled,expiresAt:null};}
const settingsSchema=z.object({action:z.enum(['enable','change','disable']),password:z.string().max(256).optional(),adminPassword:z.string().max(256).optional(),newPassword:z.string().min(8,'Crie uma senha dos custos com pelo menos 8 caracteres.').max(128).optional()});
export async function configureCosts(req:Request,scope:string,input:unknown){
 const p=settingsSchema.parse(input),row=config(scope),db=env.DB!.raw;
 if(row?.enabled)await verify(scope,p.password,row);
 else{
  if(p.action!=='enable')throw failure('A proteção dos custos ainda não está ativada.');
  checkAttempts(scope);const admin=db.prepare('SELECT * FROM adminCredentials WHERE id=1').get() as any;
  if(!admin||!await matches(p.adminPassword,admin.salt,admin.passwordHash)){failedAttempt(scope);throw failure('Confirme a senha de entrada do administrador.');}
  db.prepare('DELETE FROM costFailures WHERE scope=?').run(scope);
 }
 if(p.action!=='disable'&&!p.newPassword)throw failure('Defina a nova senha dos custos.',400);
 const salt=p.action==='disable'?'':randomBytes(24).toString('hex'),passwordHash=p.action==='disable'?'':(await derive(p.newPassword!,salt,64) as Buffer).toString('hex'),revision=row?.revision;
 db.exec('BEGIN IMMEDIATE');try{
  const latest=config(scope);if(latest?.revision!==revision)throw failure('A configuração mudou. Atualize a página.');
  if(row)db.prepare('UPDATE costProtection SET enabled=?,salt=?,passwordHash=?,revision=revision+1,updatedAt=? WHERE scope=?').run(p.action==='disable'?0:1,salt,passwordHash,new Date().toISOString(),scope);
  else db.prepare('INSERT INTO costProtection(scope,enabled,salt,passwordHash,updatedAt) VALUES (?,1,?,?,?)').run(scope,salt,passwordHash,new Date().toISOString());
  db.prepare('DELETE FROM costGrants WHERE scope=?').run(scope);db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 return {enabled:p.action!=='disable',unlocked:p.action==='disable',expiresAt:null};
}
export function protectCostAction(req:Request,scope:string,name:string,input:any){
 const access=costAccess(req,scope);if(access.unlocked)return input;
 if(['purchase','receivePurchase','cancelPurchase','model'].includes(name)||name==='movement'&&input?.kind==='entrada'||name==='entry'&&input?.category==='Fornecedor')requireCosts(req,scope);
 if(name==='stockUnit'){
  if(input?.unitCost!==null&&input?.unitCost!==undefined||input?.registerPayment)requireCosts(req,scope);
  const unit=typeof input?.id==='string'?env.DB!.raw.prepare('SELECT unitCost FROM bikeUnits WHERE id=? AND scope=?').get(input.id,scope) as any:null;
  return {...input,unitCost:unit?.unitCost??null,registerPayment:false};
 }
 return input;
}
