import { z } from 'zod';
const text=z.string().trim().max(1000),short=z.string().trim().max(160),id=z.string().min(1).max(80);
const cents=z.number().int().min(0).max(10000000000),qty=z.number().int().min(1).max(10000);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d=>!isNaN(+new Date(d+'T12:00:00'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d,'Data inválida');
const optionalDate=z.union([date,z.literal('')]);
const payment=z.enum(['Pix','Dinheiro','Cartão de crédito','Cartão de débito','Transferência','Financiamento','Outro']);
export const schemas={
 model:z.object({id:id.optional(),name:short.min(2,'Informe o nome do modelo'),brand:short,power:short,rangeKm:z.number().int().min(0).max(5000),battery:short,color:short,cost:cents,price:cents,minStock:z.number().int().min(0).max(10000),initialStock:z.number().int().min(0).max(10000).optional(),image:z.string().max(500000).refine(s=>!s||/^data:image\/(jpeg|png|webp);base64,/.test(s)||s.startsWith('https://'),'Use uma imagem ou endereço HTTPS')}),
 customer:z.object({id:id.optional(),name:short.min(2,'Informe o nome do cliente'),phone:short.refine(s=>!s||/^(\d{10,13})$/.test(s.replace(/\D/g,'')),'WhatsApp inválido'),document:short,birthday:optionalDate,email:z.union([z.string().email('E-mail inválido').max(160),z.literal('')]),city:short,address:text,notes:text,consent:z.number().int().min(0).max(1)}),
 movement:z.object({modelId:id,kind:z.enum(['entrada','saida']),quantity:qty,unitCost:cents,reference:short,notes:text,date,registerPayment:z.boolean(),payment}),
 sale:z.object({customerId:id,modelId:id,quantity:qty,unitPrice:cents,discount:cents,paid:cents,payment,dueDate:optionalDate,date,chassis:short,notes:text}).refine(s=>s.discount<=s.unitPrice*s.quantity,'Desconto superior ao total').refine(s=>s.paid<=s.unitPrice*s.quantity-s.discount,'Recebimento superior ao total').refine(s=>s.paid===s.unitPrice*s.quantity-s.discount||!!s.dueDate,'Informe o vencimento do saldo'),
 payment:z.object({id,revision:z.number().int(),amount:cents.refine(n=>n>0,'Informe o valor recebido'),payment,date}),
 cancelSale:z.object({id,revision:z.number().int()}),archiveModel:z.object({id}),archiveCustomer:z.object({id}),
 entry:z.object({type:z.enum(['in','out']),amount:cents.refine(n=>n>0,'Informe um valor maior que zero'),description:short.min(2),category:short.min(2),payment,date}),
 settings:z.object({storeName:short.min(2),phone:short,document:short,address:text,monthlyGoal:cents.refine(n=>n>0),birthdayEnabled:z.number().int().min(0).max(1),birthdayTemplate:z.string().trim().min(10).max(4000)}),
};
export function validate(action:string,p:unknown){const s=schemas[action as keyof typeof schemas];if(!s)throw Error('Operação inválida.');return s.parse(p) as any;}
