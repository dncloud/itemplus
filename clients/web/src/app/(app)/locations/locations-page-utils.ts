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

export async function persistLocationSiblingOrder(orderedSiblings: Location[]) {
  for (let index = 0; index < orderedSiblings.length; index += 1) {
    await api.updateLocation(orderedSiblings[index].id, { position: index });
  }
}
