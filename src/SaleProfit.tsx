'use client';
import {useState,type Dispatch,type SetStateAction} from 'react';
import {Plus,Trash2,TrendingUp,Download,Wallet,Users,Search} from 'lucide-react';
import {useApp} from './context';
import {type Sale,money,today,dateLabel} from '@/lib/domain';
import {saleProfit,previewBikeProfit} from '@/lib/sale-profit';
import {type SaleExpenseInput} from '@/lib/sale-expenses';
import {expenseCategories} from '@/lib/expenses-domain';
import {F,MoneyInput} from './Forms';
import {Empty,Tag,exportCsv} from './Dashboard';

export type ExpenseDraft=SaleExpenseInput&{key:string;isPaid:boolean};
export const expensePayload=(rows:ExpenseDraft[]):SaleExpenseInput[]=>rows.map(({key,isPaid,...r})=>({...r,paid:isPaid?r.amount:0,dueDate:isPaid?'':r.dueDate,paymentDate:isPaid?r.paymentDate:''}));
export function SaleExpenseEditor({rows,onChange}:{rows:ExpenseDraft[];onChange:Dispatch<SetStateAction<ExpenseDraft[]>>}){
 const {data}=useApp(),employees=[...new Set(data.expenses.filter(e=>e.category==='Comissão'&&e.payee).map(e=>e.payee))];
 const add=(category:string)=>onChange(r=>[...r,{key:crypto.randomUUID(),description:category==='Comissão'?'Comissão de venda':category,category,payee:'',amount:0,paid:0,isPaid:false,dueDate:today(),payment:'Pix',paymentDate:today(),notes:''}]);
 const update=(key:string,fields:Partial<ExpenseDraft>)=>onChange(r=>r.map(e=>e.key===key?{...e,...fields}:e));
 return <section className="sale-expense-editor">
  <div className="profit-section-heading"><div><h3>Despesas desta venda</h3><p>Uma comissão por funcionário. Acrescente frete, montagem e outros gastos.</p></div><Users size={22}/></div>
  {rows.map((r,i)=><article className="sale-expense-draft" key={r.key}>
   <div className="sale-expense-draft-head"><strong>{r.category==='Comissão'?'Comissão':'Despesa'} {i+1}{r.payee?' · '+r.payee:''}</strong><button type="button" className="icon-btn" aria-label={'Remover despesa '+(i+1)} onClick={()=>onChange(items=>items.filter(e=>e.key!==r.key))}><Trash2 size={17}/></button></div>
   <div className="form-grid">
    <F label="Tipo de gasto"><select aria-label={'Tipo da despesa '+(i+1)} value={r.category} onChange={e=>update(r.key,{category:e.target.value,description:e.target.value==='Comissão'?'Comissão de venda':e.target.value})}>{expenseCategories.map(c=><option key={c}>{c}</option>)}</select></F>
    <F label={r.category==='Comissão'?'Funcionário *':'Quem recebe'}><input aria-label={'Favorecido da despesa '+(i+1)} required={r.category==='Comissão'} maxLength={160} value={r.payee} list="sale-commission-employees" placeholder={r.category==='Comissão'?'Nome do funcionário':'Montador, transportador...'} onChange={e=>update(r.key,{payee:e.target.value})}/></F>
    <F label="Descrição *" wide><input aria-label={'Descrição da despesa '+(i+1)} required minLength={2} maxLength={160} value={r.description} onChange={e=>update(r.key,{description:e.target.value})}/></F>
    <F label="Valor da despesa *"><MoneyInput value={r.amount} min={1} onChange={amount=>update(r.key,{amount})}/></F>
    <F label="Pagamento"><select aria-label={'Pagamento da despesa '+(i+1)} value={r.isPaid?'paid':'pending'} onChange={e=>update(r.key,{isPaid:e.target.value==='paid'})}><option value="pending">A pagar</option><option value="paid">Já paga</option></select></F>
    {r.isPaid?<><F label="Data do pagamento *"><input type="date" required value={r.paymentDate} onChange={e=>update(r.key,{paymentDate:e.target.value})}/></F><F label="Forma de pagamento"><select value={r.payment} onChange={e=>update(r.key,{payment:e.target.value})}>{['Pix','Dinheiro','Cartão de crédito','Cartão de débito','Transferência','Financiamento','Outro'].map(m=><option key={m}>{m}</option>)}</select></F></>:<F label="Vencimento *" wide><input type="date" required value={r.dueDate} onChange={e=>update(r.key,{dueDate:e.target.value})}/></F>}
   </div>
  </article>)}
  <datalist id="sale-commission-employees">{employees.map(n=><option key={n} value={n}/>)}</datalist>
  <div className="profit-add-buttons"><button type="button" className="btn secondary" disabled={rows.length>=40} onClick={()=>add('Comissão')}><Plus size={16}/>Adicionar comissão</button><button type="button" className="btn secondary" disabled={rows.length>=40} onClick={()=>add('Frete / entrega')}><Plus size={16}/>Adicionar despesa</button></div>
  <p className="profit-caption">Os gastos serão salvos junto com a venda. Valores a pagar entram nas despesas; somente os marcados como pagos saem do caixa.</p>
 </section>;
}

export function ProfitPreview({unitId,revenue,draftExpenses}:{unitId:string;revenue:number;draftExpenses:number}){
 const {data}=useApp(),r=previewBikeProfit(data,unitId,revenue,draftExpenses);
 return <section className={'profit-preview'+(r.profit<0?' loss':'')} aria-live="polite">
  <div className="profit-section-heading"><div><span className="profit-eyebrow">ANTES DE CONFIRMAR</span><h3>{r.partial?'Resultado parcial da moto':'Lucro previsto desta moto'}</h3></div><TrendingUp size={25}/></div>
  <dl className="profit-calculation"><div><dt>Valor da venda, com desconto</dt><dd>{money(revenue)}</dd></div><div><dt>Custo da moto</dt><dd>{r.partial?'A informar':'− '+money(r.cost)}</dd></div><div><dt>Gastos da moto e rateios já cadastrados</dt><dd>− {money(r.registered)}</dd></div><div><dt>Comissões e despesas desta venda</dt><dd>− {money(draftExpenses)}</dd></div><div className="profit-final"><dt>{r.partial?'Resultado parcial':r.profit<0?'Prejuízo previsto':'Lucro previsto'}</dt><dd>{money(r.profit)}</dd></div></dl>
  <p className="profit-caption">{r.partial?'Complete o custo da moto para apurar o lucro.':'Inclui despesas pagas e a pagar. Margem: '+r.margin.toLocaleString('pt-BR',{maximumFractionDigits:2})+'% sobre a venda.'}</p>
 </section>;
}

export function SaleProfitPanel({sale}:{sale:Sale}){
 const {data,open}=useApp(),r=saleProfit(data,sale);
 if(sale.status!=='active')return <aside className="profit-cancelled">Venda cancelada: fora do relatório de lucro. As despesas já realizadas continuam no financeiro.</aside>;
 return <section className={'sale-profit-panel'+(r.profit<0?' loss':'')}>
  <div className="profit-section-heading"><div><span className="profit-eyebrow">RESUMO INTERNO DA VENDA</span><h3>{r.partial?'Resultado parcial':sale.quantity===1?'Lucro desta moto':'Lucro das motos desta venda'}</h3><p>Após o custo e todas as despesas vinculadas, inclusive as que faltam pagar.</p></div><Tag tone={r.partial?'amber':r.profit<0?'rose':'green'}>{r.partial?'Conferir custos':r.profit<0?'Prejuízo':'Lucro apurado'}</Tag></div>
  <div className="profit-equation"><div><span>Valor vendido</span><strong>{money(r.revenue)}</strong></div><div><span>Custo das motos</span><strong>{money(r.cost)}</strong></div><div><span>Despesas e comissões</span><strong>{money(r.expenses)}</strong></div><div className="profit-equation-net"><span>{r.partial?'Resultado parcial':r.profit<0?'Prejuízo':'Lucro da venda'}</span><strong>{money(r.profit)}</strong><small>{r.partial?'Custo ou identificação pendente':r.margin.toLocaleString('pt-BR',{maximumFractionDigits:2})+'% de margem'}</small></div></div>
  {r.partial&&<p className="profit-warning">{r.missingUnits?'Esta venda antiga não identifica todas as motos individualmente. Os gastos comuns podem estar incompletos.':'Falta informar o custo de compra de uma ou mais motos. O valor acima ainda não é o lucro final.'}</p>}
  <div className="profit-balances"><span><Wallet size={15}/>Despesas a pagar: <b>{money(r.pendingExpenses)}</b></span><span>Venda a receber: <b>{money(sale.total-sale.paid)}</b></span></div>
  <details className="profit-expense-breakdown" open={r.details.length<=6}><summary>Conferir gastos descontados ({r.details.length})</summary>{r.details.length?<ul>{r.details.map(row=><li key={row.expense.id}><button onClick={()=>open({type:'expenseDetail',item:row.expense})}><span><strong>{row.expense.description}</strong><small>{row.expense.category}{row.expense.payee?' · '+row.expense.payee:''}</small>{row.shared&&<small>Rateio em {row.recipientCount} motos · total original {money(row.expense.amount)}</small>}<small>{money(row.amount-row.paid)} a pagar nesta parte</small></span><b>{money(row.amount)}</b></button></li>)}</ul>:<p className="profit-caption">Nenhuma despesa extra vinculada. Adicione os gastos para completar a apuração.</p>}</details>
  {r.units.length>1&&<div className="table-wrap"><table><thead><tr><th>Chassi / moto</th><th>Venda</th><th>Custo</th><th>Despesas</th><th>Lucro</th></tr></thead><tbody>{r.units.map(u=><tr key={u.unitId}><td>{u.chassis||u.unitId.slice(0,8)}</td><td>{money(u.revenue)}</td><td>{u.partial?'Pendente':money(u.cost)}</td><td>{money(u.expenses)}</td><td>{money(u.profit)}{u.partial?' (parcial)':''}</td></tr>)}</tbody></table></div>}
  <div className="profit-add-buttons"><button className="btn secondary" onClick={()=>open({type:'expense',item:{saleId:sale.id,category:'Comissão',description:'Comissão de venda'}})}><Plus size={16}/>Adicionar comissão</button><button className="btn secondary" onClick={()=>open({type:'expense',item:{saleId:sale.id}})}><Plus size={16}/>Adicionar despesa</button></div>
  <p className="profit-caption">O frete da compra já faz parte do custo da moto. Gastos de compra/lote são rateados entre as motos; gastos gerais da loja ficam no resultado mensal. Este resumo interno não aparece no recibo do cliente.</p>
 </section>;
}

export default function ProfitReport(){
 const {data,open}=useApp(),[month,setMonth]=useState(today().slice(0,7)),[q,setQ]=useState('');
 const records=data.sales.filter(s=>s.status==='active'&&(!month||s.date.startsWith(month))).map(s=>saleProfit(data,s)).filter(r=>{const text=r.sale.number+' '+data.customers.find(c=>c.id===r.sale.customerId)?.name+' '+data.models.find(m=>m.id===r.sale.modelId)?.name+' '+r.units.map(u=>u.chassis).join(' ');return text.toLowerCase().includes(q.toLowerCase());});
 const sum=(field:'revenue'|'cost'|'expenses'|'profit')=>records.reduce((n,r)=>n+r[field],0),partial=records.some(r=>r.partial);
 const rows=records.flatMap(r=>(r.units.length?r.units:[{unitId:'',chassis:r.sale.chassis||'Venda sem identificação individual',revenue:r.revenue,cost:r.cost,expenses:r.expenses,profit:r.profit,partial:true}]).map(u=>({...u,sale:r.sale,model:data.models.find(m=>m.id===r.sale.modelId)?.name||'Moto'})));
 const csv=()=>exportCsv('GP_Lucro_Por_Moto_'+(month||'Todos')+'.csv',['Data','Venda','Moto','Chassi','Venda (R$)','Custo (R$)','Despesas (R$)','Lucro (R$)','Apuração'],rows.map(r=>[dateLabel(r.sale.date),r.sale.number,r.model,r.chassis,(r.revenue/100).toFixed(2),(r.cost/100).toFixed(2),(r.expenses/100).toFixed(2),(r.profit/100).toFixed(2),r.partial?'Parcial':'Custos informados']));
 return <div className="profit-report"><div className="profit-section-heading"><div><h2>Lucro por moto</h2><p>Saiba o que cada venda deixou depois do custo, comissões e gastos vinculados.</p></div><button className="btn secondary" onClick={csv}><Download size={16}/>Exportar</button></div>
  <div className="profit-report-filters"><F label="Mês da venda"><input aria-label="Mês do lucro por moto" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></F><button className="btn secondary" onClick={()=>setMonth('')}>Todos os meses</button><label className="search-field"><Search size={16}/><input aria-label="Buscar lucro por moto" placeholder="Moto, chassi, cliente ou venda..." value={q} onChange={e=>setQ(e.target.value)}/></label></div>
  <div className="profit-equation"><div><span>Vendas filtradas</span><strong>{money(sum('revenue'))}</strong></div><div><span>Custo das motos</span><strong>{money(sum('cost'))}</strong></div><div><span>Despesas vinculadas</span><strong>{money(sum('expenses'))}</strong></div><div className={'profit-equation-net'+(sum('profit')<0?' loss':'')}><span>{partial?'Resultado parcial':'Lucro das motos'}</span><strong>{money(sum('profit'))}</strong></div></div>
  {partial&&<p className="profit-warning">Há custo ou identificação individual pendente. Confira as vendas marcadas como parciais.</p>}
  {rows.length?<><div className="table-wrap profit-report-desktop"><table><thead><tr><th>Moto / chassi</th><th>Venda / data</th><th>Valor vendido</th><th>Custo</th><th>Despesas</th><th>Lucro</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.sale.id+r.unitId+i} onClick={()=>open({type:'saleDetail',item:r.sale})}><td><strong>{r.model}</strong><small>{r.chassis||'Chassi a informar'}</small></td><td>{r.sale.number}<small>{dateLabel(r.sale.date)}</small></td><td>{money(r.revenue)}</td><td>{money(r.cost)}</td><td>{money(r.expenses)}</td><td className={r.profit<0?'negative':'positive'}><strong>{money(r.profit)}</strong>{r.partial&&<small>Parcial</small>}</td></tr>)}</tbody></table></div><div className="profit-report-mobile">{rows.map((r,i)=><button key={r.sale.id+r.unitId+i} onClick={()=>open({type:'saleDetail',item:r.sale})}><strong>{r.model}</strong><span>{r.chassis||'Chassi a informar'}</span><small>{r.sale.number} · {dateLabel(r.sale.date)}</small><dl><div><dt>Venda</dt><dd>{money(r.revenue)}</dd></div><div><dt>Custo</dt><dd>{money(r.cost)}</dd></div><div><dt>Despesas</dt><dd>{money(r.expenses)}</dd></div><div><dt>{r.partial?'Resultado parcial':'Lucro'}</dt><dd className={r.profit<0?'negative':'positive'}>{money(r.profit)}</dd></div></dl></button>)}</div></>:<Empty title="Nenhuma venda neste filtro" description="O lucro aparece aqui assim que você registra uma venda."/>}
  <p className="profit-caption">Este relatório acompanha as vendas e todos os gastos vinculados às motos, mesmo registrados em outro mês ou ainda a pagar. O Resultado mensal da loja segue as datas das receitas e despesas e inclui também os gastos gerais. Pagamentos posteriores não descontam a despesa novamente.</p>
 </div>;
}
