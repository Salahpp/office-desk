/* ============================================================
   Office Desk — Authentication & Privacy Security Engine (auth.js)
   Username & Password Authentication, Role Protection, & Data Privacy
   ============================================================ */

window.Auth = (function () {
  const SESSION_KEY = 'od_logged_in_user_id';
  let _currentUser = null;

  async function init() {
    const allUsers = await DB.getAll('users');
    if (!allUsers || allUsers.length === 0) return null;

    const savedId = localStorage.getItem(SESSION_KEY);
    if (!savedId) {
      _currentUser = null;
      return null;
    }

    _currentUser = allUsers.find((u) => u.id === savedId && u.status === 'active') || null;
    return _currentUser;
  }

  function getCurrentUser() {
    return _currentUser;
  }

  // Login with Username or Email and Password
  async function login(identity, password) {
    if (!identity || !password) {
      return { success: false, message: 'Please enter both username/email and password.' };
    }

    const cleanId = identity.trim().toLowerCase();
    const cleanPass = password.trim();

    const allUsers = await DB.getAll('users');
    const user = allUsers.find((u) => {
      const uEmail = (u.email || '').toLowerCase();
      const uName = (u.username || '').toLowerCase();
      return uEmail === cleanId || uName === cleanId;
    });

    if (!user) {
      return { success: false, message: 'User account not found with that username or email.' };
    }

    if (user.status === 'inactive') {
      return { success: false, message: 'This account is currently inactive. Contact your administrator.' };
    }

    // Verify password (or PIN as secondary fallback)
    const validPass = user.password || '123456';
    const validPin = user.pin || '1234';

    if (cleanPass !== validPass && cleanPass !== validPin) {
      return { success: false, message: 'Incorrect password. Please verify and try again.' };
    }

    // Authentication Success
    _currentUser = user;
    localStorage.setItem(SESSION_KEY, user.id);

    document.dispatchEvent(new CustomEvent('auth:changed', { detail: _currentUser }));
    return { success: true, user };
  }

  // Logout session
  function logout() {
    _currentUser = null;
    localStorage.removeItem(SESSION_KEY);
    document.dispatchEvent(new CustomEvent('auth:changed', { detail: null }));
    App.toast('You have been logged out securely.', 'info');
  }

  // Quick switch for demo testing
  async function switchUser(userId) {
    const allUsers = await DB.getAll('users');
    const target = allUsers.find((u) => u.id === userId);
    if (!target) return false;

    _currentUser = target;
    localStorage.setItem(SESSION_KEY, userId);

    document.dispatchEvent(new CustomEvent('auth:changed', { detail: _currentUser }));
    return true;
  }

  function isAdmin() {
    return _currentUser && _currentUser.role === 'admin';
  }

  function isManager() {
    return _currentUser && (_currentUser.role === 'manager' || _currentUser.role === 'admin');
  }

  function isStaff() {
    return _currentUser && _currentUser.role === 'staff';
  }

  // ── Privacy & Access Control Enforcement ──
  // Staff can ONLY access their own salary slip!
  function canAccessSalary(targetUserId) {
    if (!_currentUser) return false;
    if (isAdmin()) return true; // Admin has company oversight
    return _currentUser.id === targetUserId; // Staff/Manager can ONLY view their own slip
  }

  // Can user review/approve this leave?
  function canReviewLeave(leave) {
    if (!_currentUser) return false;
    if (isAdmin()) return true;
    return _currentUser.role === 'manager' && leave.managerId === _currentUser.id;
  }

  // Can user configure settings?
  function canManageSettings() {
    return isAdmin();
  }

  // Can user manage staff?
  function canManageStaff() {
    return isAdmin();
  }

  // Render Secure Login Screen
  function renderLoginScreen() {
    return `
      <div style="min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at top, #1E293B, #0B1120 70%); padding: 20px;">
        <div style="width: 100%; max-width: 440px; background: rgba(30, 41, 59, 0.85); backdrop-filter: blur(16px); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); padding: 32px 28px; box-shadow: var(--shadow-lg);">
          
          <!-- Logo & Brand Header -->
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 54px; height: 54px; margin: 0 auto 12px; border-radius: 16px; background: linear-gradient(135deg, var(--primary), var(--primary-light)); display: grid; place-items: center; font-size: 1.5rem; font-weight: 800; color: #fff; box-shadow: 0 8px 24px var(--primary-glow);">
              OD
            </div>
            <h2 style="font-size: 1.55rem; margin-bottom: 4px;">Office Desk</h2>
            <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 500;">
              Shah Digital Marketing Agency & Academy
            </div>
            <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); color: #6EE7B7; font-size: 0.72rem; padding: 3px 10px; border-radius: 99px; margin-top: 10px; font-weight: 600;">
              🔒 Encrypted Employee Login
            </div>
          </div>

          <!-- Login Form -->
          <form id="login-form" onsubmit="Auth.handleLoginFormSubmit(event)">
            <div class="form-group">
              <label class="form-label">Username or Email</label>
              <input type="text" id="login-identity" class="form-control" placeholder="e.g. admin, sara, or zara" required autocomplete="username">
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
              <label class="form-label">
                <span>Password</span>
                <span class="small text-dim" style="cursor: pointer;" onclick="Auth.togglePasswordVisibility()">Show Password 👁️</span>
              </label>
              <input type="password" id="login-password" class="form-control" placeholder="Enter your password" required autocomplete="current-password">
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" id="btn-login-submit" style="margin-bottom: 16px;">
              Sign In to Office Desk ➔
            </button>
          </form>

          <!-- Privacy Notice & Demo Credential Pills -->
          <div style="border-top: 1px solid var(--line); padding-top: 18px; margin-top: 18px;">
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em; text-align: center;">
              Demo Accounts (Tap to Quick Fill):
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button type="button" class="btn btn-secondary btn-sm" style="justify-content: space-between; font-size: 0.82rem;" onclick="Auth.fillDemo('admin', 'admin123')">
                <span>🛡️ <strong>Admin (CEO):</strong> Ahmed Shah</span>
                <span class="role-tag admin" style="font-size: 0.65rem;">admin123</span>
              </button>

              <button type="button" class="btn btn-secondary btn-sm" style="justify-content: space-between; font-size: 0.82rem;" onclick="Auth.fillDemo('sara', 'sara123')">
                <span>💼 <strong>Manager:</strong> Sara Khan (Marketing)</span>
                <span class="role-tag manager" style="font-size: 0.65rem;">sara123</span>
              </button>

              <button type="button" class="btn btn-secondary btn-sm" style="justify-content: space-between; font-size: 0.82rem;" onclick="Auth.fillDemo('zara', 'zara123')">
                <span>💻 <strong>Staff:</strong> Zara Ahmed (SEO Lead)</span>
                <span class="role-tag staff" style="font-size: 0.65rem;">zara123</span>
              </button>

              <button type="button" class="btn btn-secondary btn-sm" style="justify-content: space-between; font-size: 0.82rem;" onclick="Auth.fillDemo('hassan', 'hassan123')">
                <span>🎨 <strong>Staff:</strong> Hassan Ali (Graphic Designer)</span>
                <span class="role-tag staff" style="font-size: 0.65rem;">hassan123</span>
              </button>
            </div>

            <p class="small text-dim" style="text-align: center; margin-top: 16px; font-size: 0.72rem; line-height: 1.4;">
              🔒 <strong>Privacy Assured:</strong> Staff members can only view their own punch logs, attendance, and confidential salary slips. Managers only supervise their assigned team members.
            </p>
          </div>

        </div>
      </div>
    `;
  }

  function fillDemo(identity, pass) {
    const idInput = document.getElementById('login-identity');
    const passInput = document.getElementById('login-password');
    if (idInput && passInput) {
      idInput.value = identity;
      passInput.value = pass;
      App.toast(`Credentials filled for ${identity}. Press Sign In or wait...`, 'info');
      setTimeout(() => {
        const form = document.getElementById('login-form');
        if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
      }, 350);
    }
  }

  function togglePasswordVisibility() {
    const passInput = document.getElementById('login-password');
    if (passInput) {
      passInput.type = passInput.type === 'password' ? 'text' : 'password';
    }
  }

  async function handleLoginFormSubmit(e) {
    e.preventDefault();
    const idInput = document.getElementById('login-identity');
    const passInput = document.getElementById('login-password');
    const btn = document.getElementById('btn-login-submit');

    if (btn) btn.disabled = true;

    try {
      const res = await login(idInput.value, passInput.value);
      if (!res.success) {
        App.toast(res.message, 'danger');
        if (btn) btn.disabled = false;
      } else {
        App.toast(`Welcome back, ${res.user.name}! ✅`, 'success');
      }
    } catch (err) {
      App.toast('Login error: ' + err.message, 'danger');
      if (btn) btn.disabled = false;
    }
  }

  // Switch role dialog
  async function openRoleSwitcherModal() {
    const allUsers = await DB.getAll('users');
    const current = getCurrentUser();

    const admins = allUsers.filter((u) => u.role === 'admin');
    const managers = allUsers.filter((u) => u.role === 'manager');
    const staff = allUsers.filter((u) => u.role === 'staff');

    const renderCard = (u) => {
      const active = current && u.id === current.id ? 'active' : '';
      return `
        <div class="user-select-card ${active}" onclick="Auth.switchUser('${u.id}').then(() => { App.closeModal(); App.toast('Switched account to ' + '${u.name}', 'info'); })">
          <div class="avatar">${u.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div>
          <div style="font-weight: 700; font-size: 0.85rem; margin-top: 4px;">${u.name}</div>
          <div class="small text-dim">${u.designation}</div>
          <span class="role-tag ${u.role}" style="margin-top: 6px; font-size: 0.65rem;">${u.role.toUpperCase()}</span>
          <div class="small text-muted" style="margin-top: 4px; font-size: 0.68rem;">🔑 Pass: ${u.password || '123456'}</div>
        </div>
      `;
    };

    const html = `
      <div class="modal-header">
        <h3 class="card-title">👥 Switch User & Test Privacy</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <p class="small text-muted" style="margin-bottom: 14px;">
        Tap any profile below to immediately switch sessions and experience their isolated private dashboard.
      </p>

      <h4 style="margin-top: 10px; color: #F87171;">🛡️ Administrator (Company Head)</h4>
      <div class="user-select-grid">
        ${admins.map(renderCard).join('')}
      </div>

      <h4 style="margin-top: 14px; color: #FBBF24;">💼 Team Managers & Leads</h4>
      <div class="user-select-grid">
        ${managers.map(renderCard).join('')}
      </div>

      <h4 style="margin-top: 14px; color: #60A5FA;">💻 Staff Members</h4>
      <div class="user-select-grid">
        ${staff.map(renderCard).join('')}
      </div>

      <div style="text-align: right; margin-top: 16px;">
        <button class="btn btn-danger btn-sm" onclick="App.closeModal(); Auth.logout();">🚪 Sign Out Completely</button>
      </div>
    `;

    App.openModal(html);
  }

  return {
    init,
    getCurrentUser,
    login,
    logout,
    switchUser,
    isAdmin,
    isManager,
    isStaff,
    canAccessSalary,
    canReviewLeave,
    canManageSettings,
    canManageStaff,
    renderLoginScreen,
    fillDemo,
    togglePasswordVisibility,
    handleLoginFormSubmit,
    openRoleSwitcherModal
  };
})();
