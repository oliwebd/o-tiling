// Only the adapter's Shell-facing constructors are replaced. Snapshot/adapter logic is real.
const mock = `
export const NodeKind={FORK:1,WINDOW:2,STACK:3};
export const Orientation={HORIZONTAL:0,VERTICAL:1};
export class Node {
 constructor(inner){this.inner=inner;}
 static fork(entity){return new Node({kind:1,entity});}
 static window(entity){return new Node({kind:2,entity});}
 static stacked(entity,idx){return new Node({kind:3,entities:[entity],idx,rect:null});}
}
export class Stack { constructor(ext,active){this.active=active;this.active_id=0;} }
`;
export async function resolve(specifier,context,next){
 if(context.parentURL?.endsWith('/engine/lock_layout.ts') && ['node.js','stack.js','../utils/lib.js'].some(s=>specifier.endsWith(s)))
  return {url:'data:text/javascript,'+encodeURIComponent(mock),shortCircuit:true};
 if(context.parentURL?.endsWith('.ts') && specifier.endsWith('.js')){
  return next(specifier.slice(0,-3)+'.ts',context);
 }
 return next(specifier,context);
}
