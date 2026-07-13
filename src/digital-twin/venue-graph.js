/**
 * Venue graph loader.
 *
 * Reads the venue topology (zones, corridors, queue points, volunteers) from
 * the JSON data file and exposes lookup helpers used by every domain module.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'venue-data');

/**
 * Load and parse the venue data file.
 * @returns {object} parsed venue data
 */
export function loadVenueData() {
  const raw = readFileSync(join(dataDir, 'metlife-stadium.json'), 'utf8');
  const data = JSON.parse(raw);

  /* Build adjacency list for fast graph traversal. */
  const adjacency = new Map();
  for (const zone of data.zones) {
    adjacency.set(zone.id, []);
  }
  for (const corridor of data.corridors) {
    adjacency.get(corridor.from)?.push({ to: corridor.to, ...corridor });
    adjacency.get(corridor.to)?.push({ to: corridor.from, ...corridor, from: corridor.to });
  }

  return { ...data, adjacency };
}

/**
 * Find all accessible corridors from a zone.
 * @param {object} venueData
 * @param {string} zoneId
 * @returns {Array<object>}
 */
export function accessibleCorridorsFrom(venueData, zoneId) {
  const edges = venueData.adjacency.get(zoneId) || [];
  return edges.filter((e) => e.accessible);
}

/**
 * Find shortest path between two zones (BFS on unweighted graph for simplicity).
 * @param {object} venueData
 * @param {string} from
 * @param {string} to
 * @param {boolean} [accessibleOnly=false]
 * @returns {string[]|null} ordered zone IDs or null if unreachable
 */
export function findPath(venueData, from, to, accessibleOnly = false) {
  if (from === to) {
    return [from];
  }
  const visited = new Set([from]);
  const queue = [[from]];

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    const edges = venueData.adjacency.get(current) || [];

    for (const edge of edges) {
      if (accessibleOnly && !edge.accessible) {
        continue;
      }
      if (visited.has(edge.to)) {
        continue;
      }
      const newPath = [...path, edge.to];
      if (edge.to === to) {
        return newPath;
      }
      visited.add(edge.to);
      queue.push(newPath);
    }
  }
  return null;
}
