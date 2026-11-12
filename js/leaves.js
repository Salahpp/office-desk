/* ============================================================
   Office Desk — Leave Requests & Approvals Engine (leaves.js)
   Leave Applications, Balances, & Manager/Admin Approval Workflow
   ============================================================ */

window.Leaves = (function () {
  async function applyLeave(userId, formData) {
    const from = formData.fromDate;
    const to = formData.toDate;
    if (!from || !to) throw new Error('Please select both start and end dates.');
    if (to < from) throw new Error('End date cannot be earlier than start date.');

    // Calculate working days
    const d1 = new Date(from);
    const d2 = new Date(to);
    let count = 0;
    const cur = new Date(d1);
    while (cur <= d2) {
      if (cur.getDay() !== 0) count++; // exclude Sunday
      cur.setDate(cur.getDate() + 1);
    }
    const days = Math.max(1, count);

    const user = await DB.get('users', userId);
    const leaveType = formData.type || 'casual';

    // Check balance if not unpaid
    if (leaveType !== 'unpaid') {
      const bal = user.leavesBalance?.[leaveType] ?? 0;
      if (days > bal) {
        throw new Error(`Insufficient ${leaveType} leave balance (Available: ${bal} days, Requested: ${days} days).`);
      }
    }

    const leaveObj = {
      id: 'lv_' + Date.now().toString(36),
      userId,
      type: leaveType,
      fromDate: from,
      toDate: to,
      days,
      reason: formData.reason || 'Personal commitment',
      status: 'pending',
      managerId: user.managerId || 'u1',
      managerComment: '',
      appliedAt: new Date().toISOString()
    };

    await DB.put('leaves', leaveObj);
    return leaveObj;
  }

  async function approveLeave(leaveId, reviewerComment) {
    const leave = await DB.get('leaves', leaveId);
    if (!leave) throw new Error('Leave request not found.');

    leave.status = 'approved';
    leave.managerComment = reviewerComment || 'Approved.';
    leave.reviewedAt = new Date().toISOString();
    await DB.put('leaves', leave);

    // Deduct leave balance
    const user = await DB.get('users', leave.userId);
    if (user && leave.type !== 'unpaid' && user.leavesBalance) {
      user.leavesBalance[leave.type] = Math.max(0, (user.leavesBalance[leave.type] || 0) - leave.days);
      await DB.put('users', user);
    }

    // Add attendance leave marks for date range
    const d1 = new Date(leave.fromDate);
    const d2 = new Date(leave.toDate);
    const cur = new Date(d1);
    while (cur <= d2) {
      if (cur.getDay() !== 0) {
        const ds = cur.toISOString().split('T')[0];
        await DB.put('attendance', {
          id: `att_${leave.userId}_${ds}`,
          userId: leave.userId,
          date: ds,
          punchIn: null,
          punchOut: null,
          status: 'leave',
          workMode: 'office',
          hoursWorked: 0,
          lateMinutes: 0,
          location: { address: `Approved Leave (${leave.type})` }
        });
      }
      cur.setDate(cur.getDate() + 1);
    }

    return leave;
  }

  async function rejectLeave(leaveId, reviewerComment) {
    const leave = await DB.get('leaves', leaveId);
    if (!leave) throw new Error('Leave request not found.');

    leave.status = 'rejected';
    leave.managerComment = reviewerComment || 'Rejected due to business requirements.';
    leave.reviewedAt = new Date().toISOString();
    await DB.put('leaves', leave);
    return leave;
  }

  // Render Leave Management View
  async function renderLeavesView() {
    const user = Auth.getCurrentUser();
    const isMgr = Auth.isManager();
    const isAdmin = Auth.isAdmin();

    const allLeaves = await DB.getAll('leaves');
    const allUsers = await DB.getAll('users');

    // Filter leaves for this user
    const myLeaves = allLeaves.filter((l) => l.userId === user.id).sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));

    // Filter leaves pending approval by this manager
    const pendingForMe = allLeaves.filter((l) => {
      if (l.status !== 'pending') return false;
      if (isAdmin) return true;
      return l.managerId === user.id;
    });

    const bal = user.leavesBalance || { casual: 12, sick: 10, paid: 14 };

    return `
      <div class="card-header">
        <div>
          <h2>🌴 Leave Applications & Approvals</h2>
          <p class="small text-muted">Submit leave requests, check your annual balance, and review team requests.</p>
        </div>
        <button class="btn btn-primary" onclick="Leaves.openApplyModal()">+ Apply for Leave</button>
      </div>

      <!-- Leave Balances -->
      <div class="stats-grid">
        <div class="stat-card blue">
          <div class="stat-value">${bal.casual ?? 12}</div>
          <div class="stat-label">Casual Leaves Left</div>
        </div>
        <div class="stat-card cyan">
          <div class="stat-value">${bal.sick ?? 10}</div>
          <div class="stat-label">Sick Leaves Left</div>
        </div>
        <div class="stat-card green">
          <div class="stat-value">${bal.paid ?? 14}</div>
          <div class="stat-label">Paid / Annual Left</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-value">${myLeaves.filter((l) => l.status === 'pending').length}</div>
          <div class="stat-label">Pending Approval</div>
        </div>
      </div>

      <!-- Manager / Admin Approval Queue -->
      ${
        isMgr && pendingForMe.length > 0
          ? `
        <div class="card" style="border-left: 4px solid var(--warning);">
          <div class="card-header">
            <h3 class="card-title text-warning">⏳ Pending Team Approvals (${pendingForMe.length})</h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${pendingForMe
              .map((l) => {
                const requester = allUsers.find((u) => u.id === l.userId) || { name: 'Staff' };
                return `
                <div class="card" style="background: var(--bg); margin-bottom: 0;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <div class="avatar avatar-sm">${requester.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div>
                      <div>
                        <strong>${requester.name}</strong> <span class="small text-dim">(${requester.designation})</span>
                        <div class="small text-muted">Applied on ${new Date(l.appliedAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <span class="badge badge-late">${l.days} day(s) ${l.type.toUpperCase()}</span>
                  </div>

                  <div style="margin: 10px 0; font-size: 0.88rem; background: var(--surface); padding: 8px 12px; border-radius: 8px;">
                    <div><strong>Duration:</strong> ${l.fromDate} to ${l.toDate}</div>
                    <div class="text-muted"><strong>Reason:</strong> ${l.reason || '—'}</div>
                  </div>

                  <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="btn btn-danger btn-sm" onclick="Leaves.handleReview('${l.id}', 'reject')">Reject</button>
                    <button class="btn btn-success btn-sm" onclick="Leaves.handleReview('${l.id}', 'approve')">Approve Leave</button>
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>
      `
          : ''
      }

      <!-- My Leave Requests History -->
      <div class="card">
        <h3 style="margin-bottom: 14px;">📋 My Leave Request History</h3>
        ${
          myLeaves.length === 0
            ? '<p class="small text-muted">You have not submitted any leave requests yet.</p>'
            : `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Manager Comment</th>
                </tr>
              </thead>
              <tbody>
                ${myLeaves
                  .map((l) => {
                    const statusBadge =
                      l.status === 'approved'
                        ? 'badge-present'
                        : l.status === 'rejected'
                        ? 'badge-absent'
                        : 'badge-late';
                    return `
                    <tr>
                      <td><strong>${l.fromDate}</strong> to <strong>${l.toDate}</strong></td>
                      <td>${l.days} d</td>
                      <td><span class="role-tag staff">${l.type}</span></td>
                      <td class="small text-muted">${l.reason}</td>
                      <td><span class="badge ${statusBadge}">${l.status.toUpperCase()}</span></td>
                      <td class="small text-dim">${l.managerComment || '—'}</td>
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

  // Open Leave Application Modal
  function openApplyModal() {
    const today = new Date().toISOString().split('T')[0];

    const html = `
      <div class="modal-header">
        <h3 class="card-title">📝 Apply for Leave</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>

      <form onsubmit="Leaves.handleSubmitApply(event)">
        <div class="form-group">
          <label class="form-label">Leave Category</label>
          <select name="type" class="form-select">
            <option value="casual">Casual Leave</option>
            <option value="sick">Sick / Medical Leave</option>
            <option value="paid">Paid Annual Leave</option>
            <option value="unpaid">Unpaid Leave</option>
          </select>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input type="date" name="fromDate" class="form-control" value="${today}" required>
          </div>
          <div class="form-group">
            <label class="form-label">End Date</label>
            <input type="date" name="toDate" class="form-control" value="${today}" required>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Reason for Absence</label>
          <textarea name="reason" class="form-control" rows="3" placeholder="Provide detailed explanation..." required></textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px;">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Submit Application</button>
        </div>
      </form>
    `;

    App.openModal(html);
  }

  async function handleSubmitApply(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const user = Auth.getCurrentUser();

    try {
      await applyLeave(user.id, {
        type: fd.get('type'),
        fromDate: fd.get('fromDate'),
        toDate: fd.get('toDate'),
        reason: fd.get('reason').trim()
      });
      App.closeModal();
      App.toast('Leave application submitted successfully! ✅', 'success');
      App.navigate('leaves');
    } catch (err) {
      App.toast(err.message, 'danger');
    }
  }

  async function handleReview(leaveId, action) {
    try {
      if (action === 'approve') {
        await approveLeave(leaveId, 'Approved by Manager.');
        App.toast('Leave approved! Attendance records updated. ✅', 'success');
      } else {
        await rejectLeave(leaveId, 'Declined due to work schedule.');
        App.toast('Leave request rejected.', 'info');
      }
      App.navigate('leaves');
    } catch (e) {
      App.toast(e.message, 'danger');
    }
  }

  return {
    applyLeave,
    approveLeave,
    rejectLeave,
    renderLeavesView,
    openApplyModal,
    handleSubmitApply,
    handleReview
  };
})();
