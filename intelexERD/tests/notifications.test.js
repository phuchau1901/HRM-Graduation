import test from 'node:test';
import assert from 'node:assert/strict';
import {NotificationService} from '../assets/js/services/notification-service.js';
import {notificationRows,notificationTime,notificationEventInside,notificationTabs,filterNotificationItems} from '../assets/js/pages/notifications.js';
import {apiNotifications,apiNotificationUnreadCount,apiReadNotification,apiReadAllNotifications,login} from '../assets/js/api/client.js';

const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function fixture(overrides={}){
 let session={accessToken:'token-a',user:{userId:'a'}};const connections=[],calls=[],timeouts=new Map(),intervals=new Map();let timerId=0;
 const timers={setTimeout(fn){timeouts.set(++timerId,fn);return timerId;},clearTimeout(id){timeouts.delete(id);},setInterval(fn){intervals.set(++timerId,fn);return timerId;},clearInterval(id){intervals.delete(id);}};
 const rest={list:async(limit,cursor)=>{calls.push(['list',limit,cursor]);return {items:[{id:9,title:'From REST',content:'Inbox body',readAt:null}],nextBeforeId:9};},count:async()=>{calls.push(['count']);return {count:2};},read:async id=>{calls.push(['read',id]);},readAll:async()=>{calls.push(['readAll']);},...overrides.rest};
 const service=new NotificationService({getSession:()=>session,baseUrl:()=>'/backend',logout:()=>{session=null;},rest,timers,createConnection:options=>{
 const connection={options,handlers:{},started:false,stopped:false,startCalls:0,stopCalls:0,on(event,fn){this.handlers[event]=fn;},onreconnecting(fn){this.reconnecting=fn;},onreconnected(fn){this.reconnected=fn;},onclose(fn){this.closed=fn;},async start(){this.startCalls++;if(overrides.startError)throw overrides.startError;this.started=true;},async stop(){this.stopCalls++;this.stopped=true;this.started=false;}};
 connections.push(connection);return connection;
 }});
 return {service,connections,calls,timeouts,intervals,setSession:value=>{session=value;},getSession:()=>session};
}
test('one notification connection per session, JWT token factory, replacement on token/account change, and logout cleanup',async()=>{
 const f=fixture();await Promise.all([f.service.syncAuth(),f.service.syncAuth(),f.service.syncAuth()]);await settle();
 assert.equal(f.connections.length,1);assert.equal(f.connections[0].startCalls,1);assert.equal(f.connections[0].options.url,'/backend/hubs/notifications');assert.equal(f.connections[0].options.accessTokenFactory(),'token-a');
 f.setSession({accessToken:'token-b',user:{userId:'a'}});await f.service.syncAuth();await settle();
 assert.equal(f.connections.length,2);assert.equal(f.connections[0].stopped,true);assert.equal(f.connections[0].options.accessTokenFactory(),'');assert.equal(f.connections[1].options.accessTokenFactory(),'token-b');
 f.setSession({accessToken:'token-c',user:{userId:'b'}});await f.service.syncAuth();assert.equal(f.connections[1].stopped,true);
 f.setSession(null);await f.service.syncAuth();await settle();assert.equal(f.connections[2].stopped,true);assert.deepEqual(f.service.snapshot().items,[]);assert.equal(f.service.snapshot().count,null);assert.equal(f.intervals.size,0);assert.equal(f.timeouts.size,0);
});
test('duplicate event IDs are ignored and event content is never used as notification content',async()=>{
 const f=fixture();await f.service.syncAuth();await settle();f.calls.length=0;
 const on=f.connections[0].handlers['notification.available'];on({eventId:'evt-1',notificationId:9,title:'Untrusted push title',content:'push body'});on({eventId:'evt-1',notificationId:9});await settle();
 assert.equal(f.calls.filter(call=>call[0]==='list').length,1);assert.equal(f.calls.filter(call=>call[0]==='count').length,1);assert.equal(f.service.snapshot().items[0].title,'From REST');
 f.calls.length=0;f.connections[0].reconnected();await settle();assert.ok(f.calls.some(call=>call[0]==='list'));assert.ok(f.calls.some(call=>call[0]==='count'));
 await f.service.stop();
});
test('REST inbox survives failed hub startup, initial hub start retries, and read actions refresh authoritative count',async()=>{
 const f=fixture({startError:Error('Hub unavailable')});await f.service.syncAuth();await settle();assert.equal(f.service.snapshot().loaded,true);assert.equal(f.service.snapshot().count,2);assert.equal(f.service.snapshot().realtime,'offline');assert.equal(f.timeouts.size,1);
 const retry=[...f.timeouts.values()][0];f.timeouts.clear();retry();await settle();assert.equal(f.connections[0].startCalls,2);
 f.calls.length=0;await f.service.read(9);await settle();assert.ok(f.calls.some(call=>call[0]==='read'&&call[1]===9));assert.ok(f.calls.some(call=>call[0]==='count'));
 await f.service.readAll();await settle();assert.ok(f.calls.some(call=>call[0]==='readAll'));
 await f.service.page(9);assert.ok(f.calls.some(call=>call[0]==='list'&&call[2]===9));await f.service.stop();assert.equal(f.timeouts.size,0);
});
test('late REST responses and push events from a previous account cannot update the next account',async()=>{
 let resolveOld;let first=true;
 const f=fixture({rest:{list:async()=>{if(first){first=false;return new Promise(resolve=>{resolveOld=resolve;});}return {items:[{id:2,title:'New account'}],nextBeforeId:null};}}});
 await f.service.syncAuth();await settle();const old=f.connections[0];
 f.setSession({accessToken:'token-b',user:{userId:'b'}});await f.service.syncAuth();await settle();
 resolveOld({items:[{id:1,title:'Old private inbox'}],nextBeforeId:null});old.handlers['notification.available']({eventId:'old'});await settle();
 assert.equal(f.service.snapshot().items[0].title,'New account');assert.ok(!JSON.stringify(f.service.snapshot()).includes('Old private inbox'));await f.service.stop();
});
test('REST 401 resets auth and stops the notification connection',async()=>{
 let unauthorized=false;
 const f=fixture({rest:{count:async()=>{if(unauthorized)throw Object.assign(Error(),{status:401});return {count:1};}}});
 await f.service.syncAuth();await settle();unauthorized=true;await f.service.refresh();await settle();await f.service.lifecycle;
 assert.equal(f.getSession(),null);assert.equal(f.connections[0].stopped,true);assert.equal(f.service.snapshot().count,null);await f.service.stop();
});
test('notification rendering escapes API content, distinguishes unread, and uses Vietnam time',()=>{
 const row=notificationRows([{id:1,title:'<img src=x>',content:'<script>bad</script>',publishedAt:'2026-11-15T01:00:00Z',readAt:null}]);
 assert.ok(!row.includes('<script>'));assert.ok(!row.includes('<img'));assert.ok(row.includes('&lt;img'));assert.ok(row.includes('Chưa đọc'));assert.ok(notificationTime('2026-11-15T01:00:00Z').includes('08:00'));
 assert.ok(notificationRows([{id:2,title:'Read',content:'body',readAt:'2026-11-15T00:00:00Z'}]).includes('Đã đọc'));
});
test('notification REST endpoints only use the current JWT and cursor, with idempotent PATCH requests',async()=>{
 const original=globalThis.fetch,calls=[];
 try{
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.endsWith('/api/auth/login')?{accessToken:'current-token',user:{userId:'current'},permissions:[]}:url.endsWith('/unread-count')?{count:3}:url.includes('?')?{items:[],nextBeforeId:null}:{updated:1}};};
 await login('current','test-password');await apiNotifications(30,12);await apiNotificationUnreadCount();await apiReadNotification(9);await apiReadAllNotifications();
 const query=new URL(calls[1].url,'http://local');assert.equal(query.pathname,'/api/notifications');assert.equal(query.searchParams.get('limit'),'30');assert.equal(query.searchParams.get('beforeId'),'12');assert.equal(query.searchParams.has('userId'),false);
 assert.ok(calls[2].url.endsWith('/api/notifications/unread-count'));assert.ok(calls[3].url.endsWith('/api/notifications/9/read'));assert.ok(calls[4].url.endsWith('/api/notifications/read-all'));
 for(const call of calls.slice(1)){assert.equal(call.options.headers.get('Authorization'),'Bearer current-token');assert.equal(call.options.body,undefined);}
 assert.equal(calls[3].options.method,'PATCH');assert.equal(calls[4].options.method,'PATCH');assert.equal(calls[1].options.cache,'no-store');
 }finally{globalThis.fetch=original;}
});
test('a late 401 for an old JWT cannot log out a newly signed-in user',async()=>{
 const {apiSession}=await import('../assets/js/api/client.js');const original=globalThis.fetch;
 let resolveOld;
 try{
 globalThis.fetch=async(url,options)=>{
 if(url.endsWith('/api/auth/login')){const {userId}=JSON.parse(options.body);return {ok:true,json:async()=>({accessToken:'token-'+userId,user:{userId},permissions:[]})};}
 return new Promise(resolve=>{resolveOld=resolve;});
 };
 await login('old','test-password');const pending=apiNotificationUnreadCount();await login('new','test-password');
 resolveOld({ok:false,status:401,json:async()=>({message:'Expired old token'})});
 await assert.rejects(pending,error=>error.status===401);assert.equal(apiSession().user.userId,'new');
 }finally{globalThis.fetch=original;}
});

test('bell dropdown does not treat its re-rendered trigger as an outside click',()=>{
 const root={contains:()=>false},detachedButton={};
 assert.equal(notificationEventInside({target:detachedButton,composedPath:()=>[detachedButton,root]},root),true);
 assert.equal(notificationEventInside({target:{},composedPath:()=>[{}]},root),false);
 assert.equal(notificationEventInside({target:{},composedPath:()=>[]},null),false);
});
test('only unread notification rows display an unread dot',()=>{
 const unread=notificationRows([{id:1,title:'New',content:'Body',readAt:null}]);
 const read=notificationRows([{id:1,title:'New',content:'Body',readAt:'2026-11-15T10:00:00Z'}]);
 assert.ok(unread.includes('class="api-notification-dot"'));assert.ok(!read.includes('class="api-notification-dot"'));
});

test('restored notification categories filter API records without inferring categories from message content',()=>{
 assert.deepEqual(notificationTabs.map(([key])=>key),['all','unread','task','attendance','leave','system']);
 const items=[{id:1,readAt:null,source:'SYSTEM'},{id:2,readAt:'2026-11-15',referenceType:'LEAVE_REQUEST'},{id:3,readAt:null,referenceType:'TASK'},{id:4,referenceType:'ATTENDANCE'},{id:5,source:'WORKFLOW',title:'Nghỉ phép'}];
 assert.deepEqual(filterNotificationItems(items,'system').map(item=>item.id),[1]);
 assert.deepEqual(filterNotificationItems(items,'leave').map(item=>item.id),[2]);
 assert.deepEqual(filterNotificationItems(items,'task').map(item=>item.id),[3]);
 assert.deepEqual(filterNotificationItems(items,'attendance').map(item=>item.id),[4]);
 assert.ok(!filterNotificationItems(items,'unread').some(item=>item.id===2));
 assert.equal(filterNotificationItems(items,'all'),items);
});
