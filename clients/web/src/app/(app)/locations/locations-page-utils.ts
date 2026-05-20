"use client";

import { api, type Location } from "@/lib/api";

export function sortLocations(locations: Location[]) {
  return [...locations].sort((a, b) => a.position - b.position);
}

export async function fetchLocationsPageData() {
  const [locations, users] = await Promise.all([api.getLocations(), api.getUsersLookup()]);
  return {
    locations: sortLocations(locations),
    users,
  };
}

export function getRootLocations(locations: Location[]) {
  return sortLocations(locations.filter((location) => !location.parent_id));
}

export function getChildLocations(locations: Location[], parentId: number) {
  return sortLocations(locations.filter((location) => location.parent_id === parentId));
}

export function getSiblingLocations(locations: Location[], parentId: number | null) {
  return sortLocations(
    locations.filter((location) => (location.parent_id ?? null) === parentId),
  );
}

export async function persistLocationSiblingOrder(locations: Location[], parentId: number | null) {
  const siblings = sortLocations(
    locations.filter((location) => (location.parent_id ?? null) === parentId),
  );

  for (let index = 0; index < siblings.length; index += 1) {
    if (siblings[index].position !== index) {
      await api.updateLocation(siblings[index].id, { position: index });
    }
  }
}
