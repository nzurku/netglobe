// Loads submarine cable route geometry from local TeleGeography data files.
// Data source: https://www.submarinecablemap.com/api/v3/
// To update: re-download cable-geo.json, landing-point-geo.json, cable-all.json into src/data/

import cableGeoData from '@/data/cable-geo.json';
import landingPointData from '@/data/landing-point-geo.json';
import cableAllData from '@/data/cable-all.json';
import type { UnderseaCable, CableLandingPoint } from '@/types';

// Cables to display — add/remove IDs here to change which cables appear on the map.
// Full catalogue is in src/data/cable-all.json (~688 cables).
export const SELECTED_CABLE_IDS: string[] = [
  'exa-express',
  'topaz',
  'eac-c2c',
  'asia-africa-europe-1-aae-1',
  'peace-cable',
  'pacific-crossing-1-pc-1',
];

interface CableGeoFeature {
  properties: { id: string; name: string; color: string; feature_id: string };
  geometry: { type: string; coordinates: number[][][] };
}

interface LandingPointFeature {
  properties: { id: string; name: string };
  geometry: { type: string; coordinates: number[] };
}

interface CableMetaEntry {
  id: string;
  name: string;
  length: string | null;
  owners: string;
  rfs_year: number | null;
  landing_points: { id: string; name: string; country: string }[];
}

// Country name → ISO 2-letter code
const COUNTRY_ISO: Record<string, string> = {
  'Canada': 'CA', 'Ireland': 'IE', 'United Kingdom': 'GB', 'Japan': 'JP',
  'Taiwan': 'TW', 'China': 'CN', 'Philippines': 'PH', 'Singapore': 'SG',
  'South Korea': 'KR', 'Cambodia': 'KH', 'Djibouti': 'DJ', 'Egypt': 'EG',
  'France': 'FR', 'Greece': 'GR', 'India': 'IN', 'Italy': 'IT',
  'Malaysia': 'MY', 'Myanmar': 'MM', 'Oman': 'OM', 'Pakistan': 'PK',
  'Qatar': 'QA', 'Saudi Arabia': 'SA', 'Thailand': 'TH',
  'United Arab Emirates': 'AE', 'Vietnam': 'VN', 'Yemen': 'YE',
  'United States': 'US', 'Cyprus': 'CY', 'Kenya': 'KE', 'Maldives': 'MV',
  'Malta': 'MT', 'Seychelles': 'SC', 'Somalia': 'SO', 'Tunisia': 'TN',
};

function extractCity(name: string): string {
  return name.split(',')[0]!.trim();
}

export function buildCableRoutes(): UnderseaCable[] {
  const geoFeatures = (cableGeoData as { features: CableGeoFeature[] }).features;
  const lpFeatures = (landingPointData as { features: LandingPointFeature[] }).features;
  const allCables = cableAllData as CableMetaEntry[];

  // Landing point coordinate lookup: id → [lon, lat]
  const lpCoords = new Map<string, [number, number]>();
  for (const f of lpFeatures) {
    lpCoords.set(f.properties.id, [f.geometry.coordinates[0]!, f.geometry.coordinates[1]!]);
  }

  // Cable metadata lookup
  const metaMap = new Map<string, CableMetaEntry>();
  for (const c of allCables) {
    metaMap.set(c.id, c);
  }

  // Group GeoJSON features by cable ID (some cables have multiple segments)
  const selectedSet = new Set(SELECTED_CABLE_IDS);
  const featuresByCable = new Map<string, CableGeoFeature[]>();
  for (const f of geoFeatures) {
    if (selectedSet.has(f.properties.id)) {
      const arr = featuresByCable.get(f.properties.id) || [];
      arr.push(f);
      featuresByCable.set(f.properties.id, arr);
    }
  }

  // Build UnderseaCable array
  const cables: UnderseaCable[] = [];
  for (const id of SELECTED_CABLE_IDS) {
    const features = featuresByCable.get(id);
    const meta = metaMap.get(id);
    if (!features || features.length === 0) continue;

    // Merge all line segments into a single points array
    const points: [number, number][] = [];
    for (const f of features) {
      for (const line of f.geometry.coordinates) {
        for (const coord of line) {
          points.push([coord[0]!, coord[1]!]);
        }
      }
    }

    // Build landing points from metadata + coordinate lookup
    const landingPoints: CableLandingPoint[] = [];
    if (meta?.landing_points) {
      for (const lp of meta.landing_points) {
        const coords = lpCoords.get(lp.id);
        const iso = COUNTRY_ISO[lp.country] || lp.country;
        landingPoints.push({
          country: iso,
          countryName: lp.country,
          city: extractCity(lp.name),
          lon: coords ? coords[0]! : 0,
          lat: coords ? coords[1]! : 0,
        });
      }
    }

    cables.push({
      id,
      name: meta?.name || features[0]!.properties.name,
      points,
      major: true,
      rfsYear: meta?.rfs_year ?? undefined,
      owners: meta?.owners ? meta.owners.split(', ') : [],
      landingPoints,
    });
  }

  return cables;
}
