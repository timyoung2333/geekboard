(function () {
  const STORAGE_KEY = 'geekboard_state_v1';

  /** @type {{
   *  groups: {id: string, name: string, collapsed: boolean}[],
   *  projects: {id: string, name: string, groupId?: string, createdAt: number}[],
   *  tasks: {id:string, projectId:string, title:string, description:string, status:'backlog'|'in_progress'|'done', priority:'low'|'medium'|'high', tags:string[], createdAt:number}[],
   *  trash: {id: string, type: 'project'|'task', name: string, data: any, deletedAt: number}[],
   *  activeProjectId?: string
   * }} */
  let state = loadState();

  // DOM refs
  const projectListEl = document.getElementById('projectList');
  const activeProjectNameEl = document.getElementById('activeProjectName');
  const projectStatsEl = document.getElementById('projectStats');
  const completionLabel = document.getElementById('completionLabel');
  const completionBar = document.getElementById('completionBar');
  const taskCountLabel = document.getElementById('taskCountLabel');
  const searchInput = document.getElementById('searchInput');
  const newTaskBtn = document.getElementById('newTaskBtn');
  const shortcutsBtn = document.getElementById('shortcutsBtn');
  const shortcutsModal = document.getElementById('shortcutsModal');
  const closeShortcutsBtn = document.getElementById('closeShortcutsBtn');
  const projectsToggle = document.getElementById('projectsToggle');
  const projectsArrow = document.getElementById('projectsArrow');
  const trashBtn = document.getElementById('trashBtn');
  const trashCount = document.getElementById('trashCount');
  const trashModal = document.getElementById('trashModal');
  const trashModalList = document.getElementById('trashModalList');
  const closeTrashBtn = document.getElementById('closeTrashBtn');
  const emptyTrashBtn = document.getElementById('emptyTrashBtn');
  const calendarBtn = document.getElementById('calendarBtn');
  const kanbanView = document.getElementById('kanbanView');
  const calendarView = document.getElementById('calendarView');
  const calViewGrid = document.getElementById('calViewGrid');
  const calViewMonthLabel = document.getElementById('calViewMonthLabel');
  const calViewPrevBtn = document.getElementById('calViewPrevBtn');
  const calViewNextBtn = document.getElementById('calViewNextBtn');
  const calViewTodayBtn = document.getElementById('calViewTodayBtn');
  const calDayDetail = document.getElementById('calDayDetail');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const themeDarkBtn = document.getElementById('themeDarkBtn');
  const themeLightBtn = document.getElementById('themeLightBtn');
  const resetLayoutBtn = document.getElementById('resetLayoutBtn');

  // New Project Modal
  const newProjectModal = document.getElementById('newProjectModal');
  const newProjectNameInput = document.getElementById('newProjectNameInput');
  const newProjectGroupSelect = document.getElementById('newProjectGroupSelect');
  const closeNewProjectBtn = document.getElementById('closeNewProjectBtn');
  const cancelNewProjectBtn = document.getElementById('cancelNewProjectBtn');
  const saveNewProjectBtn = document.getElementById('saveNewProjectBtn');

  // New Group Modal
  const newGroupModal = document.getElementById('newGroupModal');
  const newGroupNameInput = document.getElementById('newGroupNameInput');
  const closeNewGroupBtn = document.getElementById('closeNewGroupBtn');
  const cancelNewGroupBtn = document.getElementById('cancelNewGroupBtn');
  const saveNewGroupBtn = document.getElementById('saveNewGroupBtn');

  // Rename Project Modal
  const renameProjectModal = document.getElementById('renameProjectModal');
  const renameProjectInput = document.getElementById('renameProjectInput');
  const closeRenameProjectBtn = document.getElementById('closeRenameProjectBtn');
  const cancelRenameProjectBtn = document.getElementById('cancelRenameProjectBtn');
  const saveRenameProjectBtn = document.getElementById('saveRenameProjectBtn');
  let renameProjectId = null;

  const modalBackdrop = document.getElementById('modalBackdrop');
  const taskModal = document.getElementById('taskModal');
  const modalModeLabel = document.getElementById('modalModeLabel');
  const taskTitleInput = document.getElementById('taskTitleInput');
  const taskDescInput = document.getElementById('taskDescInput');
  const taskPrioritySelect = document.getElementById('taskPrioritySelect');
  const taskTagsInput = document.getElementById('taskTagsInput');
  const taskDeadlineInput = document.getElementById('taskDeadlineInput');
  const taskCreatedAtLabel = document.getElementById('taskCreatedAtLabel');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const saveTaskBtn = document.getElementById('saveTaskBtn');
  const deleteTaskBtn = document.getElementById('deleteTaskBtn');

  const columnLists = {
    backlog: document.querySelector('.task-list[data-list-for="backlog"]'),
    in_progress: document.querySelector('.task-list[data-list-for="in_progress"]'),
    done: document.querySelector('.task-list[data-list-for="done"]'),
  };
  const columnCounts = {
    backlog: document.querySelector('.column-count[data-count-for="backlog"]'),
    in_progress: document.querySelector('.column-count[data-count-for="in_progress"]'),
    done: document.querySelector('.column-count[data-count-for="done"]'),
  };

  let editingTaskId = null;
  let defaultStatusForNewTask = 'backlog';
  let calendarDate = new Date(); // Current month being viewed
  let currentView = 'kanban'; // 'kanban' or 'calendar'
  let selectedCalendarDate = null; // Selected date in calendar view

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      const parsed = JSON.parse(raw);
      if (!parsed.projects || !parsed.projects.length) return createDefaultState();
      // Migrate: add trash if not exists
      if (!parsed.trash) parsed.trash = [];
      // Migrate: add groups if not exists
      if (!parsed.groups) parsed.groups = [];
      // Clean up old trash (> 30 days)
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      parsed.trash = parsed.trash.filter(item => item.deletedAt > thirtyDaysAgo);
      return parsed;
    } catch (e) {
      console.warn('Failed to load state, resetting.', e);
      return createDefaultState();
    }
  }

  function createDefaultState() {
    const projectId = genId();
    return {
      groups: [],
      projects: [
        { id: projectId, name: 'Default Project', createdAt: Date.now() }
      ],
      tasks: [],
      trash: [],
      activeProjectId: projectId
    };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save state', e);
    }
  }

  function genId() {
    return 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function renderSidebar() {
    projectListEl.innerHTML = '';
    const { groups, projects, tasks, activeProjectId } = state;

    // Helper to create a project item element
    function createProjectItem(project) {
      const el = document.createElement('div');
      el.className = 'project-item' + (project.id === activeProjectId ? ' active' : '') + (project.completed ? ' completed' : '');
      el.dataset.projectId = project.id;
      el.draggable = true;

      const nameEl = document.createElement('div');
      nameEl.className = 'project-name';
      nameEl.textContent = project.name;
      nameEl.title = project.name;

      const metaEl = document.createElement('div');
      metaEl.className = 'project-meta';
      const projectTasks = tasks.filter(t => t.projectId === project.id);
      const doneCount = projectTasks.filter(t => t.status === 'done').length;

      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.textContent = `${doneCount}/${projectTasks.length || 0}`;

      metaEl.appendChild(pill);

      el.appendChild(nameEl);
      el.appendChild(metaEl);

      // Right-click context menu
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showProjectContextMenu(project, e.clientX, e.clientY);
      });

      // Drag events for reordering
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/project-id', project.id);
        e.dataTransfer.setData('application/project-group', project.groupId || '');
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        document.querySelectorAll('.project-item.drag-over').forEach(item => {
          item.classList.remove('drag-over');
        });
      });

      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingId = e.dataTransfer.types.includes('application/project-id');
        if (draggingId) {
          e.dataTransfer.dropEffect = 'move';
          el.classList.add('drag-over');
        }
      });

      el.addEventListener('dragleave', () => {
        el.classList.remove('drag-over');
      });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        const draggedId = e.dataTransfer.getData('application/project-id');
        const draggedGroupId = e.dataTransfer.getData('application/project-group') || undefined;
        if (draggedId === project.id) return;

        const draggedProject = state.projects.find(p => p.id === draggedId);
        if (!draggedProject) return;

        // Update group if dropping into a different group
        draggedProject.groupId = project.groupId;

        // Reorder within the projects array
        const draggedIdx = state.projects.findIndex(p => p.id === draggedId);
        const targetIdx = state.projects.findIndex(p => p.id === project.id);

        // Remove from old position first
        state.projects.splice(draggedIdx, 1);
        
        // Calculate insert position
        // After removal, if we were dragging downward, target index decreased by 1
        // We want to insert at the target's position (swap places)
        let insertIdx;
        if (draggedIdx < targetIdx) {
          // Dragging down: insert after target (which is now at targetIdx-1)
          insertIdx = targetIdx; // This puts it right after where target now is
        } else {
          // Dragging up: insert at target position
          insertIdx = targetIdx;
        }
        state.projects.splice(insertIdx, 0, draggedProject);

        saveState();
        renderSidebar();
      });

      el.addEventListener('click', () => {
        state.activeProjectId = project.id;
        saveState();
        if (currentView === 'calendar') {
          toggleView('kanban');
        } else {
          renderAll();
        }
      });

      return el;
    }

    // Show project context menu on right-click
    function showProjectContextMenu(project, x, y) {
      // Remove any existing context menu
      const existingMenu = document.querySelector('.project-context-menu');
      if (existingMenu) existingMenu.remove();

      const menu = document.createElement('div');
      menu.className = 'project-context-menu';
      menu.style.cssText = `
        position: fixed;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 4px 0;
        min-width: 160px;
        z-index: 1001;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      `;
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';

      const createMenuItem = (icon, text, onClick, danger = false) => {
        const item = document.createElement('div');
        item.style.cssText = `
          padding: 8px 12px;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          color: ${danger ? '#f87171' : 'var(--text-main)'};
          transition: background 0.1s;
        `;
        item.innerHTML = `<span style="width:16px;text-align:center;">${icon}</span><span>${text}</span>`;
        item.addEventListener('mouseenter', () => item.style.background = 'rgba(148,163,184,0.1)');
        item.addEventListener('mouseleave', () => item.style.background = '');
        item.addEventListener('click', () => {
          menu.remove();
          onClick();
        });
        return item;
      };

      // Rename
      menu.appendChild(createMenuItem('✏️', 'Rename', () => openRenameProjectModal(project)));

      // Mark as complete / Reopen
      if (!project.completed) {
        menu.appendChild(createMenuItem('✓', 'Mark as Complete', () => markProjectComplete(project.id)));
      } else {
        menu.appendChild(createMenuItem('↺', 'Reopen Project', () => {
          project.completed = false;
          saveState();
          renderSidebar();
        }));
      }

      // Move to group submenu (if there are groups)
      if (groups.length > 0) {
        const groupItem = document.createElement('div');
        groupItem.style.cssText = `
          padding: 8px 12px;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          color: var(--text-main);
          transition: background 0.1s;
          position: relative;
        `;
        groupItem.innerHTML = `<span style="display:flex;align-items:center;gap:8px;"><span style="width:16px;text-align:center;">📁</span><span>Move to Group</span></span><span style="font-size:10px;">▶</span>`;
        
        // Create submenu
        const submenu = document.createElement('div');
        submenu.style.cssText = `
          position: absolute;
          left: 100%;
          top: 0;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 4px 0;
          min-width: 120px;
          display: none;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        // No group option
        const noGroupOpt = document.createElement('div');
        noGroupOpt.style.cssText = `padding: 6px 12px; font-size: 11px; cursor: pointer; color: var(--text-dim);`;
        noGroupOpt.textContent = '— No group —';
        noGroupOpt.addEventListener('mouseenter', () => noGroupOpt.style.background = 'rgba(148,163,184,0.1)');
        noGroupOpt.addEventListener('mouseleave', () => noGroupOpt.style.background = '');
        noGroupOpt.addEventListener('click', () => {
          delete project.groupId;
          saveState();
          renderSidebar();
          menu.remove();
        });
        submenu.appendChild(noGroupOpt);

        groups.forEach(group => {
          const opt = document.createElement('div');
          opt.style.cssText = `padding: 6px 12px; font-size: 11px; cursor: pointer; color: var(--text-main);`;
          if (project.groupId === group.id) {
            opt.style.color = 'var(--accent)';
            opt.textContent = '✓ ' + group.name;
          } else {
            opt.textContent = group.name;
          }
          opt.addEventListener('mouseenter', () => opt.style.background = 'rgba(148,163,184,0.1)');
          opt.addEventListener('mouseleave', () => opt.style.background = '');
          opt.addEventListener('click', () => {
            project.groupId = group.id;
            saveState();
            renderSidebar();
            menu.remove();
          });
          submenu.appendChild(opt);
        });

        groupItem.appendChild(submenu);
        groupItem.addEventListener('mouseenter', () => {
          groupItem.style.background = 'rgba(148,163,184,0.1)';
          submenu.style.display = 'block';
        });
        groupItem.addEventListener('mouseleave', () => {
          groupItem.style.background = '';
          submenu.style.display = 'none';
        });
        menu.appendChild(groupItem);
      }

      // Divider
      const divider = document.createElement('div');
      divider.style.cssText = 'height: 1px; background: var(--border); margin: 4px 0;';
      menu.appendChild(divider);

      // Delete
      menu.appendChild(createMenuItem('✕', 'Delete', () => deleteProject(project.id), true));

      document.body.appendChild(menu);

      // Ensure menu stays within viewport
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
      }
      if (rect.bottom > window.innerHeight) {
        menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
      }

      // Close on click outside
      const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    // Show move to group dropdown menu
    function showMoveToGroupMenu(project, anchorEl) {
      // Remove any existing menu
      const existingMenu = document.querySelector('.move-group-menu');
      if (existingMenu) existingMenu.remove();

      const menu = document.createElement('div');
      menu.className = 'move-group-menu';
      menu.style.cssText = `
        position: fixed;
        background: var(--panel);
        border: 1px solid var(--accent);
        border-radius: var(--radius-sm);
        padding: 4px 0;
        min-width: 120px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;

      // Position menu near the button
      const rect = anchorEl.getBoundingClientRect();
      menu.style.left = rect.left + 'px';
      menu.style.top = (rect.bottom + 4) + 'px';

      // Add "No group" option
      const noGroupItem = document.createElement('div');
      noGroupItem.style.cssText = `
        padding: 6px 12px;
        font-size: 11px;
        cursor: pointer;
        color: var(--text-dim);
        transition: background 0.1s;
      `;
      noGroupItem.textContent = '— No group —';
      noGroupItem.addEventListener('mouseenter', () => noGroupItem.style.background = 'rgba(148,163,184,0.1)');
      noGroupItem.addEventListener('mouseleave', () => noGroupItem.style.background = '');
      noGroupItem.addEventListener('click', () => {
        delete project.groupId;
        saveState();
        renderSidebar();
        menu.remove();
      });
      menu.appendChild(noGroupItem);

      // Add group options
      groups.forEach(group => {
        const item = document.createElement('div');
        item.style.cssText = `
          padding: 6px 12px;
          font-size: 11px;
          cursor: pointer;
          color: var(--text-main);
          transition: background 0.1s;
        `;
        if (project.groupId === group.id) {
          item.style.color = 'var(--accent)';
          item.textContent = '✓ ' + group.name;
        } else {
          item.textContent = group.name;
        }
        item.addEventListener('mouseenter', () => item.style.background = 'rgba(148,163,184,0.1)');
        item.addEventListener('mouseleave', () => item.style.background = '');
        item.addEventListener('click', () => {
          project.groupId = group.id;
          saveState();
          renderSidebar();
          menu.remove();
        });
        menu.appendChild(item);
      });

      document.body.appendChild(menu);

      // Close menu on outside click
      const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    // Render groups
    groups.forEach((group) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'project-group';
      groupEl.dataset.groupId = group.id;

      // Group header
      const headerEl = document.createElement('div');
      headerEl.className = 'project-group-header';

      const leftEl = document.createElement('div');
      leftEl.className = 'project-group-left';

      const arrowEl = document.createElement('span');
      arrowEl.className = 'project-group-arrow' + (group.collapsed ? ' collapsed' : '');
      arrowEl.textContent = '▼';

      const nameEl = document.createElement('span');
      nameEl.className = 'project-group-name';
      nameEl.textContent = group.name;

      const groupProjects = projects.filter(p => p.groupId === group.id && !p.completed);
      const countEl = document.createElement('span');
      countEl.className = 'project-group-count';
      countEl.textContent = `(${groupProjects.length})`;

      leftEl.appendChild(arrowEl);
      leftEl.appendChild(nameEl);
      leftEl.appendChild(countEl);

      // Actions
      const actionsEl = document.createElement('div');
      actionsEl.className = 'project-group-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'project-group-action-btn';
      editBtn.textContent = '✎';
      editBtn.title = 'Rename group';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newName = prompt('Rename group:', group.name);
        if (newName && newName.trim()) {
          group.name = newName.trim();
          saveState();
          renderSidebar();
        }
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'project-group-action-btn delete';
      deleteBtn.textContent = '✕';
      deleteBtn.title = 'Delete group (projects will be ungrouped)';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete group "${group.name}"? Projects will be moved to ungrouped.`)) {
          // Ungroup all projects in this group
          projects.forEach(p => {
            if (p.groupId === group.id) {
              delete p.groupId;
            }
          });
          // Remove group
          const idx = groups.indexOf(group);
          if (idx !== -1) groups.splice(idx, 1);
          saveState();
          renderSidebar();
        }
      });

      actionsEl.appendChild(editBtn);
      actionsEl.appendChild(deleteBtn);

      headerEl.appendChild(leftEl);
      headerEl.appendChild(actionsEl);

      // Toggle collapse on header click
      headerEl.addEventListener('click', () => {
        group.collapsed = !group.collapsed;
        saveState();
        renderSidebar();
      });

      // Group items container
      const itemsEl = document.createElement('div');
      itemsEl.className = 'project-group-items' + (group.collapsed ? ' collapsed' : '');

      groupProjects.forEach((project) => {
        itemsEl.appendChild(createProjectItem(project));
      });

      groupEl.appendChild(headerEl);
      groupEl.appendChild(itemsEl);
      projectListEl.appendChild(groupEl);
    });

    // Render ungrouped projects (not completed)
    const ungroupedProjects = projects.filter(p => !p.groupId && !p.completed);
    if (ungroupedProjects.length > 0) {
      // If there are groups, show "Ungrouped" section
      if (groups.length > 0) {
        const divider = document.createElement('div');
        divider.style.cssText = 'font-size:10px; color:var(--text-dim); margin: 8px 0 4px 8px; text-transform:uppercase; letter-spacing:0.08em;';
        divider.textContent = 'Ungrouped';
        projectListEl.appendChild(divider);
      }
      ungroupedProjects.forEach((project) => {
        projectListEl.appendChild(createProjectItem(project));
      });
    }

    // Add buttons container
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display:flex; gap:4px; margin-top:8px;';

    // Add "New Group" button
    const addGroupBtn = document.createElement('button');
    addGroupBtn.className = 'btn btn-ghost';
    addGroupBtn.style.cssText = 'flex:1; font-size:10px;';
    addGroupBtn.innerHTML = '📁 Group';
    addGroupBtn.addEventListener('click', () => {
      openNewGroupModal();
    });

    // Add "New Project" button
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-ghost';
    addBtn.style.cssText = 'flex:1; font-size:10px;';
    addBtn.innerHTML = '＋ Project <span style="color:#6b7280;">[p]</span>';
    addBtn.addEventListener('click', () => {
      openNewProjectModal();
    });

    btnContainer.appendChild(addGroupBtn);
    btnContainer.appendChild(addBtn);
    projectListEl.appendChild(btnContainer);

    // Render completed projects section
    const completedProjects = projects.filter(p => p.completed);
    if (completedProjects.length > 0) {
      const completedSection = document.createElement('div');
      completedSection.className = 'completed-section';
      completedSection.style.cssText = 'margin-top: 16px; border-top: 1px solid var(--border); padding-top: 12px;';

      const completedHeader = document.createElement('div');
      completedHeader.className = 'completed-header';
      completedHeader.style.cssText = 'display:flex; align-items:center; gap:6px; font-size:10px; color:var(--text-dim); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.08em; cursor:pointer;';
      
      const completedIcon = document.createElement('span');
      completedIcon.textContent = state.completedCollapsed ? '▶' : '▼';
      completedIcon.style.fontSize = '8px';
      
      const completedLabel = document.createElement('span');
      completedLabel.textContent = `Completed (${completedProjects.length})`;
      
      completedHeader.appendChild(completedIcon);
      completedHeader.appendChild(completedLabel);
      
      completedHeader.addEventListener('click', () => {
        state.completedCollapsed = !state.completedCollapsed;
        saveState();
        renderSidebar();
      });

      completedSection.appendChild(completedHeader);

      if (!state.completedCollapsed) {
        const completedList = document.createElement('div');
        completedList.className = 'completed-list';
        completedList.style.cssText = 'opacity: 0.6;';
        
        // Drop zone for completed section
        completedList.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (e.dataTransfer.types.includes('application/project-id')) {
            e.dataTransfer.dropEffect = 'move';
            completedList.style.background = 'rgba(62,248,154,0.1)';
            completedList.style.borderRadius = '4px';
          }
        });
        completedList.addEventListener('dragleave', () => {
          completedList.style.background = '';
        });
        completedList.addEventListener('drop', (e) => {
          e.preventDefault();
          completedList.style.background = '';
          const draggedId = e.dataTransfer.getData('application/project-id');
          if (draggedId) {
            markProjectComplete(draggedId);
          }
        });

        completedProjects.forEach((project) => {
          completedList.appendChild(createProjectItem(project));
        });
        completedSection.appendChild(completedList);
      }

      projectListEl.appendChild(completedSection);
    }

    // Drop zone for marking complete (always visible as hint)
    const completeDropZone = document.createElement('div');
    completeDropZone.className = 'complete-drop-zone';
    completeDropZone.style.cssText = 'margin-top: 12px; padding: 8px; border: 1px dashed var(--border); border-radius: 6px; text-align: center; font-size: 10px; color: var(--text-dim); opacity: 0; transition: opacity 0.2s;';
    completeDropZone.textContent = '✓ Drop to complete';
    
    completeDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer.types.includes('application/project-id')) {
        e.dataTransfer.dropEffect = 'move';
        completeDropZone.style.borderColor = 'var(--accent)';
        completeDropZone.style.background = 'rgba(62,248,154,0.1)';
        completeDropZone.style.color = 'var(--accent)';
      }
    });
    completeDropZone.addEventListener('dragleave', () => {
      completeDropZone.style.borderColor = 'var(--border)';
      completeDropZone.style.background = '';
      completeDropZone.style.color = 'var(--text-dim)';
    });
    completeDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      completeDropZone.style.borderColor = 'var(--border)';
      completeDropZone.style.background = '';
      completeDropZone.style.color = 'var(--text-dim)';
      const draggedId = e.dataTransfer.getData('application/project-id');
      if (draggedId) {
        markProjectComplete(draggedId);
      }
    });

    // Show drop zone when dragging
    projectListEl.addEventListener('dragover', () => {
      completeDropZone.style.opacity = '1';
    });
    projectListEl.addEventListener('dragleave', (e) => {
      if (!projectListEl.contains(e.relatedTarget)) {
        completeDropZone.style.opacity = '0';
      }
    });
    projectListEl.addEventListener('drop', () => {
      completeDropZone.style.opacity = '0';
    });

    if (completedProjects.length === 0) {
      projectListEl.appendChild(completeDropZone);
    }

    // Render trash
    renderTrash();
  }

  function renderTrash() {
    // Update trash count in sidebar button
    const count = state.trash ? state.trash.length : 0;
    trashCount.textContent = String(count);
    
    // Render modal list
    trashModalList.innerHTML = '';
    const { trash } = state;
    
    if (!trash || trash.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'trash-modal-empty';
      emptyEl.textContent = 'Trash is empty';
      trashModalList.appendChild(emptyEl);
      emptyTrashBtn.classList.add('hidden');
      return;
    }

    emptyTrashBtn.classList.remove('hidden');

    trash.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'trash-modal-item';

      const infoEl = document.createElement('div');
      infoEl.className = 'trash-item-info';

      const typeEl = document.createElement('span');
      typeEl.className = 'trash-item-type type-' + item.type;
      typeEl.textContent = item.type;

      const nameEl = document.createElement('span');
      nameEl.className = 'trash-item-name';
      nameEl.style.maxWidth = '150px';
      nameEl.textContent = item.name;

      infoEl.appendChild(nameEl);
      infoEl.appendChild(typeEl);

      const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - item.deletedAt) / 86400000));
      const daysEl = document.createElement('span');
      daysEl.className = 'trash-item-days';
      daysEl.textContent = `${daysLeft}d left`;

      const actionsEl = document.createElement('div');
      actionsEl.className = 'trash-actions';

      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'trash-restore-btn';
      restoreBtn.style.opacity = '0.6';
      restoreBtn.textContent = '↩';
      restoreBtn.title = 'Restore';
      restoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        restoreFromTrash(item.id);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'trash-delete-btn';
      deleteBtn.style.opacity = '0.6';
      deleteBtn.textContent = '✕';
      deleteBtn.title = 'Delete permanently';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        permanentlyDeleteFromTrash(item.id);
      });

      actionsEl.appendChild(restoreBtn);
      actionsEl.appendChild(deleteBtn);

      el.appendChild(infoEl);
      el.appendChild(daysEl);
      el.appendChild(actionsEl);

      trashModalList.appendChild(el);
    });
  }

  function permanentlyDeleteFromTrash(trashItemId) {
    state.trash = state.trash.filter(t => t.id !== trashItemId);
    saveState();
    renderTrash();
  }

  function restoreFromTrash(trashItemId) {
    const trashItem = state.trash.find(t => t.id === trashItemId);
    if (!trashItem) return;

    if (trashItem.type === 'task') {
      // Restore task
      const taskData = trashItem.data;
      // Check if the project still exists
      const projectExists = state.projects.some(p => p.id === taskData.projectId);
      if (projectExists) {
        state.tasks.push(taskData);
      } else {
        // Project was deleted, restore to first available project
        if (state.projects.length > 0) {
          taskData.projectId = state.projects[0].id;
          state.tasks.push(taskData);
        } else {
          alert('No project available to restore the task to.');
          return;
        }
      }
    } else if (trashItem.type === 'project') {
      // Restore project and its tasks
      const { project, tasks } = trashItem.data;
      state.projects.push(project);
      tasks.forEach(t => state.tasks.push(t));
      state.activeProjectId = project.id;
    }

    // Remove from trash
    state.trash = state.trash.filter(t => t.id !== trashItemId);
    saveState();
    renderAll();
  }

  function emptyTrash() {
    if (!state.trash || state.trash.length === 0) return;
    if (!confirm('Permanently delete all items in trash?')) return;
    state.trash = [];
    saveState();
    renderTrash();
  }

  function renderCalendar() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    calendarMonthLabel.textContent = `${monthNames[month]} ${year}`;

    // Get all tasks with deadlines
    const tasksWithDeadlines = state.tasks.filter(t => t.deadline);
    
    // Create a map of date -> tasks
    const tasksByDate = {};
    tasksWithDeadlines.forEach(task => {
      const dateKey = task.deadline; // Format: YYYY-MM-DD
      if (!tasksByDate[dateKey]) tasksByDate[dateKey] = [];
      const project = state.projects.find(p => p.id === task.projectId);
      tasksByDate[dateKey].push({
        ...task,
        projectName: project ? project.name : 'Unknown'
      });
    });

    // Build calendar grid
    calendarGrid.innerHTML = '';

    // Weekday headers
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    weekdays.forEach(day => {
      const el = document.createElement('div');
      el.className = 'calendar-weekday';
      el.textContent = day;
      calendarGrid.appendChild(el);
    });

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Today's date for highlighting
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const el = createCalendarDay(dayNum, true, null, null);
      calendarGrid.appendChild(el);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const dayTasks = tasksByDate[dateStr] || [];
      const el = createCalendarDay(day, false, isToday, dayTasks);
      calendarGrid.appendChild(el);
    }

    // Next month days to fill the grid
    const totalCells = firstDay + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remainingCells; i++) {
      const el = createCalendarDay(i, true, null, null);
      calendarGrid.appendChild(el);
    }
  }

  function createCalendarDay(dayNum, isOtherMonth, isToday, tasks) {
    const el = document.createElement('div');
    el.className = 'calendar-day';
    if (isOtherMonth) el.classList.add('other-month');
    if (isToday) el.classList.add('today');
    if (tasks && tasks.length > 0) el.classList.add('has-tasks');

    const numEl = document.createElement('div');
    numEl.className = 'calendar-day-num';
    numEl.textContent = dayNum;
    el.appendChild(numEl);

    if (tasks && tasks.length > 0) {
      const tasksEl = document.createElement('div');
      tasksEl.className = 'calendar-day-tasks';
      
      // Show up to 3 task dots
      const maxDots = 3;
      const sortedTasks = [...tasks].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      sortedTasks.slice(0, maxDots).forEach(task => {
        const dot = document.createElement('div');
        dot.className = `calendar-task-dot ${task.priority}`;
        tasksEl.appendChild(dot);
      });

      if (tasks.length > maxDots) {
        const more = document.createElement('div');
        more.style.fontSize = '8px';
        more.style.color = 'var(--text-dim);';
        more.style.textAlign = 'center';
        more.textContent = `+${tasks.length - maxDots}`;
        tasksEl.appendChild(more);
      }

      el.appendChild(tasksEl);

      // Tooltip on hover
      el.style.position = 'relative';
      el.style.cursor = 'pointer';
      
      el.addEventListener('mouseenter', (e) => {
        showCalendarTooltip(e, tasks);
      });
      el.addEventListener('mouseleave', hideCalendarTooltip);
    }

    return el;
  }

  let calendarTooltip = null;
  function showCalendarTooltip(e, tasks) {
    hideCalendarTooltip();
    
    calendarTooltip = document.createElement('div');
    calendarTooltip.className = 'calendar-day-tooltip';
    
    const titleEl = document.createElement('div');
    titleEl.className = 'calendar-day-tooltip-title';
    titleEl.textContent = `${tasks.length} task${tasks.length > 1 ? 's' : ''} due`;
    calendarTooltip.appendChild(titleEl);
    
    tasks.forEach(task => {
      const taskEl = document.createElement('div');
      taskEl.className = 'calendar-day-tooltip-task';
      
      const dot = document.createElement('div');
      dot.className = 'priority-dot';
      dot.style.background = task.priority === 'high' ? 'var(--danger)' : 
                              task.priority === 'medium' ? '#fbbf24' : '#60a5fa';
      
      const text = document.createElement('span');
      text.textContent = `${task.title} (${task.projectName})`;
      text.style.overflow = 'hidden';
      text.style.textOverflow = 'ellipsis';
      text.style.whiteSpace = 'nowrap';
      
      taskEl.appendChild(dot);
      taskEl.appendChild(text);
      calendarTooltip.appendChild(taskEl);
    });
    
    document.body.appendChild(calendarTooltip);
    
    // Position tooltip
    const rect = e.target.getBoundingClientRect();
    calendarTooltip.style.left = `${rect.left + rect.width / 2}px`;
    calendarTooltip.style.top = `${rect.bottom + 8}px`;
    calendarTooltip.style.transform = 'translateX(-50%)';
  }

  function hideCalendarTooltip() {
    if (calendarTooltip) {
      calendarTooltip.remove();
      calendarTooltip = null;
    }
  }

  // Full Calendar View (canvas-based)
  function renderCalendarView() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    calViewMonthLabel.textContent = `${monthNames[month]} ${year}`;

    // Get ALL tasks with deadlines (across all projects)
    const tasksWithDeadlines = state.tasks.filter(t => t.deadline);
    
    // Create a map of date -> tasks
    const tasksByDate = {};
    tasksWithDeadlines.forEach(task => {
      const dateKey = task.deadline;
      if (!tasksByDate[dateKey]) tasksByDate[dateKey] = [];
      const project = state.projects.find(p => p.id === task.projectId);
      tasksByDate[dateKey].push({
        ...task,
        projectName: project ? project.name : 'Unknown'
      });
    });

    // Build calendar grid
    calViewGrid.innerHTML = '';

    // Weekday headers
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    weekdays.forEach(day => {
      const el = document.createElement('div');
      el.className = 'calendar-view-weekday';
      el.textContent = day;
      calViewGrid.appendChild(el);
    });

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Today's date for highlighting
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayTasks = tasksByDate[dateStr] || [];
      const el = createCalendarViewDay(dayNum, dateStr, true, false, dayTasks);
      calViewGrid.appendChild(el);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const dayTasks = tasksByDate[dateStr] || [];
      const el = createCalendarViewDay(day, dateStr, false, isToday, dayTasks);
      calViewGrid.appendChild(el);
    }

    // Next month days to fill the grid
    const totalCells = firstDay + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayTasks = tasksByDate[dateStr] || [];
      const el = createCalendarViewDay(i, dateStr, true, false, dayTasks);
      calViewGrid.appendChild(el);
    }

    // Update day detail panel
    if (selectedCalendarDate) {
      renderCalendarDayDetail(selectedCalendarDate, tasksByDate[selectedCalendarDate] || []);
    }
  }

  function createCalendarViewDay(dayNum, dateStr, isOtherMonth, isToday, tasks) {
    const el = document.createElement('div');
    el.className = 'calendar-view-day';
    if (isOtherMonth) el.classList.add('other-month');
    if (isToday) el.classList.add('today');
    if (selectedCalendarDate === dateStr) el.classList.add('selected');

    const numEl = document.createElement('div');
    numEl.className = 'calendar-view-day-num';
    numEl.textContent = dayNum;
    el.appendChild(numEl);

    if (tasks && tasks.length > 0) {
      const tasksEl = document.createElement('div');
      tasksEl.className = 'calendar-view-day-tasks';
      
      const maxItems = 3;
      const sortedTasks = [...tasks].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      sortedTasks.slice(0, maxItems).forEach(task => {
        const item = document.createElement('div');
        item.className = `calendar-view-task-item ${task.priority}`;
        const span = document.createElement('span');
        span.textContent = task.title;
        item.appendChild(span);
        tasksEl.appendChild(item);
      });

      if (tasks.length > maxItems) {
        const more = document.createElement('div');
        more.className = 'calendar-view-more';
        more.textContent = `+${tasks.length - maxItems} more`;
        tasksEl.appendChild(more);
      }

      el.appendChild(tasksEl);
    }

    // Click to select day
    el.addEventListener('click', () => {
      selectedCalendarDate = dateStr;
      renderCalendarView();
      
      // Get tasks for the selected date
      const tasksWithDeadlines = state.tasks.filter(t => t.deadline === dateStr);
      const tasksWithProjects = tasksWithDeadlines.map(task => {
        const project = state.projects.find(p => p.id === task.projectId);
        return { ...task, projectName: project ? project.name : 'Unknown' };
      });
      renderCalendarDayDetail(dateStr, tasksWithProjects);
    });

    return el;
  }

  function renderCalendarDayDetail(dateStr, tasks) {
    calDayDetail.innerHTML = '';
    calDayDetail.classList.remove('empty');

    // Parse date
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Header
    const header = document.createElement('div');
    header.className = 'calendar-day-detail-header';
    header.innerHTML = `
      <span class="calendar-day-detail-date">${weekdays[date.getDay()]}, ${monthNames[month - 1]} ${day}</span>
      <span class="calendar-day-detail-count">${tasks.length} task${tasks.length !== 1 ? 's' : ''}</span>
    `;
    calDayDetail.appendChild(header);

    // Task list
    const list = document.createElement('div');
    list.className = 'calendar-day-detail-list';

    if (tasks.length === 0) {
      list.innerHTML = '<div style="text-align: center; color: var(--text-dim); padding: 20px; font-size: 12px;">No tasks due on this day</div>';
    } else {
      const sortedTasks = [...tasks].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      sortedTasks.forEach(task => {
        const taskEl = document.createElement('div');
        taskEl.className = 'calendar-detail-task';

        const headerEl = document.createElement('div');
        headerEl.className = 'calendar-detail-task-header';

        const priorityDot = document.createElement('div');
        priorityDot.className = `calendar-detail-task-priority ${task.priority}`;

        const titleEl = document.createElement('div');
        titleEl.className = 'calendar-detail-task-title';
        titleEl.textContent = task.title;

        headerEl.appendChild(priorityDot);
        headerEl.appendChild(titleEl);

        const projectEl = document.createElement('div');
        projectEl.className = 'calendar-detail-task-project';
        projectEl.textContent = task.projectName;

        const statusEl = document.createElement('span');
        statusEl.className = `calendar-detail-task-status ${task.status}`;
        statusEl.textContent = task.status.replace('_', ' ');

        taskEl.appendChild(headerEl);
        taskEl.appendChild(projectEl);
        taskEl.appendChild(statusEl);

        // Click to edit task
        taskEl.addEventListener('click', () => {
          // Find the original task from state
          const originalTask = state.tasks.find(t => t.id === task.id);
          if (originalTask) {
            openTaskModal(originalTask);
          }
        });

        list.appendChild(taskEl);
      });
    }

    calDayDetail.appendChild(list);
  }

  function toggleView(view) {
    currentView = view;
    if (view === 'kanban') {
      kanbanView.classList.remove('hidden');
      calendarView.classList.add('hidden');
      calendarBtn.innerHTML = '📅 Calendar';
    } else {
      kanbanView.classList.add('hidden');
      calendarView.classList.remove('hidden');
      calendarBtn.innerHTML = '📋 Board';
      renderCalendarView();
    }
  }

  function renderMain() {
    const activeProject = state.projects.find(p => p.id === state.activeProjectId);
    if (!activeProject) {
      activeProjectNameEl.textContent = 'No Project';
      projectStatsEl.textContent = '';
      Object.values(columnLists).forEach(listEl => listEl.innerHTML = '');
      return;
    }
    activeProjectNameEl.textContent = activeProject.name;

    const filterText = (searchInput.value || '').toLowerCase().trim();
    const projectTasks = state.tasks.filter(t => t.projectId === activeProject.id);

    // stats
    const total = projectTasks.length;
    const done = projectTasks.filter(t => t.status === 'done').length;
    const inProgress = projectTasks.filter(t => t.status === 'in_progress').length;
    
    // Format created date
    const createdDate = new Date(activeProject.createdAt);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const createdStr = `${monthNames[createdDate.getMonth()]} ${createdDate.getDate()}, ${createdDate.getFullYear()}`;
    
    projectStatsEl.textContent = `· ${done}/${total || 0} done · ${inProgress} in progress · created ${createdStr}`;

    // completion bar
    const completion = total === 0 ? 0 : Math.round((done / total) * 100);
    completionLabel.textContent = completion + '%';
    completionBar.style.transform = 'scaleX(' + (completion / 100) + ')';
    taskCountLabel.textContent = String(total);

    // clear columns
    Object.values(columnLists).forEach(listEl => {
      listEl.innerHTML = '';
    });

    const byStatus = { backlog: [], in_progress: [], done: [] };
    projectTasks.forEach(t => {
      if (filterText) {
        const combined = (t.title + ' ' + (t.description || '') + ' ' + (t.tags || []).join(' ')).toLowerCase();
        if (!combined.includes(filterText)) return;
      }
      if (!byStatus[t.status]) byStatus[t.status] = [];
      byStatus[t.status].push(t);
    });

    Object.keys(byStatus).forEach(status => {
      columnCounts[status].textContent = String(byStatus[status].length);
      byStatus[status].forEach(task => {
        const card = renderTaskCard(task);
        columnLists[status].appendChild(card);
      });
    });
  }

  function renderTaskCard(task) {
    const card = document.createElement('article');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.taskId = task.id;

    // Delete button (shown on hover)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'task-delete-btn';
    deleteBtn.textContent = '✕';
    deleteBtn.title = 'Delete task';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Move to trash
      state.trash.push({
        id: genId(),
        type: 'task',
        name: task.title || '(untitled)',
        data: { ...task },
        deletedAt: Date.now()
      });
      state.tasks = state.tasks.filter(t => t.id !== task.id);
      saveState();
      renderAll();
    });
    card.appendChild(deleteBtn);

    const titleEl = document.createElement('div');
    titleEl.className = 'task-title';
    titleEl.textContent = task.title || '(untitled)';

    const descEl = document.createElement('div');
    descEl.className = 'task-description';
    descEl.textContent = task.description || '';

    const tagsEl = document.createElement('div');
    tagsEl.className = 'task-tags';
    (task.tags || []).forEach(tag => {
      if (!tag) return;
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = tag;
      tagsEl.appendChild(span);
    });

    const metaEl = document.createElement('div');
    metaEl.className = 'task-meta';

    const priorityEl = document.createElement('span');
    priorityEl.className = 'task-priority priority-' + (task.priority || 'medium');
    priorityEl.textContent = (task.priority || 'medium').toUpperCase();

    metaEl.appendChild(priorityEl);

    if (task.deadline) {
      const dateEl = document.createElement('span');
      dateEl.className = 'task-date';
      dateEl.textContent = '⏰ ' + task.deadline;
      // Highlight overdue tasks
      const today = new Date().toISOString().split('T')[0];
      if (task.deadline < today && task.status !== 'done') {
        dateEl.style.color = 'var(--danger)';
      }
      metaEl.appendChild(dateEl);
    }

    card.appendChild(titleEl);
    if (task.description) card.appendChild(descEl);
    if (task.tags && task.tags.length) card.appendChild(tagsEl);
    card.appendChild(metaEl);

    card.addEventListener('click', (e) => {
      // avoid triggering when dragging
      if (card._dragging) return;
      openTaskModal(task);
    });

    card.addEventListener('dragstart', (e) => {
      card._dragging = true;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', task.id);
      setTimeout(() => {
        card.style.opacity = '0.2';
      }, 0);
    });

    card.addEventListener('dragend', () => {
      card._dragging = false;
      card.style.opacity = '';
      clearDropHighlights();
    });

    return card;
  }

  function clearDropHighlights() {
    document.querySelectorAll('.column').forEach(col => {
      col.classList.remove('drop-highlight');
    });
  }

  function renderAll() {
    renderSidebar();
    renderMain();
    // Also refresh calendar if it's visible
    if (currentView === 'calendar') {
      renderCalendarView();
    }
  }

  // Modal logic

  function openTaskModal(task, opts) {
    editingTaskId = task ? task.id : null;
    defaultStatusForNewTask = (opts && opts.defaultStatus) || 'backlog';

    if (task) {
      modalModeLabel.textContent = '· edit';
      taskTitleInput.value = task.title || '';
      taskDescInput.value = task.description || '';
      taskPrioritySelect.value = task.priority || 'medium';
      taskTagsInput.value = (task.tags || []).join(', ');
      taskDeadlineInput.value = task.deadline || '';
      taskCreatedAtLabel.textContent = formatDate(task.createdAt);
      deleteTaskBtn.classList.remove('hidden');
    } else {
      modalModeLabel.textContent = '· new';
      taskTitleInput.value = '';
      taskDescInput.value = '';
      taskPrioritySelect.value = 'medium';
      taskTagsInput.value = '';
      taskDeadlineInput.value = '';
      taskCreatedAtLabel.textContent = 'now';
      deleteTaskBtn.classList.add('hidden');
    }

    modalBackdrop.classList.remove('hidden');
    taskModal.classList.remove('hidden');
    setTimeout(() => {
      taskTitleInput.focus();
    }, 0);
  }

  function closeTaskModal() {
    modalBackdrop.classList.add('hidden');
    taskModal.classList.add('hidden');
  }

  function saveTaskFromModal() {
    const title = taskTitleInput.value.trim();
    const desc = taskDescInput.value.trim();
    const priority = taskPrioritySelect.value || 'medium';
    const tags = taskTagsInput.value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    const deadline = taskDeadlineInput.value || null;

    if (!title) {
      alert('Title cannot be empty');
      taskTitleInput.focus();
      return;
    }

    const projectId = state.activeProjectId;
    if (!projectId) {
      alert('Please create a project first');
      return;
    }

    if (editingTaskId) {
      const task = state.tasks.find(t => t.id === editingTaskId);
      if (!task) return;
      task.title = title;
      task.description = desc;
      task.priority = priority;
      task.tags = tags;
      task.deadline = deadline;
    } else {
      const newTask = {
        id: genId(),
        projectId,
        title,
        description: desc,
        status: defaultStatusForNewTask,
        priority,
        tags,
        deadline,
        createdAt: Date.now()
      };
      state.tasks.push(newTask);
    }

    saveState();
    renderAll();
    closeTaskModal();
  }

  function deleteTask() {
    if (!editingTaskId) return;
    const task = state.tasks.find(t => t.id === editingTaskId);
    if (task) {
      // Move to trash
      state.trash.push({
        id: genId(),
        type: 'task',
        name: task.title || '(untitled)',
        data: { ...task },
        deletedAt: Date.now()
      });
    }
    state.tasks = state.tasks.filter(t => t.id !== editingTaskId);
    saveState();
    renderAll();
    closeTaskModal();
  }

  function markProjectComplete(projectId) {
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;
    
    // Check if all tasks are in done status
    const projectTasks = state.tasks.filter(t => t.projectId === projectId);
    const backlogCount = projectTasks.filter(t => t.status === 'backlog').length;
    const inProgressCount = projectTasks.filter(t => t.status === 'in_progress').length;
    
    if (backlogCount > 0 || inProgressCount > 0) {
      alert(`Cannot mark as complete: ${backlogCount} task(s) in Backlog, ${inProgressCount} task(s) in Progress. All tasks must be Done.`);
      return;
    }
    
    project.completed = true;
    project.completedAt = Date.now();
    
    // If this was the active project, switch to another non-completed project
    if (state.activeProjectId === projectId) {
      const activeProject = state.projects.find(p => !p.completed && p.id !== projectId);
      if (activeProject) {
        state.activeProjectId = activeProject.id;
      }
    }
    
    saveState();
    renderAll();
  }

  function deleteProject(projectId) {
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;
    const projectTasks = state.tasks.filter(t => t.projectId === projectId);
    
    // Move project and its tasks to trash
    state.trash.push({
      id: genId(),
      type: 'project',
      name: project.name,
      data: { project: { ...project }, tasks: projectTasks.map(t => ({ ...t })) },
      deletedAt: Date.now()
    });
    
    // Remove all tasks in this project
    state.tasks = state.tasks.filter(t => t.projectId !== projectId);
    // Remove the project
    state.projects = state.projects.filter(p => p.id !== projectId);
    
    // If we deleted the active project, switch to another or create default
    if (state.activeProjectId === projectId) {
      if (state.projects.length > 0) {
        state.activeProjectId = state.projects[0].id;
      } else {
        // Create a new default project
        const newId = genId();
        state.projects.push({ id: newId, name: 'Default Project', createdAt: Date.now() });
        state.activeProjectId = newId;
      }
    }
    
    saveState();
    renderAll();
  }

  // New Project Modal functions
  function openNewProjectModal() {
    newProjectNameInput.value = '';
    // Populate group select
    newProjectGroupSelect.innerHTML = '<option value="">— No group —</option>';
    state.groups.forEach(group => {
      const opt = document.createElement('option');
      opt.value = group.id;
      opt.textContent = group.name;
      newProjectGroupSelect.appendChild(opt);
    });
    modalBackdrop.classList.remove('hidden');
    newProjectModal.classList.remove('hidden');
    newProjectNameInput.focus();
  }

  function closeNewProjectModal() {
    modalBackdrop.classList.add('hidden');
    newProjectModal.classList.add('hidden');
  }

  function saveNewProject() {
    const name = newProjectNameInput.value.trim();
    if (!name) return;
    const groupId = newProjectGroupSelect.value || undefined;
    const id = genId();
    const project = { id, name, createdAt: Date.now() };
    if (groupId) project.groupId = groupId;
    state.projects.push(project);
    state.activeProjectId = id;
    saveState();
    closeNewProjectModal();
    if (currentView === 'calendar') {
      toggleView('kanban');
    } else {
      renderAll();
    }
  }

  // New Group Modal functions
  function openNewGroupModal() {
    newGroupNameInput.value = '';
    modalBackdrop.classList.remove('hidden');
    newGroupModal.classList.remove('hidden');
    newGroupNameInput.focus();
  }

  function closeNewGroupModal() {
    modalBackdrop.classList.add('hidden');
    newGroupModal.classList.add('hidden');
  }

  function saveNewGroup() {
    const name = newGroupNameInput.value.trim();
    if (!name) return;
    const id = genId();
    state.groups.push({ id, name, collapsed: false });
    saveState();
    closeNewGroupModal();
    renderSidebar();
  }

  // Rename Project Modal functions
  function openRenameProjectModal(project) {
    renameProjectId = project.id;
    renameProjectInput.value = project.name;
    modalBackdrop.classList.remove('hidden');
    renameProjectModal.classList.remove('hidden');
    renameProjectInput.focus();
    renameProjectInput.select();
  }

  function closeRenameProjectModal() {
    modalBackdrop.classList.add('hidden');
    renameProjectModal.classList.add('hidden');
    renameProjectId = null;
  }

  function saveRenameProject() {
    const name = renameProjectInput.value.trim();
    if (!name || !renameProjectId) return;
    const project = state.projects.find(p => p.id === renameProjectId);
    if (project) {
      project.name = name;
      saveState();
      renderAll();
    }
    closeRenameProjectModal();
  }

  // Events

  newTaskBtn.addEventListener('click', () => openTaskModal(null));

  searchInput.addEventListener('input', () => {
    renderMain();
  });

  closeModalBtn.addEventListener('click', closeTaskModal);
  modalBackdrop.addEventListener('click', () => {
    closeTaskModal();
    shortcutsModal.classList.add('hidden');
    settingsModal.classList.add('hidden');
    newProjectModal.classList.add('hidden');
    newGroupModal.classList.add('hidden');
    renameProjectModal.classList.add('hidden');
    renameProjectId = null;
  });
  saveTaskBtn.addEventListener('click', saveTaskFromModal);
  deleteTaskBtn.addEventListener('click', deleteTask);

  // Rename Project Modal events
  closeRenameProjectBtn.addEventListener('click', closeRenameProjectModal);
  cancelRenameProjectBtn.addEventListener('click', closeRenameProjectModal);
  saveRenameProjectBtn.addEventListener('click', saveRenameProject);
  renameProjectInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveRenameProject();
    } else if (e.key === 'Escape') {
      closeRenameProjectModal();
    }
  });

  // Shortcuts modal
  shortcutsBtn.addEventListener('click', () => {
    modalBackdrop.classList.remove('hidden');
    shortcutsModal.classList.remove('hidden');
  });
  closeShortcutsBtn.addEventListener('click', () => {
    modalBackdrop.classList.add('hidden');
    shortcutsModal.classList.add('hidden');
  });

  // Projects section toggle
  projectsToggle.addEventListener('click', () => {
    projectListEl.classList.toggle('collapsed');
    projectsArrow.classList.toggle('collapsed');
  });

  // Trash modal
  trashBtn.addEventListener('click', () => {
    renderTrash();
    modalBackdrop.classList.remove('hidden');
    trashModal.classList.remove('hidden');
  });
  closeTrashBtn.addEventListener('click', () => {
    modalBackdrop.classList.add('hidden');
    trashModal.classList.add('hidden');
  });

  // Empty trash button
  emptyTrashBtn.addEventListener('click', () => {
    emptyTrash();
  });

  // Settings modal
  settingsBtn.addEventListener('click', () => {
    modalBackdrop.classList.remove('hidden');
    settingsModal.classList.remove('hidden');
  });
  closeSettingsBtn.addEventListener('click', () => {
    modalBackdrop.classList.add('hidden');
    settingsModal.classList.add('hidden');
  });
  themeDarkBtn.addEventListener('click', () => {
    setTheme('dark');
  });
  themeLightBtn.addEventListener('click', () => {
    setTheme('light');
  });
  resetLayoutBtn.addEventListener('click', () => {
    resetLayout();
  });

  // New Project modal
  closeNewProjectBtn.addEventListener('click', closeNewProjectModal);
  cancelNewProjectBtn.addEventListener('click', closeNewProjectModal);
  saveNewProjectBtn.addEventListener('click', saveNewProject);
  newProjectNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveNewProject();
  });

  // New Group modal
  closeNewGroupBtn.addEventListener('click', closeNewGroupModal);
  cancelNewGroupBtn.addEventListener('click', closeNewGroupModal);
  saveNewGroupBtn.addEventListener('click', saveNewGroup);
  newGroupNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveNewGroup();
  });

  // Calendar view toggle
  calendarBtn.addEventListener('click', () => {
    if (currentView === 'kanban') {
      calendarDate = new Date(); // Reset to current month
      selectedCalendarDate = null;
      toggleView('calendar');
    } else {
      toggleView('kanban');
    }
  });
  calViewPrevBtn.addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendarView();
  });
  calViewNextBtn.addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendarView();
  });
  calViewTodayBtn.addEventListener('click', () => {
    calendarDate = new Date();
    const today = new Date();
    selectedCalendarDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    renderCalendarView();
    // Also show today's tasks in detail panel
    const tasksWithDeadlines = state.tasks.filter(t => t.deadline === selectedCalendarDate);
    const tasksWithProjects = tasksWithDeadlines.map(task => {
      const project = state.projects.find(p => p.id === task.projectId);
      return { ...task, projectName: project ? project.name : 'Unknown' };
    });
    renderCalendarDayDetail(selectedCalendarDate, tasksWithProjects);
  });

  document.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement && document.activeElement.tagName;
    const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA';
    const isTaskModalOpen = !taskModal.classList.contains('hidden');
    const isShortcutsModalOpen = !shortcutsModal.classList.contains('hidden');
    const isTrashModalOpen = !trashModal.classList.contains('hidden');
    const isSettingsModalOpen = !settingsModal.classList.contains('hidden');
    const isNewProjectModalOpen = !newProjectModal.classList.contains('hidden');
    const isNewGroupModalOpen = !newGroupModal.classList.contains('hidden');

    // Cmd/Ctrl + Enter to save when task modal is open
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && isTaskModalOpen) {
      saveTaskFromModal();
      e.preventDefault();
      return;
    }

    if (e.key === 'Escape') {
      if (isTaskModalOpen) {
        closeTaskModal();
        e.preventDefault();
      } else if (isNewProjectModalOpen) {
        closeNewProjectModal();
        e.preventDefault();
      } else if (isNewGroupModalOpen) {
        closeNewGroupModal();
        e.preventDefault();
      } else if (isShortcutsModalOpen) {
        modalBackdrop.classList.add('hidden');
        shortcutsModal.classList.add('hidden');
        e.preventDefault();
      } else if (isTrashModalOpen) {
        modalBackdrop.classList.add('hidden');
        trashModal.classList.add('hidden');
        e.preventDefault();
      } else if (isSettingsModalOpen) {
        modalBackdrop.classList.add('hidden');
        settingsModal.classList.add('hidden');
        e.preventDefault();
      } else if (currentView === 'calendar') {
        toggleView('kanban');
        e.preventDefault();
      }
      return;
    }

    if (isTyping) return;

    if (e.key === 'n') {
      openTaskModal(null);
      e.preventDefault();
    } else if (e.key === '/') {
      searchInput.focus();
      searchInput.select();
      e.preventDefault();
    } else if (e.key === 'p') {
      // Trigger new project modal
      openNewProjectModal();
      e.preventDefault();
    }
  });

  // Drag & Drop

  document.querySelectorAll('.column').forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drop-highlight');
      e.dataTransfer.dropEffect = 'move';
    });
    col.addEventListener('dragleave', () => {
      col.classList.remove('drop-highlight');
    });
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/plain');
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;
      const newStatus = col.getAttribute('data-status');
      if (!newStatus) return;
      task.status = newStatus;
      saveState();
      clearDropHighlights();
      renderAll();
    });
  });

  // ===== Resizable panels =====
  const sidebar = document.querySelector('.sidebar');
  const sidebarResizer = document.getElementById('sidebarResizer');
  const columns = document.querySelectorAll('.column');
  const columnResizers = document.querySelectorAll('.column-resizer');

  // Sidebar resizer
  let isResizingSidebar = false;
  sidebarResizer.addEventListener('mousedown', (e) => {
    isResizingSidebar = true;
    sidebarResizer.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  // Column resizers
  let activeColumnResizer = null;
  let columnIndex = -1;
  columnResizers.forEach((resizer, idx) => {
    resizer.addEventListener('mousedown', (e) => {
      activeColumnResizer = resizer;
      columnIndex = idx;
      resizer.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
  });

  document.addEventListener('mousemove', (e) => {
    if (isResizingSidebar) {
      const newWidth = e.clientX - 10; // account for padding
      if (newWidth >= 180 && newWidth <= 400) {
        sidebar.style.width = newWidth + 'px';
      }
    }
    
    if (activeColumnResizer !== null && columnIndex >= 0) {
      const kanban = document.getElementById('kanbanView');
      const kanbanRect = kanban.getBoundingClientRect();
      const columnsArr = Array.from(columns);
      
      // Calculate relative position within kanban
      const relativeX = e.clientX - kanbanRect.left;
      const totalWidth = kanbanRect.width;
      
      // Get current flex values
      const flexValues = columnsArr.map(col => {
        const computed = parseFloat(getComputedStyle(col).flexGrow) || 1;
        return computed;
      });
      
      // Calculate target widths based on mouse position
      const resizerPositions = [];
      let accWidth = 0;
      for (let i = 0; i < columnsArr.length - 1; i++) {
        accWidth += columnsArr[i].getBoundingClientRect().width + 8; // 8 for resizer
        resizerPositions.push(accWidth);
      }
      
      // Adjust flex based on drag
      const col1 = columnsArr[columnIndex];
      const col2 = columnsArr[columnIndex + 1];
      const col1Rect = col1.getBoundingClientRect();
      const col2Rect = col2.getBoundingClientRect();
      
      const combinedWidth = col1Rect.width + col2Rect.width;
      const newCol1Width = e.clientX - col1Rect.left;
      const newCol2Width = combinedWidth - newCol1Width;
      
      if (newCol1Width >= 120 && newCol2Width >= 120) {
        const ratio1 = newCol1Width / combinedWidth;
        const ratio2 = newCol2Width / combinedWidth;
        const totalFlex = flexValues[columnIndex] + flexValues[columnIndex + 1];
        
        col1.style.flex = (totalFlex * ratio1).toFixed(3);
        col2.style.flex = (totalFlex * ratio2).toFixed(3);
      }
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizingSidebar) {
      isResizingSidebar = false;
      sidebarResizer.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Save sidebar width
      saveLayout();
    }
    if (activeColumnResizer) {
      activeColumnResizer.classList.remove('active');
      activeColumnResizer = null;
      columnIndex = -1;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Save column flex values
      saveLayout();
    }
  });

  // Theme functions
  function setTheme(theme) {
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light');
      themeLightBtn.classList.add('active');
      themeDarkBtn.classList.remove('active');
    } else {
      document.documentElement.classList.remove('theme-light');
      themeDarkBtn.classList.add('active');
      themeLightBtn.classList.remove('active');
    }
    localStorage.setItem('geekboard_theme', theme);
  }

  function loadTheme() {
    const savedTheme = localStorage.getItem('geekboard_theme') || 'dark';
    setTheme(savedTheme);
  }

  function resetLayout() {
    // Reset sidebar width
    sidebar.style.width = '260px';
    
    // Reset column flex values
    const columns = document.querySelectorAll('.column');
    columns.forEach(col => {
      col.style.flex = '1';
    });
    
    // Clear saved layout
    localStorage.removeItem('geekboard_layout');
    
    // Show confirmation feedback
    resetLayoutBtn.textContent = 'Done!';
    resetLayoutBtn.style.color = 'var(--accent)';
    setTimeout(() => {
      resetLayoutBtn.textContent = 'Reset';
      resetLayoutBtn.style.color = '';
    }, 1200);
  }

  function saveLayout() {
    const columns = document.querySelectorAll('.column');
    const columnFlex = Array.from(columns).map(col => col.style.flex || '1');
    const layout = {
      sidebarWidth: sidebar.style.width || '260px',
      columnFlex: columnFlex
    };
    localStorage.setItem('geekboard_layout', JSON.stringify(layout));
  }

  function loadLayout() {
    const saved = localStorage.getItem('geekboard_layout');
    if (saved) {
      try {
        const layout = JSON.parse(saved);
        if (layout.sidebarWidth) {
          sidebar.style.width = layout.sidebarWidth;
        }
        if (layout.columnFlex && layout.columnFlex.length === 3) {
          const columns = document.querySelectorAll('.column');
          columns.forEach((col, i) => {
            col.style.flex = layout.columnFlex[i];
          });
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  // Load saved theme on startup
  loadTheme();
  
  // Load saved layout on startup
  loadLayout();

  // Initial render
  renderAll();
})();
