import { Document } from '../document/Document';
import { ExportRegion } from './ExportPlainText';

export function exportJSON(doc: Document, region?: ExportRegion): string {
  if (!region) {
    return JSON.stringify(doc.toData(), null, 2);
  }

  // Export only the region subset
  const data = doc.toData();
  const regionData = {
    ...data,
    width: region.x2 - region.x1 + 1,
    height: region.y2 - region.y1 + 1,
    region: { x1: region.x1, y1: region.y1, x2: region.x2, y2: region.y2 },
    layers: data.layers.map(layerData => ({
      ...layerData,
      cells: layerData.cells
        .slice(region.y1, region.y2 + 1)
        .map(row => row.slice(region.x1, region.x2 + 1)),
    })),
  };
  return JSON.stringify(regionData, null, 2);
}
