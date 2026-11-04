/* Deterministic historical-weather unit tests: no network, GPS or catches. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const sandbox={window:{},Date,Number,Math,URL,URLSearchParams,Error,console};
vm.runInNewContext(readFileSync('historical-weather.js','utf8'),sandbox,{filename:'historical-weather.js'});
const weather=sandbox.window.DistrictFlatwaterHistoricalWeather;
assert.ok(weather);
const when='2026-10-19T15:25:00.000Z';
const now=Date.parse('2026-11-03T22:00:00.000Z');
assert.equal(weather.check(when,38.9,-77,now),null);
assert.match(weather.check(when,NaN,0,now),/location/);
assert.match(weather.check('2030-10-19T15:25:00.000Z',38.9,-77,now),/future/);
assert.match(weather.check('1899-10-19T15:25:00.000Z',38.9,-77,now),/1940/);
const url=new URL(weather.buildUrl(when,38.9,-77,now));
assert.equal(url.hostname,'archive-api.open-meteo.com');
assert.equal(url.searchParams.get('start_date'),'2026-10-18');
assert.equal(url.searchParams.get('end_date'),'2026-10-20');
assert.equal(url.searchParams.get('timeformat'),'unixtime');
assert.equal(url.searchParams.get('timezone'),'GMT');
const seconds=Math.floor(Date.parse(when)/1000);
const sample={
 hourly:{
  time:[seconds-3600,seconds-1500,seconds+3000],
  temperature_2m:[61,62,64],
  surface_pressure:[1010,1012,1011],
  pressure_msl:[1017,1019,1018],
  weather_code:[0,2,3]
 }
};
const result=weather.extract(sample,when);
assert.equal(result.temperatureF,62);
assert.equal(result.surfaceHpa,1012);
assert.equal(result.weatherCode,2);
assert.equal(result.historical,true);
assert.equal(result.matchedMinutes,25);
assert.match(result.source,/Historical/);
assert.throws(()=>weather.extract({hourly:{time:[]}},when),/No historical/);
assert.throws(()=>weather.extract({hourly:{time:[seconds+86400]}},when),/No historical/);
assert.throws(()=>weather.extract({hourly:{time:[seconds],temperature_2m:[null]}},when),/no measurements/);
console.log('Historical weather URL, UTC matching, invalid dates and missing-data checks passed');
