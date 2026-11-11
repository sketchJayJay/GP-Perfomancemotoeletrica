import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {emptyData,demoAction,today,normalizePhone} from '../lib/domain.ts';
import {validate} from '../lib/validation.ts';

const model={name:'Teste',brand:'GP',power:'2000 W',rangeKm:60,battery:'60V',color:'Preta',cost:500000,price:800000,minStock:1,initialStock:2,image:''};
const customer={name:'Cliente teste',phone:'',document:'',birthday:'',email:'',city:'',address:'',notes:'',consent:0};
const sale=(m,c)=>({modelId:m,customerId:c,quantity:1,unitPrice:800000,discount:50000,paid:200000,payment:'Pix',dueDate:today(),date:today(),chassis:'',notes:''});

test('venda parcial, quitação e cancelamento reconciliam estoque e caixa',()=>{
 let d=demoAction(emptyData(),'model',model);d=demoAction(d,'customer',customer);const m=d.models[0].id,c=d.customers[0].id;
 d=demoAction(d,'sale',validate('sale',sale(m,c)));
 assert.equal(d.models[0].stock,1);assert.equal(d.sales[0].total,750000);assert.equal(d.sales[0].total-d.sales[0].paid,550000);
 const id=d.sales[0].id;d=demoAction(d,'payment',{id,amount:550000,payment:'Pix',date:today()});assert.equal(d.sales[0].paid,750000);
 d=demoAction(d,'cancelSale',{id});assert.equal(d.models[0].stock,2);assert.equal(d.sales[0].status,'cancelled');
 assert.equal(d.ledger.reduce((a,e)=>a+(e.type==='in'?e.amount:-e.amount),0),0);
 assert.throws(()=>demoAction(d,'cancelSale',{id}));
});
test('estoque não fica negativo e recebimento não ultrapassa o saldo',()=>{
 let d=demoAction(emptyData(),'model',model);d=demoAction(d,'customer',customer);const m=d.models[0].id,c=d.customers[0].id;
 assert.throws(()=>demoAction(d,'movement',{modelId:m,kind:'saida',quantity:3,unitCost:0}));
 d=demoAction(d,'sale',sale(m,c));assert.throws(()=>demoAction(d,'payment',{id:d.sales[0].id,amount:550001,payment:'Pix'}));
});
test('validação exige valores em centavos, data real e vencimento para saldo',()=>{
 assert.throws(()=>validate('sale',{...sale('m','c'),discount:900000}));
 assert.throws(()=>validate('sale',{...sale('m','c'),dueDate:''}));
 assert.throws(()=>validate('sale',{...sale('m','c'),paid:750001}));
 assert.throws(()=>validate('sale',{...sale('m','c'),date:'2026-02-30'}));
 assert.throws(()=>validate('model',{...model,price:0.3}));
 assert.equal(normalizePhone('(32) 99999-1234'),'5532999991234');
});
function db(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));db.prepare("INSERT INTO models(id,scope,name,stock,createdAt) VALUES ('m','u','Moto',1,'2026-11-11')").run();db.prepare("INSERT INTO customers(id,scope,name,createdAt) VALUES ('c','u','Cliente','2026-11-11')").run();return db;}
test('banco rejeita estoque negativo e desfaz toda a transação',()=>{
 const d=db();d.exec('BEGIN');try{d.prepare("INSERT INTO ledger(id,scope,type,amount,description,category,payment,date,createdAt) VALUES ('l','u','in',100,'Venda','Venda','Pix','2026-11-11','2026-11-11')").run();d.prepare("UPDATE models SET stock=stock-2 WHERE id='m'").run();assert.fail('Deveria rejeitar estoque negativo');}catch(e){d.exec('ROLLBACK');}
 assert.equal(d.prepare("SELECT stock FROM models WHERE id='m'").get().stock,1);assert.equal(d.prepare('SELECT count(*) AS n FROM ledger').get().n,0);d.close();
});
test('aniversário tem envio único por ano e operação não pode duplicar',()=>{
 const d=db();const stmt=d.prepare('INSERT INTO birthdayLogs(id,scope,customerId,year,status,message,createdAt) VALUES (?,?,?,?,?,?,?)');stmt.run('b1','u','c',2026,'accepted','Mensagem','2026-11-11');assert.throws(()=>stmt.run('b2','u','c',2026,'accepted','Mensagem','2026-11-11'));stmt.run('b3','u','c',2027,'accepted','Mensagem','2027-11-11');d.prepare("INSERT INTO operations VALUES ('r','u','sale','s','2026-11-11')").run();assert.throws(()=>d.prepare("INSERT INTO operations VALUES ('r','u','sale','s2','2026-11-11')").run());d.close();
});
