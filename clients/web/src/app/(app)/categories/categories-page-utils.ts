"use client";

import { api, type Category, type Property } from "@/lib/api";

export function sortCategories(categories: Category[]) {
  return [...categories].sort((a, b) => a.position - b.position);
}

export function sortProperties(properties: Property[]) {
  return [...properties].sort((a, b) => a.position - b.position);
}

export function buildEditablePropertyPayload(property: Partial<Property>): Partial<Property> {
  return {
    category_id: property.category_id,
    name: property.name,
    property_type: property.property_type,
    unit: property.unit,
    options: property.options,
    required: property.required,
    show_in_list: property.show_in_list,
    display_width: property.display_width,
    position: property.position,
  };
}

export async function fetchCategoriesPageData() {
  return sortCategories(await api.getCategories());
}

export async function fetchCategoryProperties(categoryId: number) {
  return sortProperties(await api.getProperties(categoryId));
}

export async function persistCategoryOrder(categories: Category[]) {
  for (let index = 0; index < categories.length; index += 1) {
    if (categories[index].position !== index) {
      await api.updateCategory(categories[index].id, { position: index });
    }
  }
}

export async function persistPropertyOrder(properties: Property[]) {
  for (let index = 0; index < properties.length; index += 1) {
    if (properties[index].position !== index) {
      await api.updateProperty(properties[index].id, { position: index });
    }
  }
}
