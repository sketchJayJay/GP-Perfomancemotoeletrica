export const providedBikeBatch='gp-motos-2026-11-13';
export const providedBikes=[
 {key:'tank-cinza',name:'Tank',color:'Cinza',chassis:'HK1NAX8A1T819H636'},
 {key:'tank-piu-piu',name:'Tank piu piu',color:'Verde',chassis:'R5XBL6357TM800196'},
 {key:'gt-sport',name:'GT sport',color:'Vermelha',chassis:'KTDM1X26052200028'},
 {key:'veloster-preta',name:'Veloster',color:'Preta',chassis:'VS202608SK01-00947'},
 {key:'im1000',name:'IM1000',color:'Vermelha e preta',chassis:'LEK5MW510T2605170'},
 {key:'soyan-cinza',name:'SOYAN',color:'Cinza',chassis:'LX7TJDT26T1085653'},
 {key:'gmax-branca',name:'GMAX',color:'Branca',chassis:''},
].map(b=>({...b,price:800000,image:'/images/catalogo/'+b.key+'.jpg'}));
