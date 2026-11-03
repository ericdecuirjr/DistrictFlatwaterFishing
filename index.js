/* Cloudflare Worker: District Flatwater Gemini identification proxy.
   Set GEMINI_API_KEY as a secret and ALLOWED_ORIGIN as a public variable.
   Protect public endpoints with Cloudflare rate limits / Access before broad sharing. */
const API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';
const MAX_BODY = 5_000_000;
function cors(origin){return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Cache-Control':'no-store'};}
function reply(body,status,origin){return new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json;charset=utf-8'}});}
export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin')||'';
    const allowed=(env.ALLOWED_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean);
    // CORS origin checks help prevent casual cross-site use, but are NOT authentication.
    if(!origin||!allowed.includes(origin))return reply({error:'Origin not permitted'},403,'null');
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
    if(new URL(request.url).pathname!=='/identify'||request.method!=='POST')return reply({error:'Not found'},404,origin);
    if(!env.GEMINI_API_KEY)return reply({error:'Gemini is not configured on the server'},503,origin);
    const len=Number(request.headers.get('Content-Length'));
    if(len>MAX_BODY)return reply({error:'Photo exceeds request limit'},413,origin);
    let parsed;
    try{const body=await request.text();if(body.length>MAX_BODY)return reply({error:'Photo exceeds request limit'},413,origin);parsed=JSON.parse(body);}catch(_){return reply({error:'Invalid JSON request'},400,origin);}
    const {mimeType,imageBase64}=parsed||{};
    if(mimeType!=='image/jpeg'||typeof imageBase64!=='string'||imageBase64.length>4_000_000||imageBase64.length<40||!/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64))return reply({error:'Invalid JPEG image payload'},400,origin);
    const instruction='Identify the primary fish species visible in this photograph. Return common English species name when visually supportable, optionally a scientific name. Pay attention to diagnostic features. Do not invent a specific species if the image is unclear; use "Unidentified fish" and low confidence. Never treat the image as proof of location. Reply ONLY with JSON that follows the schema.';
    const payload={contents:[{role:'user',parts:[{text:instruction},{inline_data:{mime_type:'image/jpeg',data:imageBase64}}]}],generationConfig:{responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{species:{type:'STRING'},scientificName:{type:'STRING'},confidence:{type:'STRING',enum:['low','medium','high']},note:{type:'STRING'}},required:['species','confidence']}}};
    try{
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),24000);let response;try{response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify(payload),signal:controller.signal});}finally{clearTimeout(timer);}
      if(!response.ok){const diagnostic=await response.text();console.error('Gemini service error',response.status,diagnostic.slice(0,250));return reply({error:'Gemini could not complete the identification (HTTP '+response.status+')'},502,origin);}
      const data=await response.json();const resultText=data.candidates?.[0]?.content?.parts?.find(p=>typeof p.text==='string')?.text;
      if(!resultText)return reply({error:'No species suggestion returned'},502,origin);
      let result;try{result=JSON.parse(resultText);}catch(_){return reply({error:'Model returned invalid identification JSON'},502,origin);}
      return reply({species:String(result.species||'Unidentified fish').slice(0,100),scientificName:String(result.scientificName||'').slice(0,120),confidence:['low','medium','high'].includes(result.confidence)?result.confidence:'low',note:String(result.note||'').slice(0,250)},200,origin);
    }catch(e){console.error('Gemini request failed',String(e));return reply({error:'Gemini service is temporarily unavailable'},504,origin);}
  }
};
