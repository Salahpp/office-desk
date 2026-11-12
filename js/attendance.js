/* ============================================================
   Office Desk — Attendance & Punch Engine (attendance.js)
   Selfie Punch In/Out with Automatic Watermarking (Date, Time, Location)
   Real-Time Working Timer, Late Detection, & Monthly Calendar
   ============================================================ */

window.Attendance = (function () {
  let _liveTimerId = null;

  function toMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function formatTimeHM(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  function getTodayString() {
    return new Date().toISOString().split('T')[0];
  }

  // Get attendance record for a user today
  async function getTodayRecord(userId) {
    const ds = getTodayString();
    return DB.get('attendance', `att_${userId}_${ds}`);
  }

  // Punch In with Selfie & Automatic Watermark
  async function punchIn(userId, selfieDataUrl, workMode, locationData) {
    const ds = getTodayString();
    const id = `att_${userId}_${ds}`;
    const existing = await DB.get('attendance', id);

    if (existing && existing.punchIn) {
      throw new Error('You have already punched in for today!');
    }

    const settings = AdminSettings.getSettings();
    const now = new Date();
    const punchInTime = formatTimeHM(now);

    // Calculate Late status based on admin editable settings
    const officeStartMins = toMinutes(settings.officeStartTime || '09:00');
    const graceMins = Number(settings.graceMinutes ?? 15);
    const punchInMins = toMinutes(punchInTime);

    const isLate = punchInMins > officeStartMins + graceMins;
    const lateMinutes = isLate ? punchInMins - (officeStartMins + graceMins) : 0;
    const status = isLate ? 'late' : 'present';

    const record = {
      id,
      userId,
      date: ds,
      punchIn: punchInTime,
      punchOut: null,
      status,
      workMode: workMode || 'office',
      hoursWorked: 0,
      lateMinutes,
      selfieIn: selfieDataUrl,
      selfieOut: null,
      locationIn: locationData || Camera.getLocation(),
      locationOut: null
    };

    await DB.put('attendance', record);
    return { success: true, record, isLate, lateMinutes };
  }

  // Punch Out with Selfie & Automatic Watermark
  async function punchOut(userId, selfieDataUrl, locationData) {
    const ds = getTodayString();
    const id = `att_${userId}_${ds}`;
    const record = await DB.get('attendance', id);

    if (!record || !record.punchIn) {
      throw new Error('No punch-in record found for today. Please punch in first.');
    }
    if (record.punchOut) {
      throw new Error('You have already punched out for today!');
    }

    const now = new Date();
    const punchOutTime = formatTimeHM(now);
    const inMins = toMinutes(record.punchIn);
    const outMins = toMinutes(punchOutTime);
    const workedHours = Number((Math.max(0, outMins - inMins) / 60).toFixed(1));

    const settings = AdminSettings.getSettings();
    const halfDayThreshold = Number(settings.halfDayHours ?? 4);

    let status = record.status;
    if (workedHours < halfDayThreshold) {
      status = 'half-day';
    }

    record.punchOut = punchOutTime;
    record.hoursWorked = workedHours;
    record.status = status;
    record.selfieOut = selfieDataUrl;
    record.locationOut = locationData || Camera.getLocation();

    await DB.put('attendance', record);
    return { success: true, record, hoursWorked: workedHours };
  }

  // Get all monthly attendance for a user
  async function getMonthlyAttendance(userId, year, month) {
    const all = await DB.getAll('attendance');
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return all.filter((a) => a.userId === userId && a.date && a.date.startsWith(prefix));
  }

  // Calculate monthly attendance summary
  async function getMonthlySummary(userId, year, month) {
    const records = await getMonthlyAttendance(userId, year, month);
    const leaves = await DB.getAll('leaves');
    const prefix = `${year}-${String(month).padStart(2, '0')}`;

    const approvedLeaves = leaves.filter(
      (l) => l.userId === userId && l.status === 'approved' && l.fromDate && l.fromDate.startsWith(prefix)
    );

    let present = 0,
      late = 0,
      absent = 0,
      halfDay = 0,
      totalHours = 0;

    records.forEach((r) => {
      if (r.status === 'present') present++;
      else if (r.status === 'late') {
        present++;
        late++;
      } else if (r.status === 'half-day') halfDay++;
      else if (r.status === 'absent') absent++;

      totalHours += r.hoursWorked || 0;
    });

    const leaveDays = approvedLeaves.reduce((acc, l) => acc + (l.days || 1), 0);
    const settings = AdminSettings.getSettings();
    const lateThreshold = settings.lateMarkLimit || 3;
    const latePenalty = settings.latePenaltyDays || 0.5;
    const lateDeductionDays = Math.floor(late / lateThreshold) * latePenalty;

    return {
      presentDays: present,
      lateMarks: late,
      halfDays: halfDay,
      absentDays: absent,
      leaveDays,
      totalHours: Number(totalHours.toFixed(1)),
      lateDeductionDays
    };
  }

  // Get today attendance for all team members under manager
  async function getTeamAttendanceToday(managerId) {
    const allUsers = await DB.getAll('users');
    const team = allUsers.filter((u) => u.managerId === managerId || (Auth.isAdmin() && u.id !== managerId));
    const ds = getTodayString();
    const records = await DB.getAll('attendance');

    return team.map((u) => {
      const rec = records.find((a) => a.userId === u.id && a.date === ds) || null;
      return { user: u, record: rec };
    });
  }

  // Start real-time live working timer
  function startLiveTimer(punchInTime, targetEl) {
    if (_liveTimerId) clearInterval(_liveTimerId);
    if (!targetEl || !punchInTime) return;

    function update() {
      const now = new Date();
      const [h, m] = punchInTime.split(':').map(Number);
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);

      const diffMs = Math.max(0, now - start);
      const diffSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(diffSecs / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);
      const secs = diffSecs % 60;

      targetEl.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    update();
    _liveTimerId = setInterval(update, 1000);
  }

  // Render Punch View (Interactive Camera + Watermark + Mode + Timer)
  async function renderPunchView() {
    const user = Auth.getCurrentUser();
    const todayRec = await getTodayRecord(user.id);
    const settings = AdminSettings.getSettings();

    const isPunchedIn = todayRec && todayRec.punchIn;
    const isPunchedOut = todayRec && todayRec.punchOut;

    return `
      <div class="card-header">
        <div>
          <h2>👊 Attendance Punch with Live Selfie</h2>
          <p class="small text-muted">Automatic timestamp and GPS location watermarked directly onto your selfie. No office code needed!</p>
        </div>
      </div>

      <div class="card punch-card">
        <div class="punch-clock" id="live-punch-clock">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
        <div class="punch-date">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>

        <!-- Working Mode Selection -->
        <div style="margin-bottom: 8px;">
          <span class="small text-muted" style="margin-right: 8px; font-weight: 600;">Work Mode:</span>
          <div class="work-modes-bar">
            <button type="button" class="mode-chip active" data-mode="office" onclick="Attendance.selectMode(this)">🏢 Office</button>
            <button type="button" class="mode-chip" data-mode="wfh" onclick="Attendance.selectMode(this)">🏠 Work From Home</button>
            <button type="button" class="mode-chip" data-mode="site-visit" onclick="Attendance.selectMode(this)">🚗 Client Visit / Field</button>
          </div>
        </div>

        <!-- Camera View Area -->
        <div class="camera-box" id="camera-box">
          <video id="selfie-video" class="camera-video" autoplay playsinline muted></video>
          <img id="selfie-result" class="selfie-preview-img" style="display: none;" alt="Watermarked Selfie">
          <canvas id="selfie-canvas" class="camera-canvas"></canvas>
          <div class="camera-watermark-overlay" id="watermark-overlay-preview">
            <div class="watermark-stamp-title">● LIVE CAMERA FEED READY</div>
            <div>📅 Date & Time will be auto-stamped</div>
            <div>📍 GPS Location will be embedded</div>
          </div>
        </div>

        <div class="location-indicator" id="location-badge">
          <span>📍</span>
          <span id="location-text">Detecting GPS location...</span>
        </div>

        <!-- Camera Controls -->
        <div class="camera-controls">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-start-camera" onclick="Attendance.startCameraStream()">
            📹 Start Front Camera
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('file-camera-fallback').click()">
            📁 Upload Selfie
          </button>
          <input type="file" id="file-camera-fallback" accept="image/*" capture="user" style="display: none;" onchange="Attendance.handleFallbackUpload(event)">
        </div>

        <!-- Live Elapsed Timer Box (if currently clocked in) -->
        ${
          isPunchedIn && !isPunchedOut
            ? `
          <div class="punch-timer-box">
            <div>
              <span class="small text-muted" style="display: block;">Punched in at <strong>${todayRec.punchIn}</strong></span>
              <span class="badge ${todayRec.status === 'late' ? 'badge-late' : 'badge-present'}">${todayRec.status.toUpperCase()}</span>
            </div>
            <div style="text-align: right;">
              <span class="small text-muted" style="display: block;">Working Time Today</span>
              <span class="live-timer-val" id="active-work-timer">00:00:00</span>
            </div>
          </div>
        `
            : ''
        }

        <!-- Big Action Punch Buttons -->
        ${
          !isPunchedIn
            ? `
          <button type="button" class="btn btn-success punch-action-btn" id="btn-punch-action" onclick="Attendance.triggerPunch('PUNCH IN')">
            📸 Snap Selfie & PUNCH IN
          </button>
        `
            : !isPunchedOut
            ? `
          <button type="button" class="btn btn-danger punch-action-btn" id="btn-punch-action" onclick="Attendance.triggerPunch('PUNCH OUT')">
            📸 Snap Selfie & PUNCH OUT
          </button>
        `
            : `
          <div class="card card-glass" style="padding: 16px; margin-top: 10px;">
            <div style="font-size: 2rem; margin-bottom: 6px;">🎉</div>
            <h4>Work Completed for Today!</h4>
            <p class="small text-muted">Clocked in at <strong>${todayRec.punchIn}</strong> — Clocked out at <strong>${todayRec.punchOut}</strong></p>
            <p class="small text-success font-semibold" style="margin-top: 4px;">Total Hours: ${todayRec.hoursWorked} hrs</p>
          </div>
        `
        }

        <!-- Stamped Selfie Thumbnail Preview if available -->
        ${
          todayRec && (todayRec.selfieIn || todayRec.selfieOut)
            ? `
          <div style="margin-top: 20px; text-align: left;">
            <h4 class="small text-muted" style="margin-bottom: 8px;">Today's Watermarked Selfie:</h4>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              ${
                todayRec.selfieIn
                  ? `
                <div>
                  <img src="${todayRec.selfieIn}" style="width: 120px; height: 90px; object-fit: cover; border-radius: 8px; border: 1px solid var(--surface-border);" alt="Punch In Selfie">
                  <div class="small text-dim" style="text-align: center; margin-top: 3px;">Punch In (${todayRec.punchIn})</div>
                </div>
              `
                  : ''
              }
              ${
                todayRec.selfieOut
                  ? `
                <div>
                  <img src="${todayRec.selfieOut}" style="width: 120px; height: 90px; object-fit: cover; border-radius: 8px; border: 1px solid var(--surface-border);" alt="Punch Out Selfie">
                  <div class="small text-dim" style="text-align: center; margin-top: 3px;">Punch Out (${todayRec.punchOut})</div>
                </div>
              `
                  : ''
              }
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  // Mode Selection
  let _selectedWorkMode = 'office';
  function selectMode(btn) {
    document.querySelectorAll('.mode-chip').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    _selectedWorkMode = btn.dataset.mode;
  }

  // Initialize camera stream inside the view
  async function startCameraStream() {
    const video = document.getElementById('selfie-video');
    const resultImg = document.getElementById('selfie-result');
    if (resultImg) resultImg.style.display = 'none';
    if (video) video.style.display = 'block';

    const ok = await Camera.start(video);
    if (!ok) {
      App.toast('Could not access front camera. Please use "Upload Selfie" button.', 'warning');
    }
  }

  // Initialize GPS Location
  async function initLocationBadge() {
    const loc = await Camera.fetchLocation();
    const locEl = document.getElementById('location-text');
    if (locEl) {
      locEl.textContent = loc.address || `${loc.lat.toFixed(4)}°, ${loc.lng.toFixed(4)}°`;
    }
  }

  // Handle fallback file upload
  async function handleFallbackUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const user = Auth.getCurrentUser();
    const canvas = document.getElementById('selfie-canvas');
    const resultImg = document.getElementById('selfie-result');
    const video = document.getElementById('selfie-video');

    App.toast('Watermarking uploaded photo...', 'info');
    try {
      const stampedDataUrl = await Camera.stampImageFile(file, canvas, 'SELFIE PUNCH', user.name, Camera.getLocation());
      if (video) video.style.display = 'none';
      if (resultImg) {
        resultImg.src = stampedDataUrl;
        resultImg.style.display = 'block';
      }
      _lastCapturedSelfie = stampedDataUrl;
      App.toast('Photo watermarked with Date, Time & Location! Press Punch button to submit.', 'success');
    } catch (e) {
      App.toast('Failed to process image: ' + e.message, 'danger');
    }
  }

  let _lastCapturedSelfie = null;

  // Trigger Punch In / Punch Out
  async function triggerPunch(punchType) {
    const user = Auth.getCurrentUser();
    const video = document.getElementById('selfie-video');
    const canvas = document.getElementById('selfie-canvas');
    const resultImg = document.getElementById('selfie-result');

    App.playPunchSound();

    let selfieUrl = _lastCapturedSelfie;

    // If video is streaming, snap directly
    if (video && video.videoWidth > 0) {
      selfieUrl = Camera.capturePhoto(video, canvas, punchType, user.name, Camera.getLocation());
      if (resultImg) {
        resultImg.src = selfieUrl;
        resultImg.style.display = 'block';
        video.style.display = 'none';
      }
      Camera.stop();
    }

    // If no selfie, prompt user
    if (!selfieUrl) {
      // Create a solid fallback watermarked canvas
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      Camera.drawWatermark(ctx, canvas.width, canvas.height, punchType, Camera.getLocation(), user.name);
      selfieUrl = canvas.toDataURL('image/jpeg', 0.85);
    }

    try {
      if (punchType === 'PUNCH IN') {
        const res = await punchIn(user.id, selfieUrl, _selectedWorkMode, Camera.getLocation());
        if (res.isLate) {
          App.toast(`⚠️ Punched In (LATE by ${res.lateMinutes} mins) at ${res.record.punchIn}`, 'warning');
        } else {
          App.toast(`✅ Punched In on time at ${res.record.punchIn}!`, 'success');
        }
      } else {
        const res = await punchOut(user.id, selfieUrl, Camera.getLocation());
        App.toast(`✅ Punched Out at ${res.record.punchOut}! Worked ${res.hoursWorked} hrs today.`, 'success');
      }

      _lastCapturedSelfie = null;
      // Refresh punch view
      setTimeout(() => App.navigate('punch'), 800);
    } catch (err) {
      App.toast(err.message, 'danger');
    }
  }

  // Render Monthly Attendance Calendar View
  async function renderCalendarView(year, month) {
    const user = Auth.getCurrentUser();
    const now = new Date();
    const selYear = year || now.getFullYear();
    const selMonth = month || now.getMonth() + 1;

    const records = await getMonthlyAttendance(user.id, selYear, selMonth);
    const summary = await getMonthlySummary(user.id, selYear, selMonth);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthLabel = `${monthNames[selMonth - 1]} ${selYear}`;

    const daysInMonth = new Date(selYear, selMonth, 0).getDate();
    const firstDayIndex = new Date(selYear, selMonth - 1, 1).getDay(); // 0 is Sun

    const dayCells = [];
    // Padding before 1st of month
    for (let i = 0; i < firstDayIndex; i++) {
      dayCells.push('<div class="cal-day blank"></div>');
    }

    const todayStr = getTodayString();

    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(selYear, selMonth - 1, day);
      const ds = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSunday = dayDate.getDay() === 0;
      const rec = records.find((r) => r.date === ds);

      let status = 'empty';
      let label = '';

      if (rec) {
        status = rec.status;
        label = rec.punchIn || status;
      } else if (isSunday) {
        status = 'off';
        label = 'Off';
      } else if (ds < todayStr) {
        status = 'absent';
        label = 'Absent';
      } else if (ds === todayStr) {
        status = 'empty';
        label = 'Today';
      }

      dayCells.push(`
        <div class="cal-day ${status}" title="${ds}: ${status}">
          <div class="cal-day-num">${day}</div>
          ${label ? `<div class="cal-day-pill">${label}</div>` : ''}
        </div>
      `);
    }

    return `
      <div class="card-header">
        <div>
          <h2>📅 Attendance Calendar & Log</h2>
          <p class="small text-muted">Monthly punch records, working hours, and status history.</p>
        </div>
      </div>

      <!-- Monthly Summary Metrics -->
      <div class="stats-grid">
        <div class="stat-card green">
          <div class="stat-value">${summary.presentDays}</div>
          <div class="stat-label">Present Days</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-value">${summary.lateMarks}</div>
          <div class="stat-label">Late Marks</div>
        </div>
        <div class="stat-card cyan">
          <div class="stat-value">${summary.halfDays}</div>
          <div class="stat-label">Half Days</div>
        </div>
        <div class="stat-card red">
          <div class="stat-value">${summary.absentDays}</div>
          <div class="stat-label">Absent Days</div>
        </div>
      </div>

      <div class="card">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
          <h3>${monthLabel}</h3>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" onclick="Attendance.navMonth(-1)">‹ Prev</button>
            <button class="btn btn-secondary btn-sm" onclick="Attendance.navMonth(1)">Next ›</button>
          </div>
        </div>

        <div class="calendar-wrap">
          <div class="calendar-head">
            <div>SUN</div><div>MON</div><div>TUE</div><div>WED</div><div>THU</div><div>FRI</div><div>SAT</div>
          </div>
          <div class="calendar-grid">
            ${dayCells.join('')}
          </div>
        </div>

        <div style="display: flex; gap: 14px; flex-wrap: wrap; margin-top: 16px; font-size: 0.78rem; color: var(--text-muted);">
          <span><span class="badge badge-present">●</span> Present</span>
          <span><span class="badge badge-late">●</span> Late</span>
          <span><span class="badge badge-half">●</span> Half-Day</span>
          <span><span class="badge badge-absent">●</span> Absent</span>
          <span><span class="badge badge-leave">●</span> On Leave</span>
          <span><span class="badge badge-off">●</span> Weekly Off</span>
        </div>
      </div>
    `;
  }

  let _calYear = new Date().getFullYear();
  let _calMonth = new Date().getMonth() + 1;

  function navMonth(delta) {
    _calMonth += delta;
    if (_calMonth < 1) {
      _calMonth = 12;
      _calYear--;
    } else if (_calMonth > 12) {
      _calMonth = 1;
      _calYear++;
    }
    App.navigate('attendance', { year: _calYear, month: _calMonth });
  }

  return {
    punchIn,
    punchOut,
    getTodayRecord,
    getMonthlyAttendance,
    getMonthlySummary,
    getTeamAttendanceToday,
    startLiveTimer,
    renderPunchView,
    renderCalendarView,
    selectMode,
    startCameraStream,
    initLocationBadge,
    handleFallbackUpload,
    triggerPunch,
    navMonth
  };
})();
