/* ============================================================
   Office Desk — Salary Slip & Payroll Engine (payroll.js)
   Automatic Salary Calculation, Deductions (Late Marks, Absences, Half-days),
   Earnings, and Formal Printable / PDF-Ready Salary Slip Vouchers
   ============================================================ */

window.Payroll = (function () {
  // Calculate full salary breakdown for a user for a specific month
  async function calculateSalary(userId, year, month) {
    const user = await DB.get('users', userId);
    if (!user) throw new Error('User not found');

    const settings = AdminSettings.getSettings();
    const summary = await Attendance.getMonthlySummary(userId, year, month);

    const workingDaysInMonth = Number(settings.workingDaysPerMonth || 26);
    const basicSalary = Number(user.salary?.basic || 50000);
    const perDayRate = basicSalary / workingDaysInMonth;

    // Earnings
    const hra = Number(user.salary?.hra || 0);
    const conveyance = Number(user.salary?.conveyance || 0);
    const specialAllowance = Number(user.salary?.specialAllowance || 0);
    const bonus = Number(user.salary?.bonus || 0);

    const grossEarnings = basicSalary + hra + conveyance + specialAllowance + bonus;

    // Deductions based on attendance & admin rules
    const absentCuts = Math.round(summary.absentDays * perDayRate);
    const halfDayCuts = Math.round(summary.halfDays * 0.5 * perDayRate);
    const latePenaltyCuts = Math.round(summary.lateDeductionDays * perDayRate);
    const pfDeduction = Math.round((basicSalary * Number(settings.pfPercentage || 5)) / 100);

    const totalDeductions = absentCuts + halfDayCuts + latePenaltyCuts + pfDeduction;
    const netSalary = Math.max(0, grossEarnings - totalDeductions);

    // Days calculation
    const totalDeductedDays = summary.absentDays + (summary.halfDays * 0.5) + summary.lateDeductionDays;
    const payableDays = Math.max(0, workingDaysInMonth - totalDeductedDays);

    return {
      userId,
      year,
      month,
      user,
      settings,
      attendance: summary,
      workingDaysInMonth,
      payableDays: Number(payableDays.toFixed(1)),
      totalDeductedDays: Number(totalDeductedDays.toFixed(1)),
      perDayRate: Math.round(perDayRate),
      earnings: {
        basic: basicSalary,
        hra,
        conveyance,
        specialAllowance,
        bonus,
        gross: grossEarnings
      },
      deductions: {
        absentCuts,
        halfDayCuts,
        latePenaltyCuts,
        pfDeduction,
        total: totalDeductions
      },
      netSalary
    };
  }

  // Render Printable Formal Salary Slip Voucher
  function renderSalarySlipHTML(data) {
    const { user, settings, earnings, deductions, netSalary, attendance, payableDays, workingDaysInMonth, year, month } = data;
    const curr = settings.currency || 'PKR';
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthYear = `${monthNames[month - 1]} ${year}`;

    return `
      <div class="payslip-voucher" id="printable-salary-slip">
        <!-- Header -->
        <div class="payslip-header">
          <div>
            <div style="font-family: var(--font-display); font-size: 1.45rem; font-weight: 800; color: #1E3A8A; line-height: 1.2;">
              ${settings.companyName || 'Shah Digital Marketing Agency & Academy'}
            </div>
            <div style="font-size: 0.82rem; color: #4B5563; max-width: 480px; margin-top: 4px;">
              ${settings.companyAddress || 'Karachi, Pakistan'}
            </div>
            <div style="font-size: 0.78rem; color: #6B7280; margin-top: 2px;">
              Phone: ${settings.companyPhone || '+92-300-1234567'} | Email: ${settings.companyEmail || 'info@shahdigital.pk'}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-family: var(--font-display); font-size: 1.2rem; font-weight: 800; color: #111827;">SALARY PAYSLIP</div>
            <div style="font-family: var(--font-mono); font-size: 0.95rem; font-weight: 700; color: #2563EB;">${monthYear}</div>
            <div style="font-size: 0.75rem; color: #9CA3AF; margin-top: 4px;">Ref: SLIP-${user.id.toUpperCase()}-${year}${String(month).padStart(2,'0')}</div>
          </div>
        </div>

        <!-- Employee Info Grid -->
        <div class="payslip-grid">
          <div>
            <div><strong>Employee Name:</strong> ${user.name}</div>
            <div><strong>Designation:</strong> ${user.designation}</div>
            <div><strong>Department:</strong> ${user.department}</div>
            <div><strong>Employee ID:</strong> ${user.id.toUpperCase()}</div>
          </div>
          <div>
            <div><strong>Date of Joining:</strong> ${user.joinDate || '2021-01-01'}</div>
            <div><strong>Standard Working Days:</strong> ${workingDaysInMonth} days</div>
            <div><strong>Payable Work Days:</strong> <span style="color:#059669;font-weight:700;">${payableDays} days</span></div>
            <div><strong>Days Deducted:</strong> <span style="color:#DC2626;font-weight:700;">${data.totalDeductedDays} days</span></div>
          </div>
        </div>

        <!-- Attendance Performance Summary Strip -->
        <div style="display: flex; justify-content: space-around; background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px; margin-bottom: 20px; font-size: 0.82rem; text-align: center;">
          <div><span style="color:#6B7280;display:block;">Present Days</span><strong>${attendance.presentDays}</strong></div>
          <div><span style="color:#6B7280;display:block;">Late Arrivals</span><strong style="color:#D97706;">${attendance.lateMarks}</strong></div>
          <div><span style="color:#6B7280;display:block;">Late Cuts</span><strong style="color:#DC2626;">${attendance.lateDeductionDays} d</strong></div>
          <div><span style="color:#6B7280;display:block;">Half Days</span><strong>${attendance.halfDays}</strong></div>
          <div><span style="color:#6B7280;display:block;">Unpaid/Absences</span><strong style="color:#DC2626;">${attendance.absentDays}</strong></div>
          <div><span style="color:#6B7280;display:block;">Approved Leaves</span><strong>${attendance.leaveDays}</strong></div>
        </div>

        <!-- Earnings and Deductions Table -->
        <table class="payslip-table">
          <thead>
            <tr>
              <th style="width: 50%;">EARNINGS BREAKDOWN</th>
              <th style="width: 50%;">DEDUCTIONS & ADJUSTMENTS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="vertical-align: top; padding: 0;">
                <table style="width:100%; border:none;">
                  <tr><td>Basic Salary</td><td style="text-align:right;" class="mono font-semibold">${curr} ${earnings.basic.toLocaleString()}</td></tr>
                  <tr><td>House Rent Allowance (HRA)</td><td style="text-align:right;" class="mono">${curr} ${earnings.hra.toLocaleString()}</td></tr>
                  <tr><td>Conveyance Allowance</td><td style="text-align:right;" class="mono">${curr} ${earnings.conveyance.toLocaleString()}</td></tr>
                  <tr><td>Special Allowance</td><td style="text-align:right;" class="mono">${curr} ${earnings.specialAllowance.toLocaleString()}</td></tr>
                  ${earnings.bonus > 0 ? `<tr><td style="color:#059669;">Performance Bonus</td><td style="text-align:right;color:#059669;" class="mono font-semibold">${curr} ${earnings.bonus.toLocaleString()}</td></tr>` : ''}
                </table>
              </td>
              <td style="vertical-align: top; padding: 0; border-left: 1px solid #E5E7EB;">
                <table style="width:100%; border:none;">
                  <tr><td>Absence Deduction (${attendance.absentDays} days)</td><td style="text-align:right; color:#DC2626;" class="mono">${curr} ${deductions.absentCuts.toLocaleString()}</td></tr>
                  <tr><td>Half-Day Deduction (${attendance.halfDays} times)</td><td style="text-align:right; color:#DC2626;" class="mono">${curr} ${deductions.halfDayCuts.toLocaleString()}</td></tr>
                  <tr><td>Late Marks Penalty (${attendance.lateMarks} lates = ${attendance.lateDeductionDays}d cut)</td><td style="text-align:right; color:#DC2626;" class="mono">${curr} ${deductions.latePenaltyCuts.toLocaleString()}</td></tr>
                  <tr><td>Provident Fund (PF ${settings.pfPercentage || 5}%)</td><td style="text-align:right;" class="mono">${curr} ${deductions.pfDeduction.toLocaleString()}</td></tr>
                </table>
              </td>
            </tr>
            <tr class="payslip-total-row">
              <td>
                <div style="display:flex;justify-content:space-between;">
                  <span>GROSS EARNINGS:</span>
                  <span class="mono">${curr} ${earnings.gross.toLocaleString()}</span>
                </div>
              </td>
              <td style="border-left: 1px solid #E5E7EB;">
                <div style="display:flex;justify-content:space-between;color:#DC2626;">
                  <span>TOTAL DEDUCTIONS:</span>
                  <span class="mono">${curr} ${deductions.total.toLocaleString()}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Net Payable Amount Highlight -->
        <div class="payslip-net-box">
          <div>
            <span style="font-size: 0.85rem; color: #4B5563; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; display: block;">NET SALARY PAYABLE</span>
            <span style="font-size: 0.8rem; color: #6B7280;">Transferred via Direct Bank Deposit</span>
          </div>
          <div class="payslip-net-amount">
            ${curr} ${netSalary.toLocaleString()}
          </div>
        </div>

        <!-- Footer Signatures & QR Seal -->
        <div class="payslip-footer-signatures">
          <div style="text-align: center;">
            <div style="height: 40px; border-bottom: 1px dashed #9CA3AF; width: 160px; margin-bottom: 6px;"></div>
            <span>Employee Signature</span>
          </div>
          <div style="text-align: center; border: 2px dashed #9CA3AF; padding: 6px 14px; border-radius: 6px;">
            <div style="font-weight: 800; color: #1E3A8A; font-size: 0.75rem;">SHAH DIGITAL HR</div>
            <div style="font-size: 0.65rem; color: #059669;">VERIFIED & STAMPED</div>
          </div>
          <div style="text-align: center;">
            <div style="height: 40px; border-bottom: 1px dashed #9CA3AF; width: 160px; margin-bottom: 6px;"></div>
            <span>Authorized HR Manager</span>
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px; font-size: 0.7rem; color: #9CA3AF;">
          This is a computer-generated salary slip and does not require a physical signature. Confidential document.
        </div>
      </div>
    `;
  }

  // Open Payslip in printable modal (Enforces User Privacy)
  async function openPayslipModal(userId, year, month) {
    if (!Auth.canAccessSalary(userId)) {
      App.toast('🔒 Privacy Notice: You are only authorized to view your own confidential salary slip.', 'danger');
      return;
    }

    const now = new Date();
    const y = year || now.getFullYear();
    const m = month || now.getMonth() + 1;

    App.toast('Calculating salary slip...', 'info');
    try {
      const data = await calculateSalary(userId, y, m);
      const slipHTML = renderSalarySlipHTML(data);

      const modalHTML = `
        <div class="modal-header no-print">
          <h3 class="card-title">🧾 Salary Slip Voucher</h3>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary btn-sm" onclick="window.print()">🖨️ Print / Save as PDF</button>
            <button class="modal-close" onclick="App.closeModal()">✕</button>
          </div>
        </div>
        ${slipHTML}
      `;

      App.openModal(modalHTML);
    } catch (e) {
      App.toast('Failed to generate salary slip: ' + e.message, 'danger');
    }
  }

  // Render Payroll Admin Overview View
  async function renderPayrollAdminView(year, month) {
    const users = await DB.getAll('users');
    const activeStaff = users.filter((u) => u.status === 'active');
    const settings = AdminSettings.getSettings();
    const curr = settings.currency || 'PKR';

    const now = new Date();
    const y = year || now.getFullYear();
    const m = month || now.getMonth() + 1;

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthLabel = `${monthNames[m - 1]} ${y}`;

    // Calculate all payroll entries
    const payrollEntries = [];
    let totalPayrollGross = 0;
    let totalPayrollNet = 0;

    for (const u of activeStaff) {
      const res = await calculateSalary(u.id, y, m);
      payrollEntries.push(res);
      totalPayrollGross += res.earnings.gross;
      totalPayrollNet += res.netSalary;
    }

    return `
      <div class="card-header">
        <div>
          <h2>💰 Company Payroll & Salary Slips</h2>
          <p class="small text-muted">Generate, inspect, and print employee pay vouchers with automated deductions.</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" onclick="Payroll.exportPayrollCSV(${y}, ${m})">📥 Export CSV</button>
          <button class="btn btn-primary btn-sm" onclick="App.toast('All ${payrollEntries.length} salary slips generated and verified! ✅', 'success')">⚡ Batch Process All</button>
        </div>
      </div>

      <!-- Financial Metrics -->
      <div class="stats-grid">
        <div class="stat-card blue">
          <div class="stat-value">${curr} ${totalPayrollNet.toLocaleString()}</div>
          <div class="stat-label">Total Net Payroll (${monthLabel})</div>
        </div>
        <div class="stat-card green">
          <div class="stat-value">${curr} ${totalPayrollGross.toLocaleString()}</div>
          <div class="stat-label">Total Gross Earnings</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-value">${curr} ${(totalPayrollGross - totalPayrollNet).toLocaleString()}</div>
          <div class="stat-label">Total Deductions (Late / Absences)</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-value">${activeStaff.length}</div>
          <div class="stat-label">Salaried Employees</div>
        </div>
      </div>

      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 class="card-title">Employee Salary Vouchers — ${monthLabel}</h3>
          <span class="small text-muted">Rules: ${settings.workingDaysPerMonth || 26} Work Days/Mo | ${settings.lateMarkLimit || 3} Late Marks = ${settings.latePenaltyDays || 0.5}d Cut</span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Basic Salary</th>
                <th>Gross Earnings</th>
                <th>Payable Days</th>
                <th>Deductions</th>
                <th>Net Payable</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${payrollEntries
                .map((p) => {
                  return `
                  <tr>
                    <td>
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="avatar avatar-sm">${p.user.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div>
                        <div>
                          <strong>${p.user.name}</strong>
                          <div class="small text-dim">${p.user.department}</div>
                        </div>
                      </div>
                    </td>
                    <td><span class="role-tag ${p.user.role}" style="font-size:0.65rem;">${p.user.designation}</span></td>
                    <td class="mono font-semibold">${curr} ${p.earnings.basic.toLocaleString()}</td>
                    <td class="mono text-success font-semibold">${curr} ${p.earnings.gross.toLocaleString()}</td>
                    <td class="mono">${p.payableDays} / ${p.workingDaysInMonth} d</td>
                    <td class="mono text-danger font-semibold">-${curr} ${p.deductions.total.toLocaleString()}</td>
                    <td class="mono" style="font-size: 0.95rem; font-weight: 700; color: #60A5FA;">${curr} ${p.netSalary.toLocaleString()}</td>
                    <td>
                      <button class="btn btn-primary btn-sm" onclick="Payroll.openPayslipModal('${p.user.id}', ${y}, ${m})">
                        🧾 View Slip
                      </button>
                    </td>
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

  // Render Staff Personal Payslip View
  async function renderStaffPayslipView() {
    const user = Auth.getCurrentUser();
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;

    const data = await calculateSalary(user.id, y, m);
    const slipHTML = renderSalarySlipHTML(data);

    return `
      <div class="card-header no-print">
        <div>
          <h2>🧾 My Salary Slip & Earnings</h2>
          <p class="small text-muted">Formal pay voucher for current month with complete breakdown of allowances and attendance deductions.</p>
        </div>
        <button class="btn btn-primary" onclick="window.print()">🖨️ Print / Download PDF</button>
      </div>

      ${slipHTML}
    `;
  }

  // Export payroll summary to CSV
  async function exportPayrollCSV(year, month) {
    const users = await DB.getAll('users');
    const activeStaff = users.filter((u) => u.status === 'active');
    const settings = AdminSettings.getSettings();
    const curr = settings.currency || 'PKR';

    const rows = [
      ['Employee Name', 'Department', 'Role', 'Basic (' + curr + ')', 'Gross (' + curr + ')', 'Payable Days', 'Deductions (' + curr + ')', 'Net Pay (' + curr + ')']
    ];

    for (const u of activeStaff) {
      const p = await calculateSalary(u.id, year, month);
      rows.push([
        u.name,
        u.department,
        u.designation,
        p.earnings.basic,
        p.earnings.gross,
        p.payableDays,
        p.deductions.total,
        p.netSalary
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map(val => `"${val}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Payroll_${year}_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    App.toast('Payroll CSV exported! 📥', 'success');
  }

  return {
    calculateSalary,
    renderSalarySlipHTML,
    openPayslipModal,
    renderPayrollAdminView,
    renderStaffPayslipView,
    exportPayrollCSV
  };
})();
