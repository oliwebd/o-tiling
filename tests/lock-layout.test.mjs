import {test} from 'node:test';
import assert from 'node:assert/strict';
import {captureLayout,restoreWorkspace} from '../src/engine/lock_layout.ts';
class Rect {
 constructor(x=0,y=32,width=1000,height=800){Object.assign(this,{x,y,width,height});}
 clone(){return new Rect(this.x,this.y,this.width,this.height);}
}
const leaf=id=>({kind:'window',id});
const saved={monitor:0,workspace:0,area:new Rect(),tree:{kind:'split',horizontal:true,ratio:.37,left:leaf(1),right:{kind:'stack',ids:[3,2],active:2}}};
function fixture(ids=[1,2,3]){
 const windows=ids.map(id=>({entity:id,meta:{get_stable_sequence:()=>id}}));
 const forks=new Map(), stacks=new Map();let next=100;
 const attached=new Map(),parents=new Map();
 const wrap=map=>({get:k=>map.get(k),insert:(k,v)=>map.set(k,v)});
 const forest={forks:wrap(forks),parents:wrap(parents),toplevel:new Map(),stacks:{insert:v=>{const id=next++;stacks.set(id,v);return id;},get:k=>stacks.get(k)},
 create_fork(left,right,area,workspace,monitor){const id=next++;const f={left,right,area,workspace,monitor,orientation:0,length_left:area.width/2,is_horizontal(){return this.orientation===0},length(){return this.is_horizontal()?this.area.width:this.area.height},set_ratio(v){this.length_left=v}};forks.set(id,f);return [id,f];}};
 const tiler={forest,update_stack(){},update_toplevel(ext,fork){tiler.updated=fork}};
 const ext={windows:new Map(windows.map(w=>[w.entity,w])),auto_tiler:tiler,settings:{smart_gaps:()=>false},gap_outer:4,gap_top:4,gap_inner_half:2,monitor_work_area:()=>new Rect(),contains_tag:()=>false,on_tile_attach:(p,e)=>attached.set(e,p)};
 return {windows,ext,tiler,forks,stacks,attached,parents};
}
test('restores actual adapter tree and round-trips ratios and tab ordering',()=>{
 const f=fixture();
 assert.deepEqual(restoreWorkspace(f.tiler,f.ext,saved,f.windows),[1,3,2]);
 const result=captureLayout(f.ext);
 assert.deepEqual(result.layouts[0].tree,saved.tree);
 assert.equal(f.attached.size,3);
 assert.equal([...f.stacks.values()][0].active_id,1);
 assert.ok(f.tiler.updated.is_toplevel);
 assert.equal(f.tiler.updated.length_left,992*.37);
});
test('skips disappeared windows and does not silently attach new windows',()=>{
 const f=fixture([1,2,9]);
 assert.deepEqual(restoreWorkspace(f.tiler,f.ext,saved,f.windows),[1,2]);
 assert.equal(f.attached.has(9),false);
 assert.deepEqual(captureLayout(f.ext).layouts[0].tree,{kind:'split',horizontal:true,ratio:.37,left:leaf(1),right:leaf(2)});
});
test('changed display work area falls back before creating any tree',()=>{
 const f=fixture();f.ext.monitor_work_area=()=>new Rect(0,32,1920,1080);
 assert.deepEqual(restoreWorkspace(f.tiler,f.ext,saved,f.windows),[]);
 assert.equal(f.forks.size,0);
});
test('single survivor becomes a valid top-level tree',()=>{
 const f=fixture([2]);
 assert.deepEqual(restoreWorkspace(f.tiler,f.ext,saved,f.windows),[2]);
 assert.deepEqual(captureLayout(f.ext).layouts[0].tree,leaf(2));
});
test('an empty group leaves no dangling forks or stack containers',()=>{
 const f=fixture([]);
 assert.deepEqual(restoreWorkspace(f.tiler,f.ext,saved,f.windows),[]);
 assert.equal(f.forks.size,0);assert.equal(f.stacks.size,0);
});
test('snapshot survives teardown and repeated rebuilds without live object references',()=>{
 let current=fixture();restoreWorkspace(current.tiler,current.ext,saved,current.windows);
 for(let cycle=0;cycle<4;cycle++){
  const snapshot=captureLayout(current.ext);
  current.forks.clear();current.stacks.clear();current.ext.windows.clear();
  const next=fixture();
  restoreWorkspace(next.tiler,next.ext,snapshot.layouts[0],next.windows);
  assert.deepEqual(captureLayout(next.ext).layouts[0].tree,saved.tree);
  current=next;
 }
});
test('snapshot captures manually floating and forced-tiled windows by stable ID',()=>{
 const f=fixture();
 // Use the actual enum values rather than depending on ECS entities being stable.
 const tagsPromise=import('../src/utils/tags.ts');
 return tagsPromise.then(tags=>{
  f.ext.contains_tag=(entity,tag)=>(tag===tags.Floating&&entity===1)||(tag===tags.ForceTile&&entity===2);
  const snap=captureLayout(f.ext);
  assert.deepEqual(snap.floating,[1]);assert.deepEqual(snap.forceTiled,[2]);
 });
});
