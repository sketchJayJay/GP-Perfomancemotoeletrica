import type {Data} from './domain.ts';
import {syncDemoModel} from './bikes-domain.ts';
export function demoLotExclusion(d:Data,action:string,p:any,createdAt:string,date:string){
 const lot=d.stockLots.find(l=>l.id===p.id);if(!lot||(lot.revision||0)!==p.revision)throw Error('Este lote ou seu estoque foi alterado. Atualize a página.');
 const removing=action==='deleteLot';if(removing&&lot.deletedAt)throw Error('Lote já excluído.');if(!removing&&!lot.deletedAt)throw Error('Lote já ativo.');
 if(removing&&(d.saleLots.some(r=>r.lotId===p.id&&d.sales.some(s=>s.id===r.saleId&&s.status==='active'))||d.bikeUnits.some(u=>u.lotId===p.id&&u.status==='sold')))throw Error('Este lote tem venda ativa. Resolva a venda antes de excluir o lote.');
 const units=d.bikeUnits.filter(u=>u.lotId===p.id&&(removing?u.status==='available':u.status==='out'&&u.excludedWithLot===1));
 lot.deletedAt=removing?createdAt:'';lot.revision=(lot.revision||0)+1;
 for(const u of units){u.status=removing?'out':'available';u.excludedWithLot=removing?1:0;u.revision++;d.movements.unshift({id:crypto.randomUUID(),modelId:u.modelId,lotId:p.id,unitId:u.id,delta:removing?-1:1,kind:removing?'exclusao_lote':'restauracao_lote',unitCost:u.unitCost??0,reference:lot.code,notes:u.chassis||'Chassi a informar',date,createdAt});}
 for(const modelId of new Set(units.map(u=>u.modelId)))syncDemoModel(d,modelId);return d;
}
