import test from 'node:test';
import assert from 'node:assert/strict';
import {toast,clearToasts} from '../assets/js/components/dialog.js';
test('toast stack keeps newest first, escapes text and dismisses each alert independently',()=>{
 const previousDocument=globalThis.document,previousTimeout=globalThis.setTimeout,previousClear=globalThis.clearTimeout,timers=new Map();let next=0;
 const element=()=>({children:[],attributes:{},setAttribute(key,value){this.attributes[key]=value;},append(...items){this.children.push(...items);for(const item of items)item.parent=this;},prepend(item){this.children.unshift(item);item.parent=this;},replaceChildren(){this.children=[];},remove(){if(this.parent)this.parent.children=this.parent.children.filter(item=>item!==this);}});
 const container=element();
 try{globalThis.document={getElementById:()=>container,createElement:element};globalThis.setTimeout=(fn,ms)=>{assert.equal(ms,5000);timers.set(++next,fn);return next;};globalThis.clearTimeout=id=>timers.delete(id);
 toast('First');toast('<script>unsafe</script>',{type:'error'});assert.equal(container.children.length,2);assert.equal(container.children[0].children[0].textContent,'<script>unsafe</script>');assert.equal(container.children[0].attributes.role,'alert');
 timers.get(1)();assert.equal(container.children.length,1);container.children[0].children[1].onclick();assert.equal(container.children.length,0);
 toast('Third');clearToasts();assert.equal(container.children.length,0);
 }finally{globalThis.document=previousDocument;globalThis.setTimeout=previousTimeout;globalThis.clearTimeout=previousClear;}
});
