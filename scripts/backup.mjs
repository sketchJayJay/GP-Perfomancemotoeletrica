import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {resolve,join} from 'node:path';
const dir=resolve(process.env.DATA_DIR||'data');mkdirSync(join(dir,'backups'),{recursive:true});
const db=new DatabaseSync(join(dir,'gp-performance.sqlite'),{readOnly:true});
const target=join(dir,'backups','manual-'+new Date().toISOString().replaceAll(':','-')+'.sqlite');
await backup(db,target);chmodSync(target,0o600);db.close();console.log('Backup criado: '+target);
