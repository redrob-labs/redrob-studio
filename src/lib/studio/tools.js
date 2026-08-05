import { getAvailableTasks, getToolCategory } from '@/lib/workflow-catalog';

export function buildCatalogTools() {
  const tools = getAvailableTasks('image')
    .filter(task => !task.catalogHidden)
    .map(task => ({
      ...task,
      modality: 'image',
      category: getToolCategory(task.id, 'image'),
      href: `/image/${task.id}`,
    }));

  for (const task of getAvailableTasks('audio')) {
    tools.push({
      ...task,
      modality: 'audio',
      category: getToolCategory(task.id, 'audio'),
      href: `/audio/${task.id}`,
    });
  }

  return tools;
}

export function getToolHref(modality, task) {
  return `/${modality}/${task}`;
}
