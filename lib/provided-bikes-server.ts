import type {Database,Prepared} from './runtime.ts';
import {LotBook} from './lot-stock.ts';
import {chassisKey} from './bikes-domain.ts';
import {providedBikes,providedBikeBatch} from './provided-bikes.ts';
export async function seedProvidedBikes(db:Database,scope:string){
 if(process.env.SEED_GP_BIKES==='0')return;
 if(await db.prepare('SELECT id FROM dataImports WHERE id=? AND scope=?').bind(providedBikeBatch,scope).first())return;
 const createdAt=new Date().toISOString(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),prefix:Prepared[]=[],book=new LotBook(db,scope,createdAt),result={added:0,existing:0,alreadySold:0};
 let code='MOTOS-ENVIADAS-13112026',suffix=1;
 while(await db.prepare('SELECT id FROM stockLots WHERE scope=? AND code=? COLLATE NOCASE').bind(scope,code).first())code='MOTOS-ENVIADAS-13112026-'+(++suffix);
 const lotId=await book.lot(code,{notes:'Cadastro solicitado com as fotos de 13/11/2026. Número REAL do lote, data de chegada, fornecedor, custo e condição não foram informados. Edite o lote e as motos para completar.'});
 for(const b of providedBikes){
  const key=chassisKey(b.chassis),existing=key?await db.prepare('SELECT * FROM bikeUnits WHERE scope=? AND chassisKey=?').bind(scope,key).first<any>():null;
  if(existing){result.existing++;if(existing.status==='available')prefix.push(db.prepare('UPDATE bikeUnits SET price=?,image=?,revision=revision+1 WHERE id=? AND scope=?').bind(b.price,b.image,existing.id,scope));continue;}
  const oldSales=key?(await db.prepare("SELECT chassis FROM sales WHERE scope=? AND status='active' AND chassis!=''").bind(scope).all<any>()).results:[];
  if(key&&oldSales.some(s=>chassisKey(s.chassis)===key)){result.alreadySold++;continue;}
  let model=await db.prepare('SELECT id FROM models WHERE scope=? AND name=? COLLATE NOCASE AND color=? COLLATE NOCASE ORDER BY archived,id LIMIT 1').bind(scope,b.name,b.color).first<any>();
  if(!model){model={id:crypto.randomUUID()};prefix.push(db.prepare('INSERT INTO models(id,scope,name,color,price,image,minStock,createdAt) VALUES (?,?,?,?,?,?,0,?)').bind(model.id,scope,b.name,b.color,b.price,b.image,createdAt));}
  const ids=await book.add(lotId,model.id,1,null,[{chassis:b.chassis,price:b.price,image:b.image,condition:'unknown',sourceKey:providedBikeBatch+'/'+b.key,notes:'Preço de venda solicitado: R$ 8.000. Custo e condição a informar.'+(b.chassis?' Chassi transcrito da mensagem enviada.':' Chassi não foi enviado.')}]);book.sync(model.id);
  book.statements.push(db.prepare("INSERT INTO movements(id,scope,modelId,lotId,unitId,delta,kind,unitCost,reference,notes,date,createdAt) VALUES (?,?,?,?,?,1,'entrada',0,?,?,?,?)").bind(crypto.randomUUID(),scope,model.id,lotId,ids[0],'Cadastro das motos enviadas','Custo de aquisição pendente. Data deste lançamento é a do cadastro, não a chegada física.',date,createdAt));result.added++;
 }
 await db.batch([...prefix,...book.statements,db.prepare('INSERT INTO dataImports(id,scope,result,createdAt) VALUES (?,?,?,?)').bind(providedBikeBatch,scope,JSON.stringify(result),createdAt)]);
}
