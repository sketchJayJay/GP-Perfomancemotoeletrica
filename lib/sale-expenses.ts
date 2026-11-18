export type SaleExpenseInput={description:string;category:string;payee:string;amount:number;paid:number;dueDate:string;payment:string;paymentDate:string;notes:string};
export function saleExpenseFields(row:SaleExpenseInput,saleId:string,date:string){
 return {description:row.description,category:row.category,payee:row.payee,quantity:1,unitAmount:row.amount,paid:row.paid,date,dueDate:row.dueDate,notes:row.notes,purchaseId:null,lotId:null,saleId,unitId:null,payment:row.payment,paymentDate:row.paymentDate};
}
