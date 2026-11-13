import { z } from 'zod';
import {expenseCategories} from './expenses-domain.ts';
const text=z.string().trim().max(1000),short=z.string().trim().max(160),id=z.string().min(1).max(80);
const cents=z.number().int().min(0).max(10000000000),qty=z.number().int().min(1).max(10000);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d=>!isNaN(+new Date(d+'T12:00:00'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d,'Data inválida');
const optionalDate=z.union([date,z.literal('')]);
const payment=z.enum(['Pix','Dinheiro','Cartão de crédito','Cartão de débito','Transferência','Financiamento','Outro']);
const purchaseItems=z.array(z.object({modelId:id,quantity:qty,unitCost:cents})).min(1,'Adicione ao menos um modelo ao lote').max(100).refine(items=>new Set(items.map(i=>i.modelId)).size===items.length,'Coloque cada modelo em uma única linha');
const lotCode=z.string().trim().max(80).transform(s=>s.toUpperCase());
const linkId=z.union([id,z.literal('')]).nullable().optional().transform(v=>v||null);
const expenseSchema=z.object({id:id.optional(),revision:z.number().int().min(0).optional(),description:short.min(2,'Descreva a despesa'),category:z.enum(expenseCategories),payee:short,purchaseId:linkId,lotId:linkId,saleId:linkId,quantity:qty,unitAmount:cents.refine(n=>n>0,'Informe o valor da despesa'),paid:cents.default(0),date,dueDate:optionalDate,notes:text,payment,paymentDate:optionalDate.default('')}).superRefine((p,ctx)=>{
 const fail=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if(p.id&&p.revision===undefined)fail('Atualize a despesa antes de editar');
 if([p.purchaseId,p.lotId,p.saleId].filter(Boolean).length>1)fail('Vincule a despesa a uma compra, lote ou venda');
 const total=p.quantity*p.unitAmount;
 if(total>10000000000)fail('Valor total da despesa acima do permitido');
 if(p.paid>total)fail('Pagamento superior ao total da despesa');
 if(p.paid<total&&!p.dueDate)fail('Informe o vencimento do saldo a pagar');
 if(p.paid>0&&!p.paymentDate)fail('Informe a data do pagamento');
});
export const schemas={
 expense:expenseSchema,
 payExpense:z.object({id,revision:z.number().int().min(0),amount:cents.refine(n=>n>0,'Informe um valor maior que zero'),payment,date}),
 cancelExpense:z.object({id,revision:z.number().int().min(0)}),
 assignLot:z.object({modelId:id,fromLotId:id,quantity:qty,lotCode:lotCode.refine(s=>s.length>0,'Informe o lote de destino'),date}),
 purchase:z.object({id:id.optional(),revision:z.number().int().min(0).optional(),lotCode:lotCode.default(''),date,supplier:short.min(2,'Informe o fornecedor'),buyer:short,carrier:short,expectedDate:optionalDate,freight:cents,status:z.enum(['planned','purchased','in_transit']),notes:text,items:purchaseItems}).refine(p=>!p.id||p.revision!==undefined,'Atualize a compra antes de editar'),
 receivePurchase:z.object({id,revision:z.number().int().min(0),date,registerPayment:z.boolean(),payment}),
 cancelPurchase:z.object({id,revision:z.number().int().min(0)}),
 model:z.object({id:id.optional(),name:short.min(2,'Informe o nome do modelo'),brand:short,power:short,rangeKm:z.number().int().min(0).max(5000),battery:short,color:short,cost:cents,price:cents,minStock:z.number().int().min(0).max(10000),initialLotCode:lotCode.optional(),initialStock:z.number().int().min(0).max(10000).optional(),image:z.string().max(500000).refine(s=>!s||/^data:image\/(jpeg|png|webp);base64,/.test(s)||s.startsWith('https://'),'Use uma imagem ou endereço HTTPS')}),
 customer:z.object({id:id.optional(),name:short.min(2,'Informe o nome do cliente'),phone:short.refine(s=>!s||/^(\d{10,13})$/.test(s.replace(/\D/g,'')),'WhatsApp inválido'),document:short,birthday:optionalDate,email:z.union([z.string().email('E-mail inválido').max(160),z.literal('')]),city:short,address:text,notes:text,consent:z.number().int().min(0).max(1)}),
 movement:z.object({lotId:id.optional(),lotCode:lotCode.optional(),modelId:id,kind:z.enum(['entrada','saida']),quantity:qty,unitCost:cents,reference:short,notes:text,date,registerPayment:z.boolean(),payment}),
 sale:z.object({lotId:id.optional(),customerId:id,modelId:id,quantity:qty,unitPrice:cents,discount:cents,paid:cents,payment,dueDate:optionalDate,date,chassis:short,notes:text}).refine(s=>s.discount<=s.unitPrice*s.quantity,'Desconto superior ao total').refine(s=>s.paid<=s.unitPrice*s.quantity-s.discount,'Recebimento superior ao total').refine(s=>s.paid===s.unitPrice*s.quantity-s.discount||!!s.dueDate,'Informe o vencimento do saldo'),
 payment:z.object({id,revision:z.number().int(),amount:cents.refine(n=>n>0,'Informe o valor recebido'),payment,date}),
 cancelSale:z.object({id,revision:z.number().int()}),archiveModel:z.object({id}),archiveCustomer:z.object({id}),
 entry:z.object({type:z.enum(['in','out']),amount:cents.refine(n=>n>0,'Informe um valor maior que zero'),description:short.min(2),category:short.min(2),payment,date}),
 settings:z.object({storeName:short.min(2),phone:short,document:short,address:text,monthlyGoal:cents.refine(n=>n>0),birthdayEnabled:z.number().int().min(0).max(1),birthdayTemplate:z.string().trim().min(10).max(4000)}),
};
export function validate(action:string,p:unknown){const s=schemas[action as keyof typeof schemas];if(!s)throw Error('Operação inválida.');return s.parse(p) as any;}
