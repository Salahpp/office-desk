/* ============================================================
   Office Desk — Admin Settings & Staff Management (admin-settings.js)
   Fully Admin-Editable: Office Working Hours, Date/Time rules,
   Attendance parameters, Payroll rules, and Staff CRUD
   ============================================================ */

window.AdminSettings = (function () {
  let _settings = {};

  async function loadSettings() {
    const list = await DB.getAll('settings');
    const obj = { ...DB.DEFAULT_SETTINGS };
    list.forEach((item) => {
      obj[item.key] = item.value;
    });
    _settings = obj;
    return _settings;
  }

  function getSettings() {
    return _settings;
  }

  async function saveSetting(key, value) {
    _settings[key] = value;
    await DB.put('settings', { key, value });
    document.dispatchEvent(new CustomEvent('settings:updated', { detail: { key, value } }));
    return true;
  }

  async function saveAllSettings(formObj) {
    for (const [k, v] of Object.entries(formObj)) {
      _settings[k] = v;
      await DB.put('settings', { key: k, value: v });
    }
    document.dispatchEvent(new CustomEvent('settings:updated', { detail: _settings }));
    return true;
  }

  // Render Admin Settings View
  async function renderSettingsView() {
    const s = await loadSettings();

    return `
      <div class="card-header">
        <div>
          <h2>⚙️ Admin System Settings</h2>
          <p class="small text-muted">Configure company profile, office working hours, late penalty thresholds, and payroll parameters.</p>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-bottom: 14px; color: var(--primary-light);">🏢 Company Profile</h3>
        <form id="settings-company-form" onsubmit="AdminSettings.handleSaveCompany(event)">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Company Name</label>
              <input type="text" name="companyName" class="form-control" value="${s.companyName || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Currency Symbol / Code</label>
              <input type="text" name="currency" class="form-control" value="${s.currency || 'PKR'}" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Office Contact Phone</label>
              <input type="text" name="companyPhone" class="form-control" value="${s.companyPhone || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Office Contact Email</label>
              <input type="email" name="companyEmail" class="form-control" value="${s.companyEmail || ''}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Company Office Address</label>
            <textarea name="companyAddress" class="form-control" rows="2">${s.companyAddress || ''}</textarea>
          </div>

          <div style="text-align: right;">
            <button type="submit" class="btn btn-primary">Save Company Info</button>
          </div>
        </form>
      </div>

      <div class="card" style="border-left: 4px solid var(--accent);">
        <h3 style="margin-bottom: 14px; color: var(--accent);">⏰ Office Working Hours & Timings (Admin Editable)</h3>
        <form id="settings-hours-form" onsubmit="AdminSettings.handleSaveHours(event)">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Office Start Time</label>
              <input type="time" name="officeStartTime" class="form-control" value="${s.officeStartTime || '09:00'}" required>
              <span class="small text-dim">Official office opening time</span>
            </div>
            <div class="form-group">
              <label class="form-label">Office Closing / End Time</label>
              <input type="time" name="officeEndTime" class="form-control" value="${s.officeEndTime || '18:00'}" required>
              <span class="small text-dim">Official workday end time</span>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Grace Period (Minutes)</label>
              <input type="number" min="0" max="60" name="graceMinutes" class="form-control" value="${s.graceMinutes ?? 15}" required>
              <span class="small text-dim">Allowed delay before punching is flagged as Late</span>
            </div>
            <div class="form-group">
              <label class="form-label">Minimum Hours for Half Day</label>
              <input type="number" step="0.5" min="1" max="12" name="halfDayHours" class="form-control" value="${s.halfDayHours ?? 4}" required>
              <span class="small text-dim">If worked less than this, marked as half-day</span>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Late Marks Threshold (Per Month)</label>
              <input type="number" min="1" max="10" name="lateMarkLimit" class="form-control" value="${s.lateMarkLimit ?? 3}" required>
              <span class="small text-dim">e.g. 3 late arrivals trigger salary deduction</span>
            </div>
            <div class="form-group">
              <label class="form-label">Late Penalty Deduction (Days)</label>
              <input type="number" step="0.25" min="0" max="5" name="latePenaltyDays" class="form-control" value="${s.latePenaltyDays ?? 0.5}" required>
              <span class="small text-dim">Number of days salary deducted per late threshold</span>
            </div>
          </div>

          <div style="text-align: right; margin-top: 10px;">
            <button type="submit" class="btn btn-success">Update Working Hours & Rules</button>
          </div>
        </form>
      </div>

      <div class="card">
        <h3 style="margin-bottom: 14px; color: var(--warning);">🌴 Leave Policy & Payroll Settings</h3>
        <form id="settings-leave-payroll-form" onsubmit="AdminSettings.handleSaveLeavePayroll(event)">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Annual Casual Leaves</label>
              <input type="number" min="0" name="casualLeave" class="form-control" value="${s.casualLeave ?? 12}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Annual Sick Leaves</label>
              <input type="number" min="0" name="sickLeave" class="form-control" value="${s.sickLeave ?? 10}" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Annual Paid / Earned Leaves</label>
              <input type="number" min="0" name="paidLeave" class="form-control" value="${s.paidLeave ?? 14}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Working Days Per Month (Payroll Divisor)</label>
              <input type="number" min="20" max="31" name="workingDaysPerMonth" class="form-control" value="${s.workingDaysPerMonth ?? 26}" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Provident Fund (PF) Employee %</label>
              <input type="number" step="0.5" min="0" max="20" name="pfPercentage" class="form-control" value="${s.pfPercentage ?? 5}">
            </div>
            <div class="form-group">
              <label class="form-label">Overtime Rate Multiplier</label>
              <input type="number" step="0.1" min="1" max="3" name="overtimeRate" class="form-control" value="${s.overtimeRate ?? 1.5}">
            </div>
          </div>

          <div style="text-align: right; margin-top: 10px;">
            <button type="submit" class="btn btn-primary">Save Leave & Payroll Rules</button>
          </div>
        </form>
      </div>
    `;
  }

  // Handlers for settings forms
  async function handleSaveCompany(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const updates = {
      companyName: fd.get('companyName').trim(),
      currency: fd.get('currency').trim().toUpperCase(),
      companyPhone: fd.get('companyPhone').trim(),
      companyEmail: fd.get('companyEmail').trim(),
      companyAddress: fd.get('companyAddress').trim()
    };
    await saveAllSettings(updates);
    App.toast('Company profile saved successfully! ✅', 'success');
  }

  async function handleSaveHours(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const updates = {
      officeStartTime: fd.get('officeStartTime'),
      officeEndTime: fd.get('officeEndTime'),
      graceMinutes: parseInt(fd.get('graceMinutes'), 10),
      halfDayHours: parseFloat(fd.get('halfDayHours')),
      lateMarkLimit: parseInt(fd.get('lateMarkLimit'), 10),
      latePenaltyDays: parseFloat(fd.get('latePenaltyDays'))
    };
    await saveAllSettings(updates);
    App.toast('Office working hours & rules updated! ✅', 'success');
  }

  async function handleSaveLeavePayroll(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const updates = {
      casualLeave: parseInt(fd.get('casualLeave'), 10),
      sickLeave: parseInt(fd.get('sickLeave'), 10),
      paidLeave: parseInt(fd.get('paidLeave'), 10),
      workingDaysPerMonth: parseInt(fd.get('workingDaysPerMonth'), 10),
      pfPercentage: parseFloat(fd.get('pfPercentage')),
      overtimeRate: parseFloat(fd.get('overtimeRate'))
    };
    await saveAllSettings(updates);
    App.toast('Leave & Payroll policy updated! ✅', 'success');
  }

  // Render Staff Management for Admin
  async function renderStaffView() {
    const users = await DB.getAll('users');
    const s = await loadSettings();

    return `
      <div class="card-header">
        <div>
          <h2>👥 Staff & Employee Management</h2>
          <p class="small text-muted">Manage employee records, salary breakdowns, roles, and designations.</p>
        </div>
        <button class="btn btn-success" onclick="AdminSettings.openStaffModal()">+ Add New Employee</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department & Role</th>
              <th>Status</th>
              <th>Basic Salary</th>
              <th>Total Gross</th>
              <th>Manager</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users
              .map((u) => {
                const totalGross = (u.salary?.basic || 0) + (u.salary?.hra || 0) + (u.salary?.conveyance || 0) + (u.salary?.specialAllowance || 0);
                const manager = users.find((m) => m.id === u.managerId);
                return `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <div class="avatar avatar-sm">${u.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div>
                      <div>
                        <strong>${u.name}</strong>
                        <div class="small text-dim">${u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>${u.designation}</div>
                    <span class="role-tag ${u.role}" style="font-size: 0.65rem;">${u.role}</span>
                  </td>
                  <td>
                    <span class="badge ${u.status === 'active' ? 'badge-present' : 'badge-absent'}">
                      ${u.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td class="mono font-semibold">${s.currency} ${(u.salary?.basic || 0).toLocaleString()}</td>
                  <td class="mono font-semibold" style="color: var(--accent);">${s.currency} ${totalGross.toLocaleString()}</td>
                  <td class="small text-muted">${manager ? manager.name : '—'}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="AdminSettings.openStaffModal('${u.id}')">Edit</button>
                  </td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Open modal to Add or Edit Staff Member
  async function openStaffModal(userId) {
    const users = await DB.getAll('users');
    const u = userId ? users.find((x) => x.id === userId) : null;
    const isNew = !u;

    const managers = users.filter((m) => m.role === 'manager' || m.role === 'admin');

    const html = `
      <div class="modal-header">
        <h3 class="card-title">${isNew ? '➕ Add New Employee' : '✏️ Edit Employee: ' + u.name}</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>

      <form onsubmit="AdminSettings.handleSaveStaff(event, '${userId || ''}')">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" name="name" class="form-control" value="${u?.name || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" name="email" class="form-control" value="${u?.email || ''}" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="text" name="phone" class="form-control" value="${u?.phone || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">System Role</label>
            <select name="role" class="form-select">
              <option value="staff" ${u?.role === 'staff' ? 'selected' : ''}>Staff</option>
              <option value="manager" ${u?.role === 'manager' ? 'selected' : ''}>Manager / Team Lead</option>
              <option value="admin" ${u?.role === 'admin' ? 'selected' : ''}>Admin (Full Access)</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Designation / Job Title</label>
            <input type="text" name="designation" class="form-control" value="${u?.designation || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Department</label>
            <input type="text" name="department" class="form-control" value="${u?.department || 'Digital Marketing'}" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Reports To (Manager)</label>
            <select name="managerId" class="form-select">
              <option value="">None / Top Level</option>
              ${managers.map((m) => `<option value="${m.id}" ${u?.managerId === m.id ? 'selected' : ''}>${m.name} (${m.designation})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Account Status</label>
            <select name="status" class="form-select">
              <option value="active" ${u?.status !== 'inactive' ? 'selected' : ''}>Active</option>
              <option value="inactive" ${u?.status === 'inactive' ? 'selected' : ''}>Inactive / Suspended</option>
            </select>
          </div>
        </div>

        <h4 style="margin: 14px 0 10px; color: var(--primary-light);">💰 Monthly Salary Breakdown (PKR)</h4>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Basic Salary</label>
            <input type="number" min="0" name="salary_basic" class="form-control" value="${u?.salary?.basic || 50000}" required>
          </div>
          <div class="form-group">
            <label class="form-label">House Rent Allowance (HRA)</label>
            <input type="number" min="0" name="salary_hra" class="form-control" value="${u?.salary?.hra || 8000}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Conveyance Allowance</label>
            <input type="number" min="0" name="salary_conveyance" class="form-control" value="${u?.salary?.conveyance || 3000}">
          </div>
          <div class="form-group">
            <label class="form-label">Special Allowance</label>
            <input type="number" min="0" name="salary_special" class="form-control" value="${u?.salary?.specialAllowance || 4000}">
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px;">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isNew ? 'Create Employee' : 'Save Changes'}</button>
        </div>
      </form>
    `;

    App.openModal(html);
  }

  // Handle saving new or edited staff
  async function handleSaveStaff(e, userId) {
    e.preventDefault();
    const fd = new FormData(e.target);

    const users = await DB.getAll('users');
    let userObj = userId ? users.find((x) => x.id === userId) : null;

    if (!userObj) {
      userObj = {
        id: 'u_' + Date.now().toString(36),
        pin: '1234',
        joinDate: new Date().toISOString().split('T')[0],
        leavesBalance: { casual: 12, sick: 10, paid: 14 }
      };
    }

    userObj.name = fd.get('name').trim();
    userObj.email = fd.get('email').trim();
    userObj.phone = fd.get('phone').trim();
    userObj.role = fd.get('role');
    userObj.designation = fd.get('designation').trim();
    userObj.department = fd.get('department').trim();
    userObj.managerId = fd.get('managerId') || null;
    userObj.status = fd.get('status');

    userObj.salary = {
      basic: parseInt(fd.get('salary_basic'), 10) || 0,
      hra: parseInt(fd.get('salary_hra'), 10) || 0,
      conveyance: parseInt(fd.get('salary_conveyance'), 10) || 0,
      specialAllowance: parseInt(fd.get('salary_special'), 10) || 0,
      bonus: userObj.salary?.bonus || 0
    };

    await DB.put('users', userObj);
    App.closeModal();
    App.toast(`Employee ${userObj.name} saved successfully! ✅`, 'success');
    App.navigate('staff');
  }

  return {
    loadSettings,
    getSettings,
    saveSetting,
    saveAllSettings,
    renderSettingsView,
    renderStaffView,
    openStaffModal,
    handleSaveCompany,
    handleSaveHours,
    handleSaveLeavePayroll,
    handleSaveStaff
  };
})();
