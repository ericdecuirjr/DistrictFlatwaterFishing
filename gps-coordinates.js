/* Convert manually entered latitude and longitude; no network and no implicit geolocation. */
(()=>{
'use strict';
function parse(latitudeText,longitudeText){
  const lat=String(latitudeText??'').trim(),lon=String(longitudeText??'').trim();
  if(!lat||!lon)throw Error('Enter both latitude and longitude.');
  const decimal=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  if(!decimal.test(lat)||!decimal.test(lon))throw Error('Use decimal GPS coordinates, such as 38.8895 and -77.0353.');
  const latitude=Number(lat),longitude=Number(lon);
  if(!Number.isFinite(latitude)||latitude < -90||latitude>90)throw Error('Latitude must be between -90 and 90.');
  if(!Number.isFinite(longitude)||longitude < -180||longitude>180)throw Error('Longitude must be between -180 and 180.');
  return {latitude,longitude};
}
window.DistrictFlatwaterCoordinates={parse};
})();