import type {DatabaseSync} from 'node:sqlite';
export function ensureBikeUnits(raw:DatabaseSync){
 raw.exec('BEGIN IMMEDIATE');
 try{
  const rows=raw.prepare('SELECT b.*,m.price,l.receivedDate FROM stockLotBalances b JOIN models m ON m.id=b.modelId JOIN stockLots l ON l.id=b.lotId').all() as any[];
  const insert=raw.prepare('INSERT INTO bikeUnits(id,scope,modelId,lotId,price,unitCost,receivedDate,notes,createdAt) VALUES (?,?,?,?,?,?,?,?,?)');
  for(const b of rows){const {n}=raw.prepare("SELECT count(*) AS n FROM bikeUnits WHERE scope=? AND modelId=? AND lotId=? AND status='available'").get(b.scope,b.modelId,b.lotId) as any;if(n>b.quantity)throw Error('O saldo individual está acima do saldo do lote. Confira o banco antes de atualizar.');for(let i=n;i<b.quantity;i++)insert.run(crypto.randomUUID(),b.scope,b.modelId,b.lotId,b.price,b.unitCost,b.receivedDate,'Saldo anterior sem chassi ou condição informados.',b.createdAt);}
  raw.exec('COMMIT');
 }catch(e){raw.exec('ROLLBACK');throw e;}
}
