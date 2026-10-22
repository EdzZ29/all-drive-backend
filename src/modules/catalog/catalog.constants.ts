// The website's car classes and rate zones (alldrive-website/lib/site.ts). The catalog only
// stores the admin's changes on top of the website's built-in fleet, keyed by these ids.
export const CAR_CLASS_IDS = ['sedan', 'mpv', 'suv', 'van'] as const;
export const ZONE_IDS = ['butuan', 'caraga', 'cdo-davao', 'outside'] as const;

export type ZoneId = (typeof ZONE_IDS)[number];
// Daily self-drive rate in PHP per zone; null = rate on request.
export type Rates = Record<ZoneId, number | null>;

// How a car model shows on the website.
export enum Availability {
  AVAILABLE = 'available', // listed, "Available" badge
  UNAVAILABLE = 'unavailable', // listed, "Not available" badge
  HIDDEN = 'hidden', // not shown on the website
}

// A photo the admin added to a car model (shown after its built-in photos).
export interface CatalogPhoto {
  url: string;
  label: string;
  color: string;
}

// Website car model ids, e.g. "toyota-vios".
export const MODEL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
