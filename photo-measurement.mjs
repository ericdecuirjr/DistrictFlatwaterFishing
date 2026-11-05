/* Reference points are fractions of the original photo dimensions. */
export function estimateFishLength({referencePoints, fishPoints, referenceLength, unit, imageWidth, imageHeight}) {
  if (!['in','cm'].includes(unit)) throw new Error('Choose inches or centimeters.');
  if (!Number.isFinite(referenceLength) || referenceLength <= 0) throw new Error('Enter a positive reference dimension.');
  if (![imageWidth,imageHeight].every(n => Number.isFinite(n) && n > 0)) throw new Error('Photo dimensions are required.');
  function distance(points) {
    if (!Array.isArray(points) || points.length !== 2 || !points.every(p => p && [p.x,p.y].every(n => Number.isFinite(n) && n >= 0 && n <= 1))) throw new Error('Mark two endpoints inside the photo.');
    const d = Math.hypot((points[1].x-points[0].x)*imageWidth, (points[1].y-points[0].y)*imageHeight);
    if (d === 0) throw new Error('Endpoints must be separate.');
    return d;
  }
  const length = distance(fishPoints) / distance(referencePoints) * referenceLength;
  if (!Number.isFinite(length) || length <= 0) throw new Error('Cannot calculate a valid length.');
  return {method:'photo-reference', estimated:true, length, unit,
    referenceLength, referencePoints:referencePoints.map(p=>({...p})), fishPoints:fishPoints.map(p=>({...p})), imageWidth, imageHeight};
}
