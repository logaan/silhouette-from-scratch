export const RISK_PHRASE='I use this software at my own risk';
export const RISK_KEY='silhouette.risk-acknowledgement.v1';
export function localDay(now){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
export function renewalDate(typedAt){
 const start=new Date(typedAt),end=new Date(start);
 const day=start.getDate();end.setDate(1);end.setMonth(end.getMonth()+3);
 const last=new Date(end.getFullYear(),end.getMonth()+1,0).getDate();end.setDate(Math.min(day,last));return end;
}
export function acknowledgementState(record,now=new Date()){
 const typedAt=record?.typedAt;
 const valid=typeof typedAt==='number'&&Number.isFinite(typedAt)&&typedAt<=now.getTime();
 const needsPhrase=!valid||now>=renewalDate(typedAt);
 return {needsPhrase,accepted:!needsPhrase&&record.acknowledgedDay===localDay(now)};
}
export function acknowledge(record,{phrase,checked},now=new Date()){
 const state=acknowledgementState(record,now);
 if(state.needsPhrase){
  if(typeof phrase!=='string'||phrase.trim().toLowerCase()!==RISK_PHRASE.toLowerCase())throw Error(`Type “${RISK_PHRASE}” to continue.`);
  return {typedAt:now.getTime(),acknowledgedDay:localDay(now)};
 }
 return {typedAt:record.typedAt,acknowledgedDay:checked?localDay(now):null};
}
