'use client';
import { createContext,useContext } from 'react';
import type { Data } from '@/lib/domain';
export type View='overview'|'purchases'|'inventory'|'sales'|'customers'|'finance'|'birthdays'|'settings';
export type Modal={type:string;item?:any;modelId?:string;unitId?:string;kind?:string};
export type AppState={data:Data;demo:boolean;view:View;setView:(v:View)=>void;open:(m:Modal|null)=>void;act:(name:string,p:any)=>Promise<string>;notify:(message:string,error?:boolean)=>void;refresh:()=>Promise<void>;period:string;setPeriod:(v:string)=>void;from:string;to:string;exportData:()=>void};
export const AppContext=createContext<AppState>(null!);
export const useApp=()=>useContext(AppContext);
