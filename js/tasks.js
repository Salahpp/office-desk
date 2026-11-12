/* ============================================================
   Office Desk — Kanban Task Management Engine (tasks.js)
   Task Tracking, Drag-and-Drop / 1-Tap Mobile Movement, & Assignment
   ============================================================ */

window.Tasks = (function () {
  const COLUMNS = [
    { id: 'todo', label: 'To Do', badge: 'badge-off' },
    { id: 'in-progress', label: 'In Progress', badge: 'badge-late' },
    { id: 'review', label: 'Under Review', badge: 'badge-half' },
    { id: 'done', label: 'Completed', badge: 'badge-present' }
  ];

  async function createTask(taskObj) {
    taskObj.id = 'tk_' + Date.now().toString(36);
    if (!taskObj.status) taskObj.status = 'todo';
    await DB.put('tasks', taskObj);
    return taskObj;
  }

  async function updateTask(taskId, updates) {
    const task = await DB.get('tasks', taskId);
    if (!task) return null;
    const merged = { ...task, ...updates };
    await DB.put('tasks', merged);
    return merged;
  }

  async function deleteTask(taskId) {
    await DB.delete('tasks', taskId);
    return true;
  }

  async function moveTask(taskId, targetStatus) {
    return updateTask(taskId, { status: targetStatus });
  }

  // Render Kanban Board View
  async function renderTasksView() {
    const user = Auth.getCurrentUser();
    const isMgr = Auth.isManager();
    const allTasks = await DB.getAll('tasks');
    const allUsers = await DB.getAll('users');

    // Filter tasks if not manager/admin: show assigned to user
    let displayTasks = allTasks;
    if (user.role === 'staff') {
      displayTasks = allTasks.filter((t) => t.assignedTo === user.id);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const renderCard = (t) => {
      const assignee = allUsers.find((u) => u.id === t.assignedTo) || { name: 'Unassigned' };
      const isOverdue = t.dueDate && t.dueDate < todayStr && t.status !== 'done';
      const colIndex = COLUMNS.findIndex((c) => c.id === t.status);

      return `
        <div class="kanban-card" draggable="true" ondragstart="Tasks.handleDragStart(event, '${t.id}')">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px;">
            <span class="priority-tag ${t.priority || 'medium'}">${t.priority || 'MED'}</span>
            ${isOverdue ? '<span class="badge badge-absent" style="font-size:0.65rem;">OVERDUE</span>' : ''}
          </div>

          <div class="kanban-card-title">${t.title}</div>
          <div class="small text-muted" style="line-height: 1.3;">${(t.description || '').slice(0, 80)}${(t.description || '').length > 80 ? '...' : ''}</div>

          <div class="kanban-card-meta" style="margin-top: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <div class="avatar avatar-sm" style="width: 22px; height: 22px; font-size: 0.65rem;">${assignee.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div>
              <span class="small font-semibold">${assignee.name.split(' ')[0]}</span>
            </div>
            <div class="small mono ${isOverdue ? 'text-danger' : 'text-dim'}">${t.dueDate ? 'Due ' + t.dueDate.slice(5) : ''}</div>
          </div>

          <!-- 1-Tap Mobile Status Movement Buttons -->
          <div class="card-move-actions">
            ${
              colIndex > 0
                ? `<button class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 0.72rem;" onclick="Tasks.moveTask('${t.id}', '${COLUMNS[colIndex - 1].id}').then(() => App.navigate('tasks'))">←</button>`
                : ''
            }
            <button class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 0.72rem;" onclick="Tasks.openEditModal('${t.id}')">Edit</button>
            ${
              colIndex < COLUMNS.length - 1
                ? `<button class="btn btn-primary btn-sm" style="padding: 2px 7px; font-size: 0.72rem;" onclick="Tasks.moveTask('${t.id}', '${COLUMNS[colIndex + 1].id}').then(() => App.navigate('tasks'))">→</button>`
                : ''
            }
          </div>
        </div>
      `;
    };

    return `
      <div class="card-header">
        <div>
          <h2>📋 Kanban Tasks & Project Board</h2>
          <p class="small text-muted">Assign, track, and complete departmental tasks with real-time status transitions.</p>
        </div>
        ${isMgr ? `<button class="btn btn-primary" onclick="Tasks.openCreateModal()">+ Create Task</button>` : ''}
      </div>

      <div class="kanban-board">
        ${COLUMNS.map((col) => {
          const colTasks = displayTasks.filter((t) => t.status === col.id);
          return `
            <div class="kanban-col" ondragover="event.preventDefault()" ondrop="Tasks.handleDrop(event, '${col.id}')">
              <div class="kanban-col-header">
                <strong style="font-size: 0.95rem;">${col.label}</strong>
                <span class="badge ${col.badge}">${colTasks.length}</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${colTasks.length > 0 ? colTasks.map(renderCard).join('') : '<div class="small text-dim" style="text-align: center; padding: 20px 0;">No tasks in this lane</div>'}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Drag and Drop
  let _draggedTaskId = null;
  function handleDragStart(e, taskId) {
    _draggedTaskId = taskId;
    e.dataTransfer.setData('text/plain', taskId);
  }

  async function handleDrop(e, targetColId) {
    e.preventDefault();
    const taskId = _draggedTaskId || e.dataTransfer.getData('text/plain');
    if (taskId) {
      await moveTask(taskId, targetColId);
      _draggedTaskId = null;
      App.toast('Task status updated! ✅', 'success');
      App.navigate('tasks');
    }
  }

  // Open Create Task Modal
  async function openCreateModal() {
    const allUsers = await DB.getAll('users');
    const today = new Date().toISOString().split('T')[0];

    const html = `
      <div class="modal-header">
        <h3 class="card-title">➕ Create New Task</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>

      <form onsubmit="Tasks.handleSubmitTask(event)">
        <div class="form-group">
          <label class="form-label">Task Title</label>
          <input type="text" name="title" class="form-control" placeholder="e.g. Design Landing Page Banner" required>
        </div>

        <div class="form-group">
          <label class="form-label">Description & Instructions</label>
          <textarea name="description" class="form-control" rows="3" placeholder="Provide detailed guidelines and requirements..."></textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Assign To</label>
            <select name="assignedTo" class="form-select">
              ${allUsers.map((u) => `<option value="${u.id}">${u.name} (${u.designation})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select name="priority" class="form-select">
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input type="date" name="dueDate" class="form-control" value="${today}">
          </div>
          <div class="form-group">
            <label class="form-label">Initial Status</label>
            <select name="status" class="form-select">
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="review">Under Review</option>
              <option value="done">Completed</option>
            </select>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Task</button>
        </div>
      </form>
    `;

    App.openModal(html);
  }

  // Open Edit Task Modal
  async function openEditModal(taskId) {
    const task = await DB.get('tasks', taskId);
    if (!task) return;
    const allUsers = await DB.getAll('users');

    const html = `
      <div class="modal-header">
        <h3 class="card-title">✏️ Edit Task: ${task.title}</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>

      <form onsubmit="Tasks.handleSaveEdit(event, '${task.id}')">
        <div class="form-group">
          <label class="form-label">Task Title</label>
          <input type="text" name="title" class="form-control" value="${task.title}" required>
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea name="description" class="form-control" rows="3">${task.description || ''}</textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Assign To</label>
            <select name="assignedTo" class="form-select">
              ${allUsers.map((u) => `<option value="${u.id}" ${task.assignedTo === u.id ? 'selected' : ''}>${u.name} (${u.designation})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select name="priority" class="form-select">
              <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
              <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input type="date" name="dueDate" class="form-control" value="${task.dueDate || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Status Lane</label>
            <select name="status" class="form-select">
              <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
              <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
              <option value="review" ${task.status === 'review' ? 'selected' : ''}>Under Review</option>
              <option value="done" ${task.status === 'done' ? 'selected' : ''}>Completed</option>
            </select>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px;">
          <button type="button" class="btn btn-danger btn-sm" onclick="Tasks.handleDelete('${task.id}')">Delete Task</button>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </div>
      </form>
    `;

    App.openModal(html);
  }

  async function handleSubmitTask(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const user = Auth.getCurrentUser();

    await createTask({
      title: fd.get('title').trim(),
      description: fd.get('description').trim(),
      assignedTo: fd.get('assignedTo'),
      assignedBy: user.id,
      priority: fd.get('priority'),
      dueDate: fd.get('dueDate'),
      status: fd.get('status')
    });

    App.closeModal();
    App.toast('New task created! ✅', 'success');
    App.navigate('tasks');
  }

  async function handleSaveEdit(e, taskId) {
    e.preventDefault();
    const fd = new FormData(e.target);

    await updateTask(taskId, {
      title: fd.get('title').trim(),
      description: fd.get('description').trim(),
      assignedTo: fd.get('assignedTo'),
      priority: fd.get('priority'),
      dueDate: fd.get('dueDate'),
      status: fd.get('status')
    });

    App.closeModal();
    App.toast('Task updated! ✅', 'success');
    App.navigate('tasks');
  }

  async function handleDelete(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
      await deleteTask(taskId);
      App.closeModal();
      App.toast('Task deleted.', 'info');
      App.navigate('tasks');
    }
  }

  return {
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    renderTasksView,
    openCreateModal,
    openEditModal,
    handleSubmitTask,
    handleSaveEdit,
    handleDelete,
    handleDragStart,
    handleDrop
  };
})();
