/* ============================================================
   Office Desk — Main Application Router & Shell (app.js)
   Integrates Dashboards (Admin/Manager/Staff), PWA Lifecycle,
   Camera Watermark Punching, Leaves, Tasks, Payroll & Settings
   ============================================================ */

window.App = (function () {
  let _currentView = 'dashboard';
  let _audioCtx = null;

  // Synthesize pleasant chime sound for punches (Zero external assets needed)
  function playPunchSound() {
    try {
      if (!_audioCtx) {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (_audioCtx.state === 'suspended') {
        _audioCtx.resume();
      }

      const osc = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, _audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880.0, _audioCtx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.15, _audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(_audioCtx.destination);

      osc.start();
      osc.stop(_audioCtx.currentTime + 0.36);

      // Mobile haptic vibration if supported
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    } catch (e) {
      // Audio not permitted or supported
    }
  }

  // Toast Notification System
  function toast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'danger' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    t.innerHTML = `<span>${icon}</span><span style="flex:1;">${message}</span>`;

    container.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(40px)';
      setTimeout(() => t.remove(), 250);
    }, 3200);
  }

  // Modal Dialog System
  function openModal(html) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'app-modal-overlay';
    overlay.onclick = (e) => {
      if (e.target === overlay) closeModal();
    };

    const content = document.createElement('div');
    content.className = 'modal-content';
    content.innerHTML = html;

    overlay.appendChild(content);
    document.body.appendChild(overlay);
  }

  function closeModal() {
    const existing = document.getElementById('app-modal-overlay');
    if (existing) existing.remove();
  }

  // Define navigation views per user role
  function getNavItemsForRole(role) {
    if (role === 'admin') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'attendance', label: 'Attendance', icon: '📅' },
        { id: 'leaves', label: 'Leaves', icon: '🌴' },
        { id: 'tasks', label: 'Tasks', icon: '📋' },
        { id: 'payroll', label: 'Payroll', icon: '💰' },
        { id: 'staff', label: 'Staff', icon: '👥' },
        { id: 'settings', label: 'Settings', icon: '⚙️' }
      ];
    } else if (role === 'manager') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'punch', label: 'Punch In/Out', icon: '👊' },
        { id: 'attendance', label: 'Team Attendance', icon: '📅' },
        { id: 'leaves', label: 'Leave Approvals', icon: '🌴' },
        { id: 'tasks', label: 'Team Tasks', icon: '📋' },
        { id: 'payslip', label: 'My Payslip', icon: '🧾' }
      ];
    } else {
      // Staff
      return [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'punch', label: 'Punch In/Out', icon: '👊' },
        { id: 'attendance', label: 'My Attendance', icon: '📅' },
        { id: 'leaves', label: 'My Leaves', icon: '🌴' },
        { id: 'tasks', label: 'My Tasks', icon: '📋' },
        { id: 'payslip', label: 'Salary Slip', icon: '🧾' }
      ];
    }
  }

  // Render Shell Navigation & Layout
  function renderShell() {
    const user = Auth.getCurrentUser();
    if (!user) {
      document.getElementById('app').innerHTML = Auth.renderLoginScreen();
      return;
    }

    const settings = AdminSettings.getSettings();
    const navItems = getNavItemsForRole(user.role);

    // Sidebar items HTML
    const sidebarLinksHTML = navItems
      .map((item) => {
        const active = item.id === _currentView ? 'active' : '';
        return `
        <button type="button" class="nav-link ${active}" onclick="App.navigate('${item.id}')">
          <span style="font-size: 1.15rem;">${item.icon}</span>
          <span>${item.label}</span>
        </button>
      `;
      })
      .join('');

    // Bottom bar items for mobile (up to 5 items)
    const bottomNavItems = navItems.slice(0, 5);
    const bottomBarHTML = bottomNavItems
      .map((item) => {
        const active = item.id === _currentView ? 'active' : '';
        return `
        <button type="button" class="nav-bottom-item ${active}" onclick="App.navigate('${item.id}')">
          <span class="nav-bottom-icon">${item.icon}</span>
          <span>${item.label}</span>
        </button>
      `;
      })
      .join('');

    const html = `
      <div class="app-shell">
        <!-- Collapsible Desktop Sidebar -->
        <aside class="nav-sidebar" id="sidebar">
          <div class="sidebar-header">
            <div class="sidebar-logo-icon">OD</div>
            <div>
              <div class="sidebar-brand-name">Office Desk</div>
              <div class="sidebar-brand-sub">${settings.companyName || 'Shah Digital Marketing'}</div>
            </div>
          </div>

          <div class="sidebar-nav">
            ${sidebarLinksHTML}
          </div>

          <div class="sidebar-footer">
            <div class="user-profile-badge" onclick="Auth.openRoleSwitcherModal()">
              <div class="avatar avatar-sm">${user.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 700; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.name}</div>
                <span class="role-tag ${user.role}" style="font-size: 0.65rem;">${user.role}</span>
              </div>
              <span class="small text-muted" title="Switch Profile">🔄</span>
            </div>
            <button type="button" class="btn btn-outline btn-sm" onclick="Auth.logout()" style="margin-top: 10px; width: 100%; border-color: rgba(239,68,68,0.4); color: #FCA5A5;">
              🚪 Sign Out
            </button>
          </div>
        </aside>

        <!-- Main Wrapper -->
        <div class="main-wrapper">
          <!-- Top Bar -->
          <header class="top-bar">
            <div class="top-bar-left">
              <button type="button" class="mobile-menu-btn" onclick="App.toggleSidebar()">☰</button>
              <div style="font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; color: var(--text-main);">
                ${settings.companyName || 'Office Desk'}
              </div>
            </div>

            <div class="top-bar-right">
              <!-- Quick Role Switcher Button -->
              <button type="button" class="role-switch-btn" onclick="Auth.openRoleSwitcherModal()" title="Switch User Role">
                <span class="role-tag ${user.role}" style="margin: 0; padding: 2px 8px;">${user.role.toUpperCase()}</span>
                <span class="small font-semibold">${user.name.split(' ')[0]}</span>
                <span style="font-size: 0.75rem;">▼</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="Auth.logout()" title="Sign Out" style="padding: 6px 12px;">
                🚪 Logout
              </button>
            </div>
          </header>

          <!-- Dynamic View Container -->
          <main class="page-container" id="page-content">
            <div style="text-align: center; padding: 40px;" class="text-muted">Loading dashboard...</div>
          </main>
        </div>

        <!-- Mobile Bottom Navigation Bar -->
        <nav class="nav-bottom-bar" id="mobile-nav">
          ${bottomBarHTML}
        </nav>
      </div>
    `;

    document.getElementById('app').innerHTML = html;
  }

  function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.toggle('open');
  }

  // Main View Router (with Privacy Checks)
  async function navigate(viewName, params = {}) {
    const user = Auth.getCurrentUser();
    if (!user) {
      document.getElementById('app').innerHTML = Auth.renderLoginScreen();
      return;
    }

    // Role-based privacy protection
    if ((viewName === 'payroll' || viewName === 'staff' || viewName === 'settings') && !Auth.isAdmin()) {
      toast('🔒 Privacy Protection: Access restricted to Administrators.', 'danger');
      viewName = 'dashboard';
    }

    _currentView = viewName;
    renderShell();

    // Close mobile sidebar if open
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.remove('open');

    // Stop active camera stream when leaving punch view
    if (viewName !== 'punch') {
      Camera.stop();
    }

    const container = document.getElementById('page-content');
    if (!container) return;

    const user = Auth.getCurrentUser();

    switch (viewName) {
      case 'dashboard':
        container.innerHTML = await renderDashboardView();
        break;

      case 'punch':
        container.innerHTML = await Attendance.renderPunchView();
        // Initialize punch features
        Attendance.initLocationBadge();
        const todayRec = await Attendance.getTodayRecord(user.id);
        if (todayRec && todayRec.punchIn && !todayRec.punchOut) {
          const timerEl = document.getElementById('active-work-timer');
          if (timerEl) Attendance.startLiveTimer(todayRec.punchIn, timerEl);
        }
        break;

      case 'attendance':
        container.innerHTML = await Attendance.renderCalendarView(params.year, params.month);
        break;

      case 'leaves':
        container.innerHTML = await Leaves.renderLeavesView();
        break;

      case 'tasks':
        container.innerHTML = await Tasks.renderTasksView();
        break;

      case 'payroll':
        if (!Auth.isAdmin()) {
          toast('Payroll oversight is restricted to Administrators.', 'warning');
          navigate('dashboard');
          return;
        }
        container.innerHTML = await Payroll.renderPayrollAdminView(params.year, params.month);
        break;

      case 'payslip':
        container.innerHTML = await Payroll.renderStaffPayslipView();
        break;

      case 'staff':
        if (!Auth.isAdmin()) {
          toast('Staff administration is restricted to Administrators.', 'warning');
          navigate('dashboard');
          return;
        }
        container.innerHTML = await AdminSettings.renderStaffView();
        break;

      case 'settings':
        if (!Auth.isAdmin()) {
          toast('System settings are restricted to Administrators.', 'warning');
          navigate('dashboard');
          return;
        }
        container.innerHTML = await AdminSettings.renderSettingsView();
        break;

      default:
        container.innerHTML = await renderDashboardView();
        break;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Render Role-Specific Dashboard
  async function renderDashboardView() {
    const user = Auth.getCurrentUser();
    const settings = AdminSettings.getSettings();
    const allUsers = await DB.getAll('users');
    const now = new Date();

    const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

    // ── ADMIN DASHBOARD ──
    if (user.role === 'admin') {
      const activeStaff = allUsers.filter((u) => u.status === 'active');
      const allAtt = await DB.getAll('attendance');
      const todayDs = new Date().toISOString().split('T')[0];
      const todayRecords = allAtt.filter((a) => a.date === todayDs);

      const presentCount = todayRecords.filter((a) => a.status === 'present').length;
      const lateCount = todayRecords.filter((a) => a.status === 'late').length;
      const halfDayCount = todayRecords.filter((a) => a.status === 'half-day').length;
      const absentCount = Math.max(0, activeStaff.length - (presentCount + lateCount + halfDayCount));

      const allLeaves = await DB.getAll('leaves');
      const pendingLeaves = allLeaves.filter((l) => l.status === 'pending');

      const allTasks = await DB.getAll('tasks');
      const openTasks = allTasks.filter((t) => t.status !== 'done');

      return `
        <div class="card-header">
          <div>
            <h1>🛡️ Admin Dashboard</h1>
            <p class="small text-muted">${greeting}, ${user.name}! Full organization attendance, payroll, and staff overview.</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('punch')">Punch My Attendance</button>
        </div>

        <!-- Live Presence Metrics -->
        <div class="stats-grid">
          <div class="stat-card blue">
            <div class="stat-value">${activeStaff.length}</div>
            <div class="stat-label">Total Active Staff</div>
          </div>
          <div class="stat-card green">
            <div class="stat-value">${presentCount}</div>
            <div class="stat-label">Present Today (On Time)</div>
          </div>
          <div class="stat-card orange">
            <div class="stat-value">${lateCount}</div>
            <div class="stat-label">Late Arrivals Today</div>
          </div>
          <div class="stat-card red">
            <div class="stat-value">${absentCount}</div>
            <div class="stat-label">Unaccounted / Absent</div>
          </div>
        </div>

        <!-- Quick Action Shortcuts -->
        <div class="card" style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9));">
          <div class="card-header">
            <h3 class="card-title">⚡ Admin Quick Controls</h3>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="App.navigate('settings')">⚙️ Edit Office Timings & Rules</button>
            <button class="btn btn-secondary" onclick="App.navigate('staff')">👥 Manage Staff & Salaries</button>
            <button class="btn btn-secondary" onclick="App.navigate('payroll')">💰 Run Monthly Payroll</button>
            <button class="btn btn-secondary" onclick="App.navigate('leaves')">🌴 Leave Approvals (${pendingLeaves.length})</button>
            <button class="btn btn-secondary" onclick="App.navigate('tasks')">📋 Kanban Board (${openTasks.length})</button>
          </div>
        </div>

        <!-- Today's Live Attendance Punch Log -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">🕒 Today's Live Punch Log (${todayDs})</h3>
            <span class="small text-muted">Auto-Watermarked with Date, Time & GPS</span>
          </div>

          ${
            todayRecords.length === 0
              ? '<p class="small text-muted">No punch-ins logged yet today.</p>'
              : `
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Status</th>
                    <th>Punch In</th>
                    <th>Punch Out</th>
                    <th>Hours</th>
                    <th>Mode</th>
                    <th>Location / Selfie</th>
                  </tr>
                </thead>
                <tbody>
                  ${todayRecords
                    .map((r) => {
                      const emp = allUsers.find((u) => u.id === r.userId) || { name: 'Staff' };
                      const badgeClass =
                        r.status === 'present'
                          ? 'badge-present'
                          : r.status === 'late'
                          ? 'badge-late'
                          : r.status === 'half-day'
                          ? 'badge-half'
                          : 'badge-absent';
                      return `
                      <tr>
                        <td>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="avatar avatar-sm">${emp.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div>
                            <div>
                              <strong>${emp.name}</strong>
                              <div class="small text-dim">${emp.designation}</div>
                            </div>
                          </div>
                        </td>
                        <td><span class="badge ${badgeClass}">${r.status.toUpperCase()}</span></td>
                        <td class="mono font-semibold">${r.punchIn || '—'}</td>
                        <td class="mono">${r.punchOut || 'Working...'}</td>
                        <td class="mono font-semibold">${r.hoursWorked ? r.hoursWorked + ' h' : '—'}</td>
                        <td><span class="role-tag staff">${r.workMode || 'office'}</span></td>
                        <td>
                          <div class="small text-muted" style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${r.location?.address || 'Office'}
                          </div>
                          ${
                            r.selfieIn
                              ? `<button class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 0.7rem; margin-top: 3px;" onclick="App.openModal('<div style=\\'text-align:center;\\'><img src=\\'${r.selfieIn}\\' style=\\'max-width:100%; border-radius:12px;\\'></div>')">🔍 View Selfie</button>`
                              : ''
                          }
                        </td>
                      </tr>
                    `;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          }
        </div>
      `;
    }

    // ── MANAGER DASHBOARD ──
    else if (user.role === 'manager') {
      const team = allUsers.filter((u) => u.managerId === user.id);
      const teamAtt = await Attendance.getTeamAttendanceToday(user.id);
      const allLeaves = await DB.getAll('leaves');
      const teamPendingLeaves = allLeaves.filter((l) => l.status === 'pending' && l.managerId === user.id);

      const allTasks = await DB.getAll('tasks');
      const teamTasks = allTasks.filter((t) => team.some((member) => member.id === t.assignedTo));

      const myTodayRec = await Attendance.getTodayRecord(user.id);

      return `
        <div class="card-header">
          <div>
            <h1>💼 Manager Dashboard</h1>
            <p class="small text-muted">${greeting}, ${user.name}! Supervising ${user.department} team.</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('punch')">Punch My Attendance</button>
        </div>

        <!-- Manager Quick Metrics -->
        <div class="stats-grid">
          <div class="stat-card blue">
            <div class="stat-value">${team.length}</div>
            <div class="stat-label">Team Members</div>
          </div>
          <div class="stat-card green">
            <div class="stat-value">${teamAtt.filter((t) => t.record && t.record.status === 'present').length}</div>
            <div class="stat-label">Present Today</div>
          </div>
          <div class="stat-card orange">
            <div class="stat-value">${teamPendingLeaves.length}</div>
            <div class="stat-label">Pending Leave Requests</div>
          </div>
          <div class="stat-card purple">
            <div class="stat-value">${teamTasks.filter((t) => t.status !== 'done').length}</div>
            <div class="stat-label">Active Team Tasks</div>
          </div>
        </div>

        <!-- Team Status Log Today -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">👥 Team Presence Today</h3>
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('tasks')">+ Delegate Task</button>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Team Member</th>
                  <th>Designation</th>
                  <th>Today Status</th>
                  <th>Punch In</th>
                  <th>Punch Out</th>
                  <th>Working Hours</th>
                </tr>
              </thead>
              <tbody>
                ${team
                  .map((m) => {
                    const rec = teamAtt.find((t) => t.user.id === m.id)?.record;
                    const status = rec ? rec.status : 'absent';
                    const badgeClass =
                      status === 'present'
                        ? 'badge-present'
                        : status === 'late'
                        ? 'badge-late'
                        : status === 'half-day'
                        ? 'badge-half'
                        : 'badge-absent';
                    return `
                    <tr>
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <div class="avatar avatar-sm">${m.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div>
                          <strong>${m.name}</strong>
                        </div>
                      </td>
                      <td class="small text-dim">${m.designation}</td>
                      <td><span class="badge ${badgeClass}">${status.toUpperCase()}</span></td>
                      <td class="mono font-semibold">${rec?.punchIn || '—'}</td>
                      <td class="mono">${rec?.punchOut || (rec?.punchIn ? 'Working...' : '—')}</td>
                      <td class="mono">${rec?.hoursWorked ? rec.hoursWorked + ' h' : '—'}</td>
                    </tr>
                  `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // ── STAFF DASHBOARD ──
    else {
      const todayRec = await Attendance.getTodayRecord(user.id);
      const summary = await Attendance.getMonthlySummary(user.id, now.getFullYear(), now.getMonth() + 1);
      const allTasks = await DB.getAll('tasks');
      const myTasks = allTasks.filter((t) => t.assignedTo === user.id && t.status !== 'done');
      const bal = user.leavesBalance || { casual: 12, sick: 10, paid: 14 };

      const isPunchedIn = todayRec && todayRec.punchIn;
      const isPunchedOut = todayRec && todayRec.punchOut;

      return `
        <div class="card-header">
          <div>
            <h1>👋 Hello, ${user.name.split(' ')[0]}!</h1>
            <p class="small text-muted">${greeting}! Here is your personal workforce summary for today.</p>
          </div>
        </div>

        <!-- Attendance Punch Card Hero -->
        <div class="card punch-card" style="border: 2px solid var(--surface-border); background: linear-gradient(180deg, var(--surface), var(--bg-elevated));">
          <div class="punch-clock" id="dash-live-clock">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          <div class="punch-date">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>

          ${
            isPunchedIn && !isPunchedOut
              ? `
            <div class="punch-timer-box" style="max-width: 380px; margin: 0 auto 16px;">
              <div>
                <span class="small text-muted" style="display: block;">Punched In at <strong>${todayRec.punchIn}</strong></span>
                <span class="badge ${todayRec.status === 'late' ? 'badge-late' : 'badge-present'}">${todayRec.status.toUpperCase()}</span>
              </div>
              <div style="text-align: right;">
                <span class="small text-muted" style="display: block;">Elapsed Work Time</span>
                <span class="live-timer-val" id="dash-live-timer">00:00:00</span>
              </div>
            </div>
            <button class="btn btn-danger punch-action-btn" onclick="App.navigate('punch')">
              📸 Punch Out with Selfie
            </button>
          `
              : !isPunchedIn
              ? `
            <p class="small text-muted" style="margin-bottom: 14px;">Office Start: <strong>${settings.officeStartTime || '09:00'}</strong> (Grace: ${settings.graceMinutes || 15} mins)</p>
            <button class="btn btn-success punch-action-btn" onclick="App.navigate('punch')">
              📸 Punch In with Selfie
            </button>
          `
              : `
            <div class="badge badge-present" style="font-size: 0.95rem; padding: 8px 16px; margin-bottom: 10px;">
              ✅ You have completed work today (${todayRec.hoursWorked} hrs)
            </div>
            <div class="small text-muted">In: ${todayRec.punchIn} | Out: ${todayRec.punchOut}</div>
          `
          }
        </div>

        <!-- Personal Quick Metrics -->
        <div class="stats-grid">
          <div class="stat-card green">
            <div class="stat-value">${summary.presentDays}</div>
            <div class="stat-label">Present Days (${now.toLocaleString('default', { month: 'short' })})</div>
          </div>
          <div class="stat-card orange">
            <div class="stat-value">${summary.lateMarks}</div>
            <div class="stat-label">Late Marks</div>
          </div>
          <div class="stat-card cyan">
            <div class="stat-value">${bal.casual + bal.sick + bal.paid}</div>
            <div class="stat-label">Total Leave Balance</div>
          </div>
          <div class="stat-card blue">
            <div class="stat-value">${myTasks.length}</div>
            <div class="stat-label">Pending Tasks</div>
          </div>
        </div>

        <!-- Quick Links: Salary Slip & Tasks -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 10px;">
          <div class="card" style="cursor: pointer;" onclick="App.navigate('payslip')">
            <div style="font-size: 1.8rem; margin-bottom: 8px;">🧾</div>
            <h4>My Salary Slip</h4>
            <p class="small text-muted">View and download your monthly salary slip voucher with full breakdown.</p>
          </div>
          <div class="card" style="cursor: pointer;" onclick="App.navigate('leaves')">
            <div style="font-size: 1.8rem; margin-bottom: 8px;">🌴</div>
            <h4>Request Leave</h4>
            <p class="small text-muted">Submit a new leave application or check approval status.</p>
          </div>
        </div>
      `;
    }
  }

  // App Bootstrap
  async function init() {
    await DB.init();
    await AdminSettings.loadSettings();
    const user = await Auth.init();

    // Listen for role/user changes to re-render dynamically
    document.addEventListener('auth:changed', (e) => {
      if (e.detail) {
        navigate('dashboard');
      } else {
        document.getElementById('app').innerHTML = Auth.renderLoginScreen();
      }
    });

    document.addEventListener('settings:updated', () => {
      if (Auth.getCurrentUser()) {
        navigate(_currentView);
      }
    });

    // Start live clock updates
    setInterval(() => {
      const clock1 = document.getElementById('dash-live-clock');
      const clock2 = document.getElementById('live-punch-clock');
      const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (clock1) clock1.textContent = timeStr;
      if (clock2) clock2.textContent = timeStr;
    }, 1000);

    // Initial navigation
    if (user) {
      navigate('dashboard');
    } else {
      document.getElementById('app').innerHTML = Auth.renderLoginScreen();
    }

    // Register service worker for installable PWA (only when served via HTTP/HTTPS)
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker
        .register('sw.js')
        .then(() => console.log('✅ Office Desk Service Worker registered successfully.'))
        .catch((err) => console.warn('Service worker registration failed:', err));
    }
  }

  return {
    init,
    navigate,
    renderShell,
    openModal,
    closeModal,
    toast,
    toggleSidebar,
    playPunchSound
  };
})();

// Start App when DOM is ready (or immediately if already parsed)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}

