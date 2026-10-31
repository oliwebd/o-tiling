import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pruneTree, sameArea, snapshotIds} from '../src/engine/layout_snapshot.ts';
const win=id=>({kind:'window',id});
const tree={kind:'split',horizontal:true,ratio:0.37,left:win(11),right:{kind:'split',horizontal:false,ratio:0.62,left:win(22),right:{kind:'stack',ids:[33,44],active:44}}};
test('retains nested split ratios and stack order without keeping object references',()=>{
 const restored=pruneTree(tree,new Set([11,22,33,44]));
 assert.deepEqual(restored,tree);
 assert.notEqual(restored,tree);
 assert.notEqual(restored.right.right.ids,tree.right.right.ids);
});
test('removes closed windows and collapses empty split branches',()=>{
 assert.deepEqual(pruneTree(tree,new Set([22,44])),{kind:'split',horizontal:false,ratio:0.62,left:win(22),right:win(44)});
});
test('retains stack order and selects a surviving active tab',()=>{
 assert.deepEqual(pruneTree({kind:'stack',ids:[3,1,2],active:1},new Set([2,3])),{kind:'stack',ids:[3,2],active:3});
});
test('all windows closed produces no stale layout',()=>assert.equal(pruneTree(tree,new Set()),null));
test('does not absorb new windows into the saved tree',()=>assert.deepEqual(snapshotIds(pruneTree(tree,new Set([11,22,33,44,55]))),[11,22,33,44]));
test('detects monitor work-area changes before restoring',()=>{
 const a={x:0,y:32,width:2560,height:1048};
 assert.ok(sameArea(a,{...a}));
 for(const key of Object.keys(a)) assert.ok(!sameArea(a,{...a,[key]:a[key]+1}));
});
test('closed windows on repeated unlocks cannot reappear',()=>{
 const first=pruneTree(tree,new Set([11,22,44]));
 assert.deepEqual(pruneTree(first,new Set([44])),win(44));
});
test('interrupted unlock retains its snapshot until restoration completes',async()=>{
 const {PendingLayout}=await import('../src/engine/layout_snapshot.ts');
 const state=new PendingLayout(); const snapshot={layouts:[],floating:[11],forceTiled:[]};
 state.save(snapshot,true);
 const firstUnlock=state.peek();
 // Lock again before the startup callback can build a tiler.
 state.save(null,true);
 assert.equal(state.peek(),snapshot);
 state.restored(firstUnlock);
 assert.equal(state.peek(),null);
});
test('ordinary disable clears stale state and an old callback cannot clear a newer snapshot',async()=>{
 const {PendingLayout}=await import('../src/engine/layout_snapshot.ts');
 const state=new PendingLayout();const a={layouts:[],floating:[1],forceTiled:[]};const b={layouts:[],floating:[2],forceTiled:[]};
 state.save(a,true);state.save(b,true);state.restored(a);assert.equal(state.peek(),b);
 state.save(null,false);assert.equal(state.peek(),null);
});
