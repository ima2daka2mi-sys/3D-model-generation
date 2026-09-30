// Dimensions taken from the VDWC design sheet (section 2–4).
export const SPEC = {
  hallDiameter: 32, // 直径 約32m
  poolDiameter: 10, // 中央水盤 直径 約10m
  walkwayWidth: 4.5, // 通路幅 約4.5m
  ceilingHeight: 7.0, // 天井高 約7.0m
  voidHeight: 10.0, // 中央吹抜け 約10.0m
  panelWidth: 3.0, // 展示パネル 幅3.0m
  panelGap: 3.0, // 間隔 3.0m
  panelHeight: 2.4, // 高さ 2.4m
};

// Layout radii derived from the spec
export const R = {
  hall: SPEC.hallDiameter / 2, // 16
  pool: SPEC.poolDiameter / 2, // 5
  planterIn: 5.6,
  planterOut: 6.6,
  panel: 6.6 + SPEC.walkwayWidth + 0.3, // 11.4: panel face after a 4.5 m walkway
  bedIn: 12.0,
  oculus: 7.0,
};

// 12 slots of 30° around the hall: 0 = entrance, 1..10 = panels, 11 = vote.
// Angle 0 points to +Z; positive angles run counter-clockwise seen from the
// entrance looking in, so 01 is on the visitor's left like the hero image.
export const SLOT = Math.PI / 6;

// Sample entries (placeholder content for the 10 finalist ideas).
export const ENTRIES = [
  { title: 'Green Corridor City', team: 'Team Aurora', country: 'Japan', summary: 'A continuous green spine links parks, schools and transit to cool the city and connect neighbourhoods.' },
  { title: 'Floating Solar Harbor', team: 'Blue Tide Lab', country: 'Netherlands', summary: 'Modular floating platforms generate power, host public space and adapt to rising sea levels.' },
  { title: 'Sky Bridge Network', team: 'Linkage Studio', country: 'Singapore', summary: 'Elevated pedestrian bridges weave towers together, freeing streets for trees and cycling.' },
  { title: 'Smart Mobility Loop', team: 'Motion Commons', country: 'Germany', summary: 'An autonomous shuttle loop with data-driven signals reduces congestion and emissions by 40%.' },
  { title: 'Resilient Riverfront', team: 'Delta Collective', country: 'Brazil', summary: 'Terraced wetlands absorb floods while creating a riverside promenade for everyone.' },
  { title: 'Vertical Forest District', team: 'Verde Atelier', country: 'Italy', summary: 'Mid-rise housing wrapped in planted balconies improves air quality and biodiversity.' },
  { title: 'Zero-Carbon Transit Hub', team: 'North Grid', country: 'Canada', summary: 'A timber station powered by geothermal and solar energy anchors a walkable new centre.' },
  { title: 'Circular Water City', team: 'Maji Design', country: 'Kenya', summary: 'Rain capture, greywater reuse and bioswales close the urban water loop.' },
  { title: 'Community Energy Grid', team: 'Sunline Partners', country: 'Australia', summary: 'Neighbourhood micro-grids share rooftop solar and batteries across homes and schools.' },
  { title: 'Coastal Adaptation Park', team: 'Harbor & Co.', country: 'Korea', summary: 'A layered coastal park protects the waterfront and doubles as a public landscape.' },
].map((e, i) => ({ ...e, no: String(i + 1).padStart(2, '0'), seed: i + 1 }));
