
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const cfg=window.SPORT_CLOUD_CONFIG||{};
const status=document.getElementById('cloudStatus'),login=document.getElementById('googleLogin'),logout=document.getElementById('googleLogout'),importBtn=document.getElementById('cloudImport');
if(!cfg.url?.startsWith('https://')||!cfg.anonKey||cfg.anonKey.startsWith('INSERISCI')){
 status.textContent='Modalità locale. Per sincronizzare, configura config.js e pubblica l’app su HTTPS.';
}else{
 const client=createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 let user=null,loading=false,pending=false,timer=null,remoteReady=false;
 const message=t=>{status.textContent=t};
 const snapshot=()=>JSON.parse(JSON.stringify(window.sportApp.getState()));
 async function push(){
   if(!user||!remoteReady||loading)return;
   loading=true;
   const payload=snapshot();
   try{
     const {error}=await client.from('sport_data').upsert({user_id:user.id,data:payload,updated_at:new Date().toISOString()},{onConflict:'user_id'});
     if(error)throw error;
     message('Sincronizzato con Google · '+new Date().toLocaleTimeString('it-IT'));
   }catch(e){pending=true;message('Sincronizzazione non riuscita: '+e.message+' · dati salvati sul dispositivo');}
   finally{loading=false;if(pending&&navigator.onLine){pending=false;clearTimeout(timer);timer=setTimeout(push,3000)}}
 }
 window.cloudSync={queueSave:()=>{if(!remoteReady||!user||loading)return;clearTimeout(timer);timer=setTimeout(push,800)}};
 async function connect(u){
  user=u;login.style.display='none';logout.style.display='inline-block';importBtn.style.display='inline-block';remoteReady=false;
  message('Accesso effettuato. Recupero dati...');
  const {data,error}=await client.from('sport_data').select('data').eq('user_id',u.id).maybeSingle();
  if(error){message('Errore cloud: '+error.message);return}
  if(data?.data){
    const local=snapshot();
    if(local.activities?.length&&!sessionStorage.getItem('sport_cloud_confirmed')){
      const useCloud=confirm('Trovati dati nel cloud e su questo dispositivo. OK = usa i dati cloud; Annulla = mantieni i dati locali senza sovrascriverli.');
      if(!useCloud){message('Dati locali mantenuti. Premi "Carica i dati locali nel cloud" per sostituire quelli cloud.');return}
      sessionStorage.setItem('sport_cloud_confirmed','1');
    }
    window.sportApp.setState(data.data);
  }else{
    const local=snapshot();
    if(local.activities?.length){
      message('Cloud vuoto. Premi "Carica i dati locali nel cloud" per importare gli allenamenti esistenti.');
      return;
    }
  }
  remoteReady=true;message('Connesso con Google · sincronizzazione attiva');
 }
 login.onclick=async()=>{
   const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});
   if(error)message('Errore accesso: '+error.message);
 };
 logout.onclick=async()=>{remoteReady=false;await client.auth.signOut();user=null;login.style.display='inline-block';logout.style.display='none';importBtn.style.display='none';message('Disconnesso. Dati locali ancora presenti.')};
 importBtn.onclick=async()=>{
   if(!user||!confirm('Sostituire i dati nel cloud con quelli di questo dispositivo?'))return;
   remoteReady=true;await push();
 };
 client.auth.onAuthStateChange((_event,session)=>{if(session?.user&&session.user.id!==user?.id)setTimeout(()=>connect(session.user),0);});
 const {data:{session}}=await client.auth.getSession();
 if(session?.user)await connect(session.user);
 else{login.style.display='inline-block';message('Accedi con Google per sincronizzare PC e iPhone.')}
 window.addEventListener('online',()=>{if(pending&&remoteReady){pending=false;push()}});
 document.addEventListener('visibilitychange',async()=>{
  if(document.visibilityState!=='visible'||!user||!remoteReady||loading)return;
  const {data,error}=await client.from('sport_data').select('data').eq('user_id',user.id).maybeSingle();
  if(!error&&data?.data&&!pending&&!timer)window.sportApp.setState(data.data);
 });
}
