const groups = [
  {
    id: 'g1',
    name: 'Engineering',
    deploymentIds: ['d1'],
    created: '2026-05-20',
  },
  {
    id: 'g2',
    name: 'Ops',
    deploymentIds: ['d1'],
    created: '2026-05-20',
  },
  {
    id: 'g3',
    name: 'Analytics',
    deploymentIds: [],
    created: '2026-05-20',
  },
];

export function findGroups() {
  return groups;
}

export function findGroupById(id) {
  return groups.find((group) => group.id === id);
}

export function addGroup(group) {
  groups.push(group);
  return group;
}

export function updateGroup(id, updates) {
  const group = findGroupById(id);
  if (!group) return null;
  Object.assign(group, updates);
  return group;
}
