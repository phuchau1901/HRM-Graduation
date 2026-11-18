import {apiSession,apiWorkflowList} from '../api/client.js';

export class ApprovalCountService{
 constructor({getSession=apiSession,fetchCount=()=>apiWorkflowList('all','status=PENDING&page=1&pageSize=1'),timers={setInterval,clearInterval}}={}){this.getSession=getSession;this.fetchCount=fetchCount;this.timers=timers;this.listeners=new Set();this.identity='';this.generation=0;this.timer=null;this.task=null;this.count=null;}
 key(){const session=this.getSession();return session?.accessToken&&session.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_APPROVALS'&&p.canView==='Y')?JSON.stringify([session.user?.userId,session.accessToken]):'';}
 snapshot(){return {count:this.count};}
 subscribe(listener){this.listeners.add(listener);listener(this.snapshot());return ()=>this.listeners.delete(listener);}
 emit(){for(const listener of this.listeners)listener(this.snapshot());}
 syncAuth(){const identity=this.key();if(identity===this.identity)return this.task?.promise||Promise.resolve();this.stop();this.identity=identity;if(!identity)return Promise.resolve();this.timer=this.timers.setInterval(()=>{void this.syncAuth();void this.refresh();},30000);return this.refresh();}
 refresh(){
 const generation=this.generation;if(!this.identity||this.identity!==this.key())return Promise.resolve();if(this.task?.generation===generation)return this.task.promise;
 const task={generation,promise:null};this.task=task;
 task.promise=(async()=>{try{const response=await this.fetchCount();if(generation!==this.generation||this.identity!==this.key())return;if(!Number.isSafeInteger(response?.total)||response.total<0)throw Error('Số yêu cầu chờ duyệt không hợp lệ.');this.count=response.total;this.emit();}catch{if(generation===this.generation&&this.identity===this.key()){this.count=null;this.emit();}}finally{if(this.task===task)this.task=null;}})();return task.promise;
 }
 stop(){++this.generation;if(this.timer!==null)this.timers.clearInterval(this.timer);this.timer=null;this.identity='';this.task=null;this.count=null;this.emit();}
}
export const approvalCountService=new ApprovalCountService();
