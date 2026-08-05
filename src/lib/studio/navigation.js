import { TOOL_CATEGORIES } from '@/lib/workflow-catalog';

export const CATEGORY_QUERY_KEY = 'category';

export function isValidCategory(category) {
  return TOOL_CATEGORIES.some(entry => entry.id === category);
}

export function parseCategoryParam(value) {
  if (!value || !isValidCategory(value)) {
    return 'all';
  }
  return value;
}

export function buildHomeHref(category) {
  return buildToolsHref(category);
}

export function buildToolsHref(category) {
  const parsed = parseCategoryParam(category);
  if (parsed === 'all') {
    return '/';
  }
  return `/?${CATEGORY_QUERY_KEY}=${parsed}`;
}

export function appendCategoryToHref(href, category) {
  const parsed = parseCategoryParam(category);
  if (parsed === 'all') {
    return href;
  }

  const [pathname, search = ''] = href.split('?');
  const params = new URLSearchParams(search);
  params.set(CATEGORY_QUERY_KEY, parsed);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
