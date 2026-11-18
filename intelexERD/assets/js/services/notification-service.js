import {HubConnectionBuilder,LogLevel} from '@microsoft/signalr';
import {apiSession,apiBaseUrl,apiLogout,apiNotifications,apiNotificationUnreadCount,apiReadNotification,apiReadAllNotifications} from '../api/client.js';

export function notificationError(error){return error?.status===401?'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.':error?.status===403?'Bạn không có quyền thực hiện thao tác này.':error?.status===404?'Thông báo không tồn tại hoặc không thuộc tài khoản này.':'Không tải được thông báo. Kiểm tra kết nối và thử lại.';}
export function createNotificationConnection({url,accessTokenFactory,isActive}){
 return new HubConnectionBuilder().withUrl(url,{accessTokenFactory,logMessageContent:false})
 .withAutomaticReconnect({nextRetryDelayInMilliseconds:context=>isActive()?Math.min(30000,1000*2**Math.min(context.previousRetryCount,5)):null})
 .configureLogging(LogLevel.None).build();
}
export class NotificationService{
 constructor({getSession=apiSession,baseUrl=apiBaseUrl,logout=apiLogout,rest={list:apiNotifications,count:apiNotificationUnreadCount,read:apiReadNotification,readAll:apiReadAllNotifications},createConnection=createNotificationConnection,timers={setTimeout,clearTimeout,setInterval,clearInterval}}={}){
 this.getSession=getSession;this.baseUrl=baseUrl;this.logout=logout;this.rest=rest;this.createConnection=createConnection;this.timers=timers;
 this.listeners=new Set();this.generation=0;this.identity='';this.connection=null;this.lifecycle=Promise.resolve();this.retryTimer=null;this.pollTimer=null;this.refreshTask=null;this.refreshAgain=false;this.seenEvents=new Set();this.state=this.emptyState();
 }
 emptyState(){return {generation:this.generation,items:[],nextBeforeId:null,count:null,loading:false,loaded:false,error:'',realtime:'disconnected',revision:0};}
 snapshot(){return {...this.state,items:this.state.items.map(item=>({...item}))};}
 subscribe(listener){this.listeners.add(listener);listener(this.snapshot());return ()=>this.listeners.delete(listener);}
 emit(){const state=this.snapshot();for(const listener of [...this.listeners])listener(state);}
 key(){const session=this.getSession();return session?.accessToken?JSON.stringify([session.user?.userId,session.accessToken]):'';}
 current(generation){return generation===this.generation&&!!this.identity&&this.identity===this.key();}
 clearTimers(){if(this.retryTimer!==null)this.timers.clearTimeout(this.retryTimer);if(this.pollTimer!==null)this.timers.clearInterval(this.pollTimer);this.retryTimer=null;this.pollTimer=null;}
 syncAuth(){
 const identity=this.key();if(identity===this.identity)return this.lifecycle;
 this.identity=identity;const generation=++this.generation;this.clearTimers();this.seenEvents.clear();this.refreshAgain=false;this.refreshTask=null;
 const old=this.connection;this.connection=null;
 const stopped=old?Promise.resolve().then(()=>old.stop()).catch(()=>{}):Promise.resolve();
 this.state=this.emptyState();this.emit();
 // Stop a connection (including an in-progress start) immediately; serialize replacement starts.
 this.lifecycle=this.lifecycle.catch(()=>{}).then(async()=>{
 await stopped;if(!this.current(generation))return;
 this.pollTimer=this.timers.setInterval(()=>{void this.syncAuth();if(this.current(generation))void this.refresh();},30000);
 void this.refresh();
 const connection=this.createConnection({url:this.baseUrl().replace(/\/$/,'')+'/hubs/notifications',accessTokenFactory:()=>this.current(generation)?this.getSession().accessToken:'',isActive:()=>this.current(generation)});
 if(!this.current(generation)){await connection.stop().catch(()=>{});return;}
 this.connection=connection;
 connection.on('notification.available',event=>{
 if(!this.current(generation))return;
 if(typeof event?.eventId==='string'||typeof event?.eventId==='number'){
 const key=String(event.eventId);if(this.seenEvents.has(key))return;this.seenEvents.add(key);
 if(this.seenEvents.size>1000)this.seenEvents.delete(this.seenEvents.values().next().value);
 }
 void this.refresh();
 });
 connection.onreconnecting(()=>{if(this.current(generation)){this.state.realtime='reconnecting';this.emit();}});
 connection.onreconnected(()=>{if(this.current(generation)){this.state.realtime='connected';this.emit();void this.refresh();}});
 connection.onclose(()=>{if(this.current(generation)){this.state.realtime='offline';this.emit();this.scheduleRetry(connection,generation);}});

 await this.startConnection(connection,generation);
 }).catch(()=>{if(this.current(generation)){this.state.realtime='offline';this.emit();}});
 return this.lifecycle;
 }
 async startConnection(connection,generation){
 if(!this.current(generation)||connection!==this.connection)return;
 this.state.realtime='connecting';this.emit();
 try{await connection.start();if(this.current(generation)){this.state.realtime='connected';this.emit();void this.refresh();}}
 catch(error){if(!this.current(generation))return;this.state.realtime='offline';this.emit();
 if(error?.statusCode===401){this.logout();void this.syncAuth();return;}
 this.scheduleRetry(connection,generation);
 }
 }
 scheduleRetry(connection,generation){
 if(this.retryTimer!==null||!this.current(generation))return;
 this.retryTimer=this.timers.setTimeout(()=>{this.retryTimer=null;void this.startConnection(connection,generation);},10000);
 }
 async page(beforeId=null,limit=30){
 const generation=this.generation;if(!this.current(generation))throw Object.assign(Error('Session changed'),{status:401});
 const result=await this.rest.list(limit,beforeId);
 if(!this.current(generation))throw Error('Session changed');
 if(!Array.isArray(result?.items))throw Error('Invalid notifications response');
 return result;
 }
 refresh(){
 const generation=this.generation;if(!this.current(generation))return Promise.resolve();
 if(this.refreshTask?.generation===generation){this.refreshAgain=true;return this.refreshTask.promise;}
 this.state.loading=true;this.state.error='';this.emit();
 const task={generation,promise:null};this.refreshTask=task;
 task.promise=(async()=>{
 const [inbox,count]=await Promise.allSettled([this.rest.list(30,null),Promise.resolve().then(()=>this.rest.count()).then(result=>{if(this.current(generation)&&Number.isSafeInteger(result?.count)&&result.count>=0){this.state.count=result.count;this.emit();}return result;})]);
 if(!this.current(generation))return;
 let error=null;
 if(inbox.status==='fulfilled'&&Array.isArray(inbox.value?.items)){
 this.state.items=inbox.value.items;this.state.nextBeforeId=inbox.value.nextBeforeId??null;this.state.loaded=true;this.state.revision++;
 }else error=inbox.status==='rejected'?inbox.reason:Error('Invalid inbox');
 if(count.status==='fulfilled'&&Number.isSafeInteger(count.value?.count)&&count.value.count>=0)this.state.count=count.value.count;
 else error=count.status==='rejected'?count.reason:Error('Invalid count');
 if(error?.status===401){this.logout();void this.syncAuth();return;}
 this.state.error=error?notificationError(error):'';this.state.loading=false;this.emit();
 })().catch(error=>{if(this.current(generation)){this.state.loading=false;this.state.error=notificationError(error);this.emit();}}).finally(()=>{
 if(this.refreshTask!==task)return;this.refreshTask=null;
 if(this.refreshAgain&&this.current(generation)){this.refreshAgain=false;void this.refresh();}
 });return task.promise;
 }
 async read(id){
 const generation=this.generation;if(!this.current(generation))throw Object.assign(Error(),{status:401});
 await this.rest.read(id);if(this.current(generation))await this.refresh();
 }
 async readAll(){
 const generation=this.generation;if(!this.current(generation))throw Object.assign(Error(),{status:401});
 await this.rest.readAll();if(this.current(generation))await this.refresh();
 }
 async stop(){this.identity='';++this.generation;this.clearTimers();this.seenEvents.clear();this.refreshTask=null;this.refreshAgain=false;const connection=this.connection;this.connection=null;this.state=this.emptyState();this.emit();if(connection)await connection.stop().catch(()=>{});await this.lifecycle.catch(()=>{});}
}
export const notificationService=new NotificationService();
