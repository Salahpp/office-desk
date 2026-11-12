/* ============================================================
   Office Desk — Persistent Data Storage Layer (db.js)
   IndexedDB with LocalStorage fallback & initial seed
   ============================================================ */

window.DB = (function () {
  const DB_NAME = 'officedesk-db';
  const DB_VERSION = 2;
  let _db = null;

  // Default HR & Company Settings (Admin Editable)
  const DEFAULT_SETTINGS = {
    companyName: 'Shah Digital Marketing Agency & Academy',
    companyAddress: 'Suite 402, Business Tower, Shahrah-e-Faisal, Karachi',
    companyPhone: '+92-300-1234567',
    companyEmail: 'info@shahdigital.pk',
    currency: 'PKR',
    officeStartTime: '09:00',
    officeEndTime: '18:00',
    graceMinutes: 15,
    halfDayHours: 4,
    lateMarkLimit: 3,
    latePenaltyDays: 0.5,
    workingDaysPerMonth: 26,
    workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    weeklyOff: ['Sun'],
    casualLeave: 12,
    sickLeave: 10,
    paidLeave: 14,
    pfPercentage: 5,
    overtimeRate: 1.5,
    allowWfh: true,
    allowSiteVisit: true,
    requireSelfie: true,
    requireLocation: true
  };

  const SEED_USERS = [
    {
      id: 'u1',
      username: 'admin',
      password: 'admin123',
      name: 'Ahmed Shah',
      email: 'admin@shahdigital.pk',
      phone: '+92-300-1112233',
      role: 'admin',
      designation: 'CEO & Founder',
      department: 'Management',
      managerId: null,
      status: 'active',
      pin: '1234',
      joinDate: '2020-01-01',
      salary: { basic: 160000, hra: 25000, conveyance: 8000, specialAllowance: 17000, bonus: 0 },
      leavesBalance: { casual: 12, sick: 10, paid: 14 }
    },
    {
      id: 'u2',
      username: 'sara',
      password: 'sara123',
      name: 'Sara Khan',
      email: 'sara@shahdigital.pk',
      phone: '+92-321-2223344',
      role: 'manager',
      designation: 'Marketing Manager',
      department: 'Digital Marketing',
      managerId: 'u1',
      status: 'active',
      pin: '1234',
      joinDate: '2020-06-15',
      salary: { basic: 95000, hra: 15000, conveyance: 5000, specialAllowance: 10000, bonus: 5000 },
      leavesBalance: { casual: 10, sick: 8, paid: 12 }
    },
    {
      id: 'u3',
      username: 'bilal',
      password: 'bilal123',
      name: 'Bilal Raza',
      email: 'bilal@shahdigital.pk',
      phone: '+92-333-3334455',
      role: 'manager',
      designation: 'Creative Director',
      department: 'Design & Media',
      managerId: 'u1',
      status: 'active',
      pin: '1234',
      joinDate: '2021-02-01',
      salary: { basic: 90000, hra: 14000, conveyance: 5000, specialAllowance: 9000, bonus: 4000 },
      leavesBalance: { casual: 11, sick: 9, paid: 13 }
    },
    {
      id: 'u4',
      username: 'zara',
      password: 'zara123',
      name: 'Zara Ahmed',
      email: 'zara@shahdigital.pk',
      phone: '+92-300-4445566',
      role: 'staff',
      designation: 'SEO & Performance Lead',
      department: 'Digital Marketing',
      managerId: 'u2',
      status: 'active',
      pin: '1234',
      joinDate: '2021-09-10',
      salary: { basic: 60000, hra: 9000, conveyance: 3000, specialAllowance: 5000, bonus: 0 },
      leavesBalance: { casual: 9, sick: 7, paid: 11 }
    },
    {
      id: 'u5',
      username: 'hassan',
      password: 'hassan123',
      name: 'Hassan Ali',
      email: 'hassan@shahdigital.pk',
      phone: '+92-321-5556677',
      role: 'staff',
      designation: 'Senior Graphic Designer',
      department: 'Design & Media',
      managerId: 'u3',
      status: 'active',
      pin: '1234',
      joinDate: '2022-03-15',
      salary: { basic: 55000, hra: 8000, conveyance: 3000, specialAllowance: 4000, bonus: 0 },
      leavesBalance: { casual: 10, sick: 8, paid: 10 }
    },
    {
      id: 'u6',
      username: 'maryam',
      password: 'maryam123',
      name: 'Maryam Siddiqui',
      email: 'maryam@shahdigital.pk',
      phone: '+92-333-6667788',
      role: 'staff',
      designation: 'Social Media Strategist',
      department: 'Digital Marketing',
      managerId: 'u2',
      status: 'active',
      pin: '1234',
      joinDate: '2022-07-01',
      salary: { basic: 52000, hra: 7500, conveyance: 3000, specialAllowance: 3500, bonus: 0 },
      leavesBalance: { casual: 11, sick: 9, paid: 13 }
    },
    {
      id: 'u7',
      username: 'usman',
      password: 'usman123',
      name: 'Usman Tariq',
      email: 'usman@shahdigital.pk',
      phone: '+92-300-7778899',
      role: 'staff',
      designation: 'UI/UX & Video Editor',
      department: 'Design & Media',
      managerId: 'u3',
      status: 'active',
      pin: '1234',
      joinDate: '2023-01-10',
      salary: { basic: 58000, hra: 8500, conveyance: 3000, specialAllowance: 4500, bonus: 0 },
      leavesBalance: { casual: 8, sick: 9, paid: 12 }
    },
    {
      id: 'u8',
      username: 'fatima',
      password: 'fatima123',
      name: 'Fatima Malik',
      email: 'fatima@shahdigital.pk',
      phone: '+92-321-8889900',
      role: 'staff',
      designation: 'Academy Coordinator',
      department: 'Academy',
      managerId: 'u1',
      status: 'active',
      pin: '1234',
      joinDate: '2023-05-01',
      salary: { basic: 48000, hra: 6500, conveyance: 2500, specialAllowance: 3000, bonus: 0 },
      leavesBalance: { casual: 12, sick: 10, paid: 14 }
    }
  ];

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported, using LocalStorage fallback');
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const stores = [
          { name: 'users', key: 'id', indexes: ['role', 'department', 'email'] },
          { name: 'attendance', key: 'id', indexes: ['userId', 'date', 'status'] },
          { name: 'leaves', key: 'id', indexes: ['userId', 'status', 'managerId'] },
          { name: 'tasks', key: 'id', indexes: ['assignedTo', 'status', 'priority'] },
          { name: 'salaries', key: 'id', indexes: ['userId', 'month'] },
          { name: 'settings', key: 'key' },
          { name: 'notifications', key: 'id', indexes: ['userId', 'read'] }
        ];
        stores.forEach((s) => {
          if (!db.objectStoreNames.contains(s.name)) {
            const os = db.createObjectStore(s.name, { keyPath: s.key });
            if (s.indexes) {
              s.indexes.forEach((idx) => os.createIndex(idx, idx, { unique: false }));
            }
          }
        });
      };
      req.onsuccess = () => {
        _db = req.result;
        resolve(_db);
      };
      req.onerror = () => {
        console.error('IndexedDB error:', req.error);
        resolve(null);
      };
    });
  }

  // Generic DB operations with LocalStorage fallback
  async function put(storeName, item) {
    if (_db) {
      return new Promise((resolve, reject) => {
        const tx = _db.transaction(storeName, 'readwrite');
        const st = tx.objectStore(storeName);
        const req = st.put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      });
    } else {
      const all = getLocal(storeName);
      const key = storeName === 'settings' ? item.key : item.id;
      const idx = all.findIndex((x) => (storeName === 'settings' ? x.key : x.id) === key);
      if (idx >= 0) all[idx] = item;
      else all.push(item);
      setLocal(storeName, all);
      return item;
    }
  }

  async function get(storeName, key) {
    if (_db) {
      return new Promise((resolve, reject) => {
        const tx = _db.transaction(storeName, 'readonly');
        const st = tx.objectStore(storeName);
        const req = st.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } else {
      const all = getLocal(storeName);
      return all.find((x) => (storeName === 'settings' ? x.key : x.id) === key) || null;
    }
  }

  async function getAll(storeName) {
    if (_db) {
      return new Promise((resolve, reject) => {
        const tx = _db.transaction(storeName, 'readonly');
        const st = tx.objectStore(storeName);
        const req = st.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } else {
      return getLocal(storeName);
    }
  }

  async function remove(storeName, key) {
    if (_db) {
      return new Promise((resolve, reject) => {
        const tx = _db.transaction(storeName, 'readwrite');
        const st = tx.objectStore(storeName);
        const req = st.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } else {
      let all = getLocal(storeName);
      all = all.filter((x) => (storeName === 'settings' ? x.key : x.id) !== key);
      setLocal(storeName, all);
      return true;
    }
  }

  function getLocal(store) {
    try {
      return JSON.parse(localStorage.getItem('od_' + store) || '[]');
    } catch {
      return [];
    }
  }

  function setLocal(store, data) {
    try {
      localStorage.setItem('od_' + store, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage quota or access error:', e);
    }
  }

  // Seed sample data for Shah Digital Marketing
  async function seedData() {
    const isSeeded = localStorage.getItem('od_seeded_v5');
    if (isSeeded) return;

    console.log('Seeding initial office desk database with user credentials...');

    // 1. Settings
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await put('settings', { key, value });
    }

    // 2. Users (with username & passwords)
    for (const u of SEED_USERS) {
      await put('users', u);
    }

    // 3. Realistic Attendance Data for current month
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const todayDate = now.getDate();

    const sampleUsers = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'];

    for (let day = 1; day <= Math.min(todayDate, 28); day++) {
      const d = new Date(curYear, curMonth, day);
      const isSunday = d.getDay() === 0;
      const ds = d.toISOString().split('T')[0];

      if (isSunday) continue; // Sunday off

      for (const uid of sampleUsers) {
        // Skip today for some so they can punch in live
        if (day === todayDate && (uid === 'u4' || uid === 'u5')) continue;

        // Generate realistic status
        const rand = Math.random();
        let status = 'present';
        let inH = 9, inM = Math.floor(Math.random() * 14); // 09:00 - 09:14 (on time)
        let outH = 18, outM = Math.floor(Math.random() * 25); // 18:00 - 18:25

        if (rand > 0.88) {
          status = 'absent';
        } else if (rand > 0.75) {
          status = 'late';
          inH = 9;
          inM = 20 + Math.floor(Math.random() * 35); // 09:20 - 09:55
        } else if (rand > 0.70) {
          status = 'half-day';
          outH = 13;
          outM = 30; // left early
        }

        if (status === 'absent') {
          await put('attendance', {
            id: `att_${uid}_${ds}`,
            userId: uid,
            date: ds,
            punchIn: null,
            punchOut: null,
            status: 'absent',
            workMode: 'office',
            hoursWorked: 0,
            lateMinutes: 0,
            location: { address: 'Office Premises' }
          });
        } else {
          const punchInStr = `${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}`;
          const punchOutStr = `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
          const hours = Number(((outH * 60 + outM - (inH * 60 + inM)) / 60).toFixed(1));
          const lateMins = status === 'late' ? inH * 60 + inM - (9 * 60 + 15) : 0;

          await put('attendance', {
            id: `att_${uid}_${ds}`,
            userId: uid,
            date: ds,
            punchIn: punchInStr,
            punchOut: punchOutStr,
            status: status,
            workMode: rand > 0.9 ? 'wfh' : rand > 0.85 ? 'site-visit' : 'office',
            hoursWorked: hours,
            lateMinutes: lateMins,
            location: {
              lat: 24.8607 + (Math.random() - 0.5) * 0.01,
              lng: 67.0105 + (Math.random() - 0.5) * 0.01,
              accuracy: 15,
              address: 'Shahrah-e-Faisal, Karachi, Pakistan'
            }
          });
        }
      }
    }

    // 4. Leave requests
    const sampleLeaves = [
      {
        id: 'lv1',
        userId: 'u4',
        type: 'sick',
        fromDate: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-05`,
        toDate: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-06`,
        days: 2,
        reason: 'Viral fever and prescribed doctor rest',
        status: 'approved',
        managerId: 'u2',
        managerComment: 'Approved. Get well soon!',
        appliedAt: new Date(curYear, curMonth, 4).toISOString()
      },
      {
        id: 'lv2',
        userId: 'u5',
        type: 'casual',
        fromDate: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-12`,
        toDate: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-12`,
        days: 1,
        reason: 'Family urgent wedding commitment',
        status: 'approved',
        managerId: 'u3',
        managerComment: 'Approved.',
        appliedAt: new Date(curYear, curMonth, 10).toISOString()
      },
      {
        id: 'lv3',
        userId: 'u6',
        type: 'casual',
        fromDate: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-28`,
        toDate: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-29`,
        days: 2,
        reason: 'Personal family matters',
        status: 'pending',
        managerId: 'u2',
        managerComment: '',
        appliedAt: new Date().toISOString()
      },
      {
        id: 'lv4',
        userId: 'u7',
        type: 'sick',
        fromDate: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-29`,
        toDate: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-29`,
        days: 1,
        reason: 'Dentist procedure',
        status: 'pending',
        managerId: 'u3',
        managerComment: '',
        appliedAt: new Date().toISOString()
      }
    ];

    for (const l of sampleLeaves) {
      await put('leaves', l);
    }

    // 5. Kanban Tasks
    const sampleTasks = [
      {
        id: 'tk1',
        title: 'Q4 Performance Marketing Strategy',
        description: 'Prepare target CPA & ROAS projection deck for new international client.',
        assignedTo: 'u4',
        assignedBy: 'u2',
        priority: 'urgent',
        status: 'in-progress',
        dueDate: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-28`,
        tags: ['PPC', 'Strategy', 'Client']
      },
      {
        id: 'tk2',
        title: 'New Branding Kit & Vector Assets',
        description: 'Export all logo variants, favicon sets, and color typography sheets.',
        assignedTo: 'u5',
        assignedBy: 'u3',
        priority: 'high',
        status: 'in-progress',
        dueDate: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-29`,
        tags: ['Design', 'Branding']
      },
      {
        id: 'tk3',
        title: 'Instagram Reels & Carousel Series',
        description: 'Batch produce 8 video reels on SEO hacks and design trends.',
        assignedTo: 'u6',
        assignedBy: 'u2',
        priority: 'medium',
        status: 'todo',
        dueDate: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-30`,
        tags: ['Social', 'Content']
      },
      {
        id: 'tk4',
        title: 'Mobile App Wireframes & Figma UI',
        description: 'Complete high-fidelity prototype with mobile touch flows.',
        assignedTo: 'u7',
        assignedBy: 'u3',
        priority: 'high',
        status: 'review',
        dueDate: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-27`,
        tags: ['UI/UX', 'Figma']
      },
      {
        id: 'tk5',
        title: 'Academy Batch 14 Orientation Slides',
        description: 'Finalize student enrollment list and course syllabus booklet.',
        assignedTo: 'u8',
        assignedBy: 'u1',
        priority: 'medium',
        status: 'done',
        dueDate: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-25`,
        tags: ['Academy', 'Training']
      },
      {
        id: 'tk6',
        title: 'Technical SEO Site Speed Optimization',
        description: 'Minify scripts, configure WebP image CDN, and resolve LCP delays.',
        assignedTo: 'u4',
        assignedBy: 'u2',
        priority: 'urgent',
        status: 'todo',
        dueDate: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-31`,
        tags: ['SEO', 'Speed']
      }
    ];

    for (const t of sampleTasks) {
      await put('tasks', t);
    }

    localStorage.setItem('od_seeded_v5', 'true');
    console.log('Seeding completed successfully!');
  }

  async function init() {
    await openDB();
    await seedData();
  }

  return {
    init,
    put,
    get,
    getAll,
    delete: remove,
    DEFAULT_SETTINGS
  };
})();
