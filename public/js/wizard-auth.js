// Auth gate + API header helper + sidebar user/logout
// Authentication check - redirect to login if not authenticated
(function() {
  const token = localStorage.getItem('authToken');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }
  
  // Verify token is valid
  fetch('/api/auth/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (!response.ok) {
      localStorage.removeItem('authToken');
      window.location.href = '/login.html';
    }
  })
  .catch(() => {
    localStorage.removeItem('authToken');
    window.location.href = '/login.html';
  });
})();

function getAuthHeaders() {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

}

// User authentication functions
function setupUserInfo() {
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const userInfoElement = document.getElementById('userInfo');
  const userNameElement = document.getElementById('userName');
  const userRoleElement = document.getElementById('userRole');
  const logoutBtn = document.getElementById('logoutBtn');
  const adminTestModeSection = document.getElementById('adminTestModeSection');
  
  if (userInfo.name && userInfo.role) {
    userNameElement.textContent = userInfo.name;
    userRoleElement.textContent = userInfo.role;
    userInfoElement.style.display = 'block';
    
    // Show test mode section only for admin users
    if (userInfo.role === 'admin' && adminTestModeSection) {
      adminTestModeSection.classList.remove('hidden');
    }
  }
  
  // Setup logout functionality
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage and redirect to login
      localStorage.removeItem('authToken');
      localStorage.removeItem('userInfo');
      window.location.href = '/login.html';
    }
  });
}
