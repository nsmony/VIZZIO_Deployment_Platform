const users = [
  {
    id: 'u1',
    name: 'Alex Johnson',
    email: 'alex.johnson@acmetcorp.com',
    role: 'Admin',
    status: 'Active',
    deployments: 12,
    lastLogin: 'May 20, 2024 10:30 AM',
    groups: ['Engineering'],
  },
  {
    id: 'u2',
    name: 'Maya Patel',
    email: 'maya.patel@acmetcorp.com',
    role: 'User',
    status: 'Active',
    deployments: 8,
    lastLogin: 'May 18, 2024 09:14 AM',
    groups: ['Ops'],
  },
  {
    id: 'u3',
    name: 'Noah Carter',
    email: 'noah.carter@acmetcorp.com',
    role: 'User',
    status: 'Inactive',
    deployments: 3,
    lastLogin: 'May 12, 2024 02:27 PM',
    groups: ['Analytics'],
  },
];

export function findUsers() {
  return users;
}

export function findUserById(id) {
  return users.find((user) => user.id === id);
}

export function addUser(user) {
  users.push(user);
  return user;
}

export function updateUser(id, updates) {
  const user = findUserById(id);
  if (!user) return null;
  Object.assign(user, updates);
  return user;
}

export function deleteUser(id) {
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) return null;
  return users.splice(index, 1)[0];
}
