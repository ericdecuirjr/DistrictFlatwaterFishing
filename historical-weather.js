/* District Flatwater Fishing v3.3 — opt-in, on-device historical weather lookup.
   Uses the Open-Meteo Historical Weather API. No catch data is uploaded; request
   includes only approved coordinates and a small UTC date range. */
(()=>{
'use strict';
const ARCHIVE='https://archive-api.open-meteo.com/v1/archive';
const FIRST=Date.UTC(1940,0,1);
const ONE_DAY=86400000;
const HOURLY='temperature_2m,surface_pressure,pressure_msl,weather_code';
function check(iso,latitude,longitude,now=Date.now()){
  const when=Date.parse(iso);
  if(!Number.isFinite(when))return 'Choose a valid catch date and time.';
  if(when<FIRST)return 'Historical weather is only supported for photos from 1940 onward.';
  if(when>now)return 'Historical weather is unavailable for future catch dates.';
  if(!Number.isFinite(latitude)||latitude< -90||latitude>90||!Number.isFinite(longitude)||longitude< -180||longitude>180)return 'Use photo GPS metadata or capture a location before searching.';
  return null;
}
function dateString(ms){return new Date(ms).toISOString().slice(0,10);}
function buildUrl(iso,latitude,longitude,now=Date.now()){
  const error=check(iso,latitude,longitude,now);
  if(error)throw Error(error);
  const ms=Date.parse(iso);
  const day=Math.floor(ms/ONE_DAY)*ONE_DAY;
  const today=Math.floor(now/ONE_DAY)*ONE_DAY;
  const first=Math.max(day-ONE_DAY,FIRST);
  const last=Math.min(day+ONE_DAY,today);
  const params=new URLSearchParams({
    latitude:String(latitude),longitude:String(longitude),
    start_date:dateString(first),end_date:dateString(last),
    hourly:HOURLY,
    temperature_unit:'fahrenheit',
    timeformat:'unixtime',
    timezone:'GMT',
  });
  return ARCHIVE+'?'+params;
}
function interpretCode(code){
  if(code===0)return'Clear skies';
  if(code===1)return'Mostly clear';
  if(code===2)return'Partly cloudy';
  if(code===3)return'Overcast';
  if([45,48].includes(code))return'Fog';
  if([51,53,55,56,57].includes(code))return'Drizzle';
  if([61,63,65,66,67,80,81,82].includes(code))return'Rain';
  if([71,73,75,77,85,86].includes(code))return'Snow';
  if([95,96,99].includes(code))return'Thunderstorms';
  return'Conditions unavailable';
}
function extract(json,iso){
  const hourly=json?.hourly;
  if(!Array.isArray(hourly?.time))throw Error('No historical hourly weather is available for this date and location.');
  const target=Date.parse(iso);
  let best=-1,difference=Infinity;
  for(let i=0;i<hourly.time.length;i++){
    const sec=Number(hourly.time[i]);
    if(!Number.isFinite(sec))continue;
    const diff=Math.abs(sec*1000-target);
    if(diff<difference){best=i;difference=diff;}
  }
  if(best<0||difference>60*60*1000)throw Error('No historical hourly sample was found near this catch time.');
  const metric=(key)=>{
    const n=hourly[key]?.[best];
    return typeof n==='number'&&Number.isFinite(n)?n:null;
  };
  const temp=metric('temperature_2m');
  const surface=metric('surface_pressure');
  const sea=metric('pressure_msl');
  const code=metric('weather_code');
  if(temp===null&&surface===null&&sea===null&&code===null)throw Error('The historical weather provider returned no measurements for this time.');
  const observedAt=new Date(Number(hourly.time[best])*1000).toISOString();
  return {
    temperatureF:temp,
    surfaceHpa:surface,
    seaLevelHpa:sea,
    weatherCode:code,
    conditions:code===null?'Conditions unavailable':interpretCode(code),
    forecast:'',
    observedAt,
    source:'Open-Meteo Historical Weather API (model estimate)',
    historical:true,
    matchedMinutes:Math.round(difference/60000),
  };
}
async function lookup(iso,latitude,longitude,signal){
  const url=buildUrl(iso,latitude,longitude);
  const result=await fetch(url,{signal,cache:'no-store'});
  if(!result.ok){
    const response=await result.json().catch(()=>({}));
    const reason=typeof response?.reason==='string'?response.reason.slice(0,160):'Historical weather is unavailable';
    throw Error(reason+' (HTTP '+result.status+').');
  }
  return extract(await result.json(),iso);
}
window.DistrictFlatwaterHistoricalWeather={check,buildUrl,extract,lookup};
})();
