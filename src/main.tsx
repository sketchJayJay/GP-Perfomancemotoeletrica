import React,{useEffect,useState,type FormEvent} from 'react';
import {createRoot} from 'react-dom/client';
import {LockKeyhole,ArrowRight,LoaderCircle,ShieldCheck,AlertCircle} from 'lucide-react';
import Dashboard from './Dashboard';
import {demoData} from '@/lib/domain';
import './globals.css';

function App(){
 const [state,setState]=useState<{authenticated:boolean;setupRequired:boolean}|null>(null),[error,setError]=useState('');
 const load=async()=>{try{const r=await fetch('/api/auth/status',{cache:'no-store'});if(!r.ok)throw Error();setState(await r.json());setError('');}catch{setError('Não foi possível conectar ao servidor. Tente novamente.');}};
 useEffect(()=>{void load();const expired=()=>setState({authenticated:false,setupRequired:false});window.addEventListener('gp-session-expired',expired);return()=>window.removeEventListener('gp-session-expired',expired);},[]);
 const logout=async()=>{await fetch('/api/auth/logout',{method:'POST'});setState({authenticated:false,setupRequired:false});};
 if(state?.authenticated)return <Dashboard initialDemo={demoData()} onLogout={()=>{void logout();}}/>;
 if(!state)return <div className="auth-loading"><img src="/images/gp-logo.jpeg" alt="GP Performance"/>{error?<><p>{error}</p><button className="btn primary" onClick={()=>{void load();}}>Tentar novamente</button></>:<LoaderCircle className="spinning" size={25}/>}</div>;
 return <Login setup={state.setupRequired} done={()=>{void load();}}/>;
}
function Login({setup,done}:{setup:boolean;done:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const submit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(busy)return;const p=Object.fromEntries(new FormData(e.currentTarget));if(setup&&p.password!==p.confirm){setError('As senhas precisam ser iguais.');return;}setBusy(true);setError('');try{const r=await fetch(setup?'/api/auth/setup':'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:p.username,password:p.password})}),j=await r.json();if(!r.ok)throw Error(j.error);done();}catch(e:any){setError(e.message||'Não foi possível entrar.');}finally{setBusy(false);}};
 return <main className="auth-page"><section className="auth-visual"><img src="/images/electric-moto.png" alt="Moto elétrica, conceito ilustrativo"/><div><span>GP PERFORMANCE / GESTÃO ELÉTRICA</span><h1>Mais energia.<br/>Novas possibilidades.</h1><p>O controle da sua loja em outra velocidade.</p></div></section><section className="auth-form-wrap"><div className="auth-form"><img className="auth-logo" src="/images/gp-logo.jpeg" alt="GP Performance"/><span className="auth-eyebrow">BEM-VINDO À GP PERFORMANCE</span><h2>{setup?'Sua operação começa aqui.':'Bom ter você de volta.'}</h2><p>{setup?'Crie o usuário e a senha do administrador da loja.':'Entre para acompanhar o que move seu negócio.'}</p><form onSubmit={submit}><fieldset disabled={busy}><label className="field"><span>Usuário</span><input name="username" placeholder="Seu usuário" autoComplete="username" autoCapitalize="none" required minLength={2} maxLength={80}/></label><label className="field"><span>{setup?'Crie sua senha':'Senha'}</span><input type="password" name="password" placeholder={setup?'Pelo menos 8 caracteres':'Sua senha'} autoComplete={setup?'new-password':'current-password'} required minLength={setup?8:1} maxLength={256}/></label>{setup&&<label className="field"><span>Confirme sua senha</span><input type="password" name="confirm" placeholder="Repita a senha" autoComplete="new-password" required minLength={8} maxLength={256}/></label>}<button className="btn primary" type="submit">{busy?<LoaderCircle className="spinning" size={17}/>:<LockKeyhole size={16}/>} {busy?'Entrando...':setup?'Criar acesso e começar':'Entrar no sistema'}<ArrowRight size={16}/></button></fieldset>{error&&<div role="alert" className="form-error"><AlertCircle size={17}/>{error}</div>}</form><div className="auth-footnote"><ShieldCheck size={15}/><span>Seu acesso. Sua loja. Seus resultados.</span></div></div><p className="auth-copyright">GP PERFORMANCE · MOBILIDADE ELÉTRICA</p></section></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
