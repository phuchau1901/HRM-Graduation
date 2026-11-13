import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// Runtime smoke test for the classic script. This is a DOM stub, not a visual
// browser test: file-origin security is represented by unavailable localStorage
// and the absence of import/fetch/module loading support.
function fileEnvironment(){
 const nodes=new Map(),listeners=new Map();
 function node(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',open:false,isConnected:true,classList:{add(){},remove(){},toggle(){}},addEventListener(){},focus(){},close(){this.open=false;},showModal(){this.open=true;}});return nodes.get(id);}
 const document={getElementById:node,activeElement:null,title:'',body:{classList:{remove(){},toggle(){}}},addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);}};
 const location={protocol:'file:',hash:''};
 const context=vm.createContext({document,location,history:{replaceState(a,b,url){location.hash=url;}},window:{addEventListener(){},scrollTo(){}},localStorage:{getItem(){throw Error('Storage unavailable');},setItem(){throw Error('Storage unavailable');}},setInterval(){return 1;},setTimeout(){return 1;},clearTimeout(){},console:{warn(){},log(){}},innerWidth:1440});
 return {context,node,listeners,location};
}
test('index loads a classic script and all referenced local assets exist',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(!html.includes('type="module"'));assert.ok(html.includes('assets/js/dist/erp-browser.js'));
 for(const [,asset] of html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g))assert.ok((await readFile(new URL('../'+asset,import.meta.url))).length>0,asset);
});
test('Classic distribution starts on file origin without modules, fetch or storage',async()=>{
 const code=await readFile(new URL('../assets/js/dist/erp-browser.js',import.meta.url),'utf8');
 assert.ok(!/^import\s/m.test(code));assert.ok(!/\bfetch\(/.test(code));
 const env=fileEnvironment();vm.runInContext(code,env.context,{timeout:3000});
 assert.equal(env.location.hash,'#/dashboard');
 assert.match(env.node('app').innerHTML,/Đăng nhập Intelex/);
 assert.match(env.node('app').innerHTML,/autocomplete="current-password"/);
});
