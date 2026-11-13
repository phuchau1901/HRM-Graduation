const SESSION_KEY = 'intelex-erp-api-session:v1';
const DEFAULT_BASE_URL = typeof location!=='undefined' && /^https?:$/.test(location.protocol) ? '' : 'https://hrm-graduation.up.railway.app';

function readSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY))||null;}catch{return null;}}
let session = readSession();

export function apiBaseUrl(){return globalThis.window?.INTELEX_API_BASE ?? DEFAULT_BASE_URL;}
export function apiSession(){
 if(session?.expiresAtUtc&&Date.parse(session.expiresAtUtc)<=Date.now())apiLogout();
 return session?.accessToken?session:null;
}
export function apiLogout(){session=null;try{localStorage.removeItem(SESSION_KEY);}catch{}
 globalThis.window?.dispatchEvent?.(new Event('auth-change'));
}

async function request(path,options={}){
 const headers=new Headers(options.headers||{});
 headers.set('Accept','application/json');
 if(options.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
 if(path!=='/api/auth/login'&&apiSession()?.accessToken)headers.set('Authorization',`Bearer ${session.accessToken}`);
 const transport=globalThis['fetch'];
 if(typeof transport!=='function')throw Error('Trình duyệt hiện tại không hỗ trợ kết nối API.');
 const response=await transport(apiBaseUrl()+path,{...options,headers});
 let body=null;try{body=await response.json();}catch{}
 if(!response.ok){if(response.status===401)apiLogout();throw Error(body?.message||body?.error?.message||`API lỗi HTTP ${response.status}`);}
 return body;
}

export async function login(userId,password){
 const result=await request('/api/auth/login',{method:'POST',body:JSON.stringify({userId,password})});
 if(!result?.accessToken||!result.user||!Array.isArray(result.permissions))throw Error('Phản hồi đăng nhập không hợp lệ.');
 session={...result};
 try{localStorage.setItem(SESSION_KEY,JSON.stringify(session));}catch{}
 return session;
}

export function me(){return request('/api/auth/me');}
export function permissions(){return request('/api/auth/me/permissions');}
export function apiEmployees(query=''){return request('/api/employees'+(query?`?${query}`:''));}
export function apiDepartments(query=''){return request('/api/departments'+(query?`?${query}`:''));}
export function apiPositions(query=''){return request('/api/positions'+(query?`?${query}`:''));}
export function apiNotifications(){return request('/api/notifications');}
