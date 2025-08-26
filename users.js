// users.js - User authentication configuration
const bcrypt = require('bcrypt');

// In production, you'd want to store these in a database
// For now, we'll use a simple in-memory store
const users = [
  {
    id: 1,
    username: 'admin',
    // This is a hashed version of 'admin123'
    passwordHash: '$2b$10$rQJ8N5vK8mK9nL0mK9nL0mK9nL0mK9nL0mK9nL0mK9nL0mK9nL0mK9nL0',
    role: 'admin',
    name: 'Administrator'
  },
  {
    id: 2,
    username: 'installer',
    // This is a hashed version of 'installer123'
    passwordHash: '$2b$10$rQJ8N5vK8mK9nL0mK9nL0mK9nL0mK9nL0mK9nL0mK9nL0mK9nL0mK9nL0',
    role: 'installer',
    name: 'Field Installer'
  }
];

// Initialize default passwords (in production, use a proper user management system)
async function initializeUsers() {
  // Hash default passwords if they haven't been hashed yet
  for (let user of users) {
    if (user.passwordHash.length < 20) { // Simple check to see if it's already hashed
      user.passwordHash = await bcrypt.hash(user.passwordHash, 10);
    }
  }
  
  // Generate proper hashes for our demo passwords
  const adminHash = await bcrypt.hash('admin123', 10);
  const installerHash = await bcrypt.hash('installer123', 10);
  
  // Update the users with proper hashes
  users[0].passwordHash = adminHash;
  users[1].passwordHash = installerHash;
  
  console.log('✅ User passwords initialized with proper hashes');
}

// Initialize users when this module is loaded
initializeUsers();

// Authentication functions
async function authenticateUser(username, password) {
  const user = users.find(u => u.username === username);
  if (!user) {
    return null;
  }
  
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return null;
  }
  
  // Return user without password hash
  const { passwordHash, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

function getUserById(id) {
  const user = users.find(u => u.id === id);
  if (!user) {
    return null;
  }
  
  // Return user without password hash
  const { passwordHash, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

module.exports = {
  users,
  authenticateUser,
  getUserById
};
