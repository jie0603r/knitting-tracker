// ==========================================
// 1. Firebase 雲端資料庫初始化
// ==========================================
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const syncRoomId = "my-knitting-room";
const dbRef = database.ref(`knitting_apps/${syncRoomId}`);

// ==========================================
// 2. 全局資料狀態與 DOM 變數宣告
// ==========================================
let projects = [];
let currentProjectId = null;
let currentCreateType = 'knitting'; 
let currentUnit = 'row'; 
let draggedIndex = null; // 記錄目前被拖曳的區塊索引

let projectList, addProjectBtn, currentProjectTitle;
let sectionNameInput, totalRowsInput, totalInputLabel, unitToggleBtn, addBtn, counterList;
let sidebar;
let importJsonBtn, jsonFileInput;

// ==========================================
// 3. 核心資料儲存與側邊欄切換邏輯
// ==========================================
function saveToStorage() {
  dbRef.set({
    projects: projects,
    currentProjectId: currentProjectId,
    updatedAt: Date.now()
  });
}

function calculateDefaultReminders(total, interval, startRow) {
  const reminders = [];
  if (interval <= 0) return reminders;
  for (let i = 1; i <= total; i++) {
    if (i >= startRow && (i - startRow) % interval === 0) {
      reminders.push(i);
    }
  }
  return reminders;
}

function toggleSidebar() {
  if (sidebar) {
    sidebar.classList.toggle('collapsed');
  }
}

function listenToCloudStorage() {
  dbRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      projects = data.projects || [];
      
      projects.forEach(p => {
        if (!p.sections) p.sections = [];
        p.sections.forEach(s => {
          if (!s.type) s.type = 'knitting';
          if (!s.unit) s.unit = 'row';
          if (s.hasReminder === undefined) s.hasReminder = false;
          if (s.actionType === undefined) s.actionType = 'increase';
          if (s.interval === undefined) s.interval = 4;
          if (s.startRow === undefined) s.startRow = 1;
          if (s.notes === undefined) s.notes = "";
          if (s.mode === undefined) s.mode = 'progress';
          if (s.isLocked === undefined) s.isLocked = false;
          if (!Array.isArray(s.customReminders)) {
            s.customReminders = calculateDefaultReminders(s.total, s.interval, s.startRow);
          }
        });
      });

      currentProjectId = data.currentProjectId || (projects[0] ? projects[0].id : null);
    } else {
      projects = [{
        id: Date.now(),
        name: '我的第一件編織作品',
        sections: []
      }];
      currentProjectId = projects[0].id;
      saveToStorage();
    }
    render();
  }, (error) => {
    console.error("雲端讀取失敗：", error);
  });
}

// ==========================================
// 4. 網頁初始化與 DOM 綁定
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  projectList = document.getElementById('project-list');
  addProjectBtn = document.getElementById('add-project-btn');
  currentProjectTitle = document.getElementById('current-project-title');
  sectionNameInput = document.getElementById('section-name');
  totalRowsInput = document.getElementById('total-rows');
  totalInputLabel = document.getElementById('total-input-label');
  unitToggleBtn = document.getElementById('unit-toggle-btn');
  addBtn = document.getElementById('add-btn');
  counterList = document.getElementById('counter-list');
  sidebar = document.getElementById('sidebar');

  importJsonBtn = document.getElementById('import-json-btn');
  jsonFileInput = document.getElementById('json-file-input');

  const menuBtn = document.getElementById('menu-btn');
  const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');

  if (menuBtn) menuBtn.addEventListener('click', toggleSidebar);
  if (toggleSidebarBtn) toggleSidebarBtn.addEventListener('click', toggleSidebar);

  if (addProjectBtn) addProjectBtn.addEventListener('click', handleAddProject);
  if (addBtn) addBtn.addEventListener('click', handleAddSection);

  if (importJsonBtn && jsonFileInput) {
    importJsonBtn.addEventListener('click', () => jsonFileInput.click());
    jsonFileInput.addEventListener('change', handleJsonImport);
  }

  firebase.auth().signInAnonymously()
    .then((userCredential) => {
      console.log("Firebase 身份驗證成功！UID:", userCredential.user.uid);
      listenToCloudStorage();
    })
    .catch((error) => {
      console.error("Firebase 身份驗證詳細錯誤：", error.code, error.message);
      alert(`資料庫連線失敗 [${error.code}]：${error.message}`);
    });
});

// ==========================================
// 5. JSON 檔案匯入處理邏輯
// ==========================================
function handleJsonImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      processImportedProjects(importedData);
      event.target.value = '';
    } catch (err) {
      alert('JSON 檔案解析失敗！請確認檔案格式是否正確。');
      console.error('JSON Parse Error:', err);
    }
  };
  reader.readAsText(file);
}

function processImportedProjects(data) {
  let newProjectsList = [];

  if (data.projects && Array.isArray(data.projects)) {
    newProjectsList = data.projects;
  } else if (data.name && Array.isArray(data.sections)) {
    newProjectsList = [data];
  } else {
    alert('匯入失敗：JSON 結構不符合格式需求。');
    return;
  }

  let lastAddedProjectId = null;
  const now = Date.now();

  newProjectsList.forEach((proj, pIdx) => {
    const newProjectId = now + pIdx;
    const processedSections = (proj.sections || []).map((sec, sIdx) => {
      return {
        id: now + (pIdx + 1) * 1000 + sIdx,
        type: sec.type || 'knitting',
        unit: sec.unit || 'row',
        name: sec.name || '未命名區塊',
        current: sec.current || 0,
        total: sec.total || 1,
        hasReminder: sec.hasReminder !== undefined ? sec.hasReminder : false,
        actionType: sec.actionType || 'increase',
        interval: sec.interval || 4,
        startRow: sec.startRow || 1,
        customReminders: Array.isArray(sec.customReminders) ? sec.customReminders : [],
        mode: sec.mode || 'progress',
        notes: sec.notes || '',
        isLocked: sec.isLocked !== undefined ? sec.isLocked : false
      };
    });

    const newProject = {
      id: newProjectId,
      name: proj.name || '匯入的作品',
      sections: processedSections
    };

    projects.push(newProject);
    lastAddedProjectId = newProjectId;
  });

  if (lastAddedProjectId) {
    currentProjectId = lastAddedProjectId;
    saveToStorage();
    alert(`成功匯入 ${newProjectsList.length} 個作品！`);
  }
}

// ==========================================
// 6. 單位與類型切換
// ==========================================
window.toggleUnit = function() {
  currentUnit = (currentUnit === 'row') ? 'cm' : 'row';
  if (currentUnit === 'row') {
    unitToggleBtn.textContent = '行';
    totalRowsInput.placeholder = '例如：23';
  } else {
    unitToggleBtn.textContent = 'cm';
    totalRowsInput.placeholder = '例如：15';
  }
};

window.switchCreateType = function(type) {
  currentCreateType = type;
  const btnKnitting = document.getElementById('btn-type-knitting');
  const btnCheck = document.getElementById('btn-type-check');

  if (type === 'knitting') {
    btnKnitting.classList.add('active');
    btnCheck.classList.remove('active');
    totalInputLabel.textContent = "目標總數：";
    totalRowsInput.placeholder = currentUnit === 'row' ? "例如：23" : "例如：15";
    unitToggleBtn.style.display = "inline-block";
    addBtn.textContent = "建立編織區塊";
  } else {
    btnCheck.classList.add('active');
    btnKnitting.classList.remove('active');
    totalInputLabel.textContent = "目標總針數：";
    totalRowsInput.placeholder = "例如：80";
    unitToggleBtn.style.display = "none";
    addBtn.textContent = "建立針數檢查";
  }
};

// ==========================================
// 7. 作品管理邏輯
// ==========================================
function handleAddProject() {
  const name = prompt('請輸入新作品名稱：');
  if (name && name.trim() !== '') {
    const newProject = {
      id: Date.now(),
      name: name.trim(),
      sections: []
    };

    projects.push(newProject);
    currentProjectId = newProject.id;
    saveToStorage();
  }
}

window.selectProject = function(id) {
  currentProjectId = id;
  saveToStorage();
};

window.editProjectById = function(id, event) {
  event.stopPropagation();
  const project = projects.find(p => p.id === id);
  if (!project) return;

  const newName = prompt('請輸入新的作品名稱：', project.name);
  if (newName && newName.trim() !== '') {
    project.name = newName.trim();
    saveToStorage();
  }
};

window.deleteProjectById = function(id, event) {
  event.stopPropagation();
  const project = projects.find(p => p.id === id);
  if (!project) return;

  if (confirm(`確定要刪除作品「${project.name}」嗎？`)) {
    projects = projects.filter(p => p.id !== id);

    if (projects.length > 0) {
      currentProjectId = projects[0].id;
    } else {
      const defaultProject = {
        id: Date.now(),
        name: '我的第一件編織作品',
        sections: []
      };
      projects = [defaultProject];
      currentProjectId = defaultProject.id;
    }

    saveToStorage();
  }
};

// ==========================================
// 8. 拖曳排序核心邏輯
// ==========================================
function reorderSections(fromIndex, toIndex) {
  const currentProject = projects.find(p => p.id === currentProjectId);
  if (!currentProject || !currentProject.sections) return;

  // 移動陣列位置
  const [movedSection] = currentProject.sections.splice(fromIndex, 1);
  currentProject.sections.splice(toIndex, 0, movedSection);

  saveToStorage();
}

// ==========================================
// 9. 區塊建立與渲染邏輯
// ==========================================
function handleAddSection() {
  const name = sectionNameInput.value.trim();
  const total = parseInt(totalRowsInput.value);

  if (!name || isNaN(total) || total <= 0) {
    const errorMsg = currentCreateType === 'knitting' ? '請輸入有效的區塊名稱與目標總數！' : '請輸入有效的區塊名稱與目標總針數！';
    alert(errorMsg);
    return;
  }

  const currentProject = projects.find(p => p.id === currentProjectId);
  if (!currentProject) return;

  if (!currentProject.sections) {
    currentProject.sections = [];
  }

  const defaultInterval = 4;
  const defaultStart = 1;

  const newSection = {
    id: Date.now(),
    type: currentCreateType,
    unit: currentCreateType === 'check' ? 'stitch' : currentUnit,
    name: name,
    current: 0,
    total: total,
    hasReminder: false,
    actionType: 'increase',
    interval: defaultInterval,
    startRow: defaultStart,
    customReminders: calculateDefaultReminders(total, defaultInterval, defaultStart),
    mode: 'progress',
    notes: "",
    isLocked: false
  };

  currentProject.sections.push(newSection);
  sectionNameInput.value = '';
  totalRowsInput.value = '';

  saveToStorage();
}

function render() {
  if (!projectList || !counterList) return;

  projectList.innerHTML = '';
  projects.forEach(p => {
    const li = document.createElement('li');
    const isActive = p.id === currentProjectId;
    li.className = `project-item ${isActive ? 'active' : ''}`;
    li.onclick = () => selectProject(p.id);

    li.innerHTML = `
      <span class="project-name">🧵 ${p.name}</span>
      <div class="project-item-tools">
        <button class="btn-tool" onclick="editProjectById(${p.id}, event)" title="修改名稱">✏</button>
        <button class="btn-tool" onclick="deleteProjectById(${p.id}, event)" title="刪除作品">🗑️</button>
      </div>
    `;
    projectList.appendChild(li);
  });

  const currentProject = projects.find(p => p.id === currentProjectId);
  if (!currentProject) return;

  if (!currentProject.sections) currentProject.sections = [];

  currentProjectTitle.textContent = `${currentProject.name}`;
  counterList.innerHTML = '';

  if (currentProject.sections.length === 0) {
    counterList.innerHTML = `
      <p style="text-align: center; color: #636e72; padding: 20px 0;">
        此作品目前沒有任何區塊，請在上方建立或匯入織圖！
      </p>`;
    return;
  }

  currentProject.sections.forEach((section, index) => {
    const isCheckType = section.type === 'check';
    const isCmUnit = section.unit === 'cm';
    const isCompleted = section.current >= section.total;
    
    let statusText = isCheckType ? '🔍 待檢查' : '進行中';
    if (section.isLocked) {
      statusText = '🔒 已鎖定';
    } else if (!isCheckType && isCompleted) {
      statusText = '🎉 已完成';
    }
    const statusClass = (isCompleted || section.isLocked) ? 'status-badge completed' : 'status-badge';

    const lockIcon = section.isLocked ? '🔒' : '🔓';
    const lockTitle = section.isLocked ? '解鎖區塊' : '鎖定區塊';
    const lockedCardStyle = section.isLocked ? 'opacity: 0.6; background-color: #f7f9fa;' : '';

    const card = document.createElement('div');
    card.className = 'counter-card';
    card.style.cssText = lockedCardStyle;
    card.setAttribute('draggable', 'true');
    card.dataset.index = index;

    // 拖曳事件綁定
    card.addEventListener('dragstart', (e) => {
      draggedIndex = index;
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      if (draggedIndex !== null && draggedIndex !== index) {
        reorderSections(draggedIndex, index);
      }
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.counter-card').forEach(c => c.classList.remove('drag-over'));
      draggedIndex = null;
    });

    if (isCheckType) {
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-group">
            <span class="drag-handle" title="按住拖曳排序">⠿</span>
            <h3>🔍 ${section.name}</h3>
            <span class="${statusClass}">${statusText}</span>
          </div>
          <div class="card-tools">
            <button class="btn-tool" onclick="editSectionName(${section.id})" title="編輯名稱">✏️</button>
            <button class="btn-tool" onclick="copySection(${section.id})" title="複製區塊">📋</button>
            <button class="btn-tool" onclick="toggleLockSection(${section.id})" title="${lockTitle}">${lockIcon}</button>
            <button class="btn-tool" onclick="deleteSection(${section.id})" title="刪除">🗑️</button>
          </div>
        </div>

        <div class="stitch-check-box">
          <div class="stitch-check-number">${section.total} 針</div>
          <div class="stitch-check-label">請確認手上針數與提醒一致</div>
        </div>

        <div class="card-notes-area">
          <textarea placeholder="📝 填寫區塊筆記 (例: 針數正確後鎖定繼續...)" 
                    onchange="updateSectionNotes(${section.id}, this.value)">${section.notes || ''}</textarea>
        </div>
      `;
    } else {
      let reminderBarHTML = '';
      let modeSwitchBarHTML = '';
      let gridHTML = '';

      if (!isCmUnit) {
        if (!section.hasReminder) {
          reminderBarHTML = `
            <div class="reminder-toggle-bar">
              <button class="btn-add-reminder" onclick="toggleReminder(${section.id}, true)">
                + 新增加減針提醒
              </button>
            </div>`;
        } else {
          reminderBarHTML = `
            <div class="card-setting-bar">
              <span>⚠️ 提醒：</span>
              <select onchange="updateSectionActionType(${section.id}, this.value)">
                <option value="increase" ${section.actionType === 'increase' ? 'selected' : ''}>➕ 加針</option>
                <option value="decrease" ${section.actionType === 'decrease' ? 'selected' : ''}>➖ 減針</option>
              </select>
              <span>每</span>
              <input type="number" min="1" value="${section.interval}" 
                     onchange="updateSectionInterval(${section.id}, this.value)">
              <span>行，從第</span>
              <input type="number" min="1" value="${section.startRow}" 
                     onchange="updateSectionStartRow(${section.id}, this.value)">
              <span>行開始</span>
              <button class="btn-remove-reminder" onclick="toggleReminder(${section.id}, false)" title="關閉提醒">✕ 移除</button>
            </div>`;

          const isEditMode = section.mode === 'edit';
          modeSwitchBarHTML = `
            <div class="mode-switch-bar">
              <button class="btn-mode ${!isEditMode ? 'active' : ''}" onclick="switchSectionMode(${section.id}, 'progress')">
                📍 點擊記錄進度
              </button>
              <button class="btn-mode ${isEditMode ? 'active edit-mode' : ''}" onclick="switchSectionMode(${section.id}, 'edit')">
                ✏️ 點擊標記提醒 (手動微調)
              </button>
            </div>`;
        }

        const editModeClass = (section.hasReminder && section.mode === 'edit') ? 'edit-mode-active' : '';
        gridHTML = `<div class="grid-container ${editModeClass}">`;

        const totalGrids = section.total;
        for (let i = 0; i < totalGrids; i++) {
          const rowNumber = i + 1;
          const isFilled = i < section.current ? 'filled' : '';
          const isReminderRow = section.hasReminder && Array.isArray(section.customReminders) && section.customReminders.includes(rowNumber);

          let reminderClass = '';
          let tagText = '';
          if (isReminderRow) {
            if (section.actionType === 'increase') {
              reminderClass = 'reminder-increase';
              tagText = '<span class="grid-tag">+加</span>';
            } else {
              reminderClass = 'reminder-decrease';
              tagText = '<span class="grid-tag">-減</span>';
            }
          }

          gridHTML += `
            <div class="grid-square ${isFilled} ${reminderClass}" 
                 title="第 ${rowNumber} 行 ${isReminderRow ? (section.actionType === 'increase' ? '⚠️ 加針提醒' : '⚠️ 減針提醒') : ''}" 
                 onclick="handleGridClick(${section.id}, ${rowNumber})">
              <span>${rowNumber}</span>
              ${tagText}
            </div>`;
        }
        gridHTML += '</div>';
      }

      const isDecreaseMode = section.hasReminder && section.actionType === 'decrease';
      const currentRowClass = isDecreaseMode ? 'current-row is-decrease' : 'current-row';
      const unitLabelText = isCmUnit ? 'cm' : '行';

      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-group">
            <span class="drag-handle" title="按住拖曳排序">⠿</span>
            <h3>${section.name}</h3>
            <span class="${statusClass}">${statusText}</span>
          </div>
          <div class="card-tools">
            <button class="btn-tool" onclick="editSectionName(${section.id})" title="編輯名稱">✏️</button>
            <button class="btn-tool" onclick="copySection(${section.id})" title="複製區塊">📋</button>
            <button class="btn-tool" onclick="toggleLockSection(${section.id})" title="${lockTitle}">${lockIcon}</button>
            <button class="btn-tool" onclick="resetSection(${section.id})" title="歸零">🔄</button>
            <button class="btn-tool" onclick="deleteSection(${section.id})" title="刪除">🗑️</button>
          </div>
        </div>

        ${reminderBarHTML}
        ${modeSwitchBarHTML}

        ${gridHTML}

        <div class="progress-info">
          <span class="${currentRowClass}">${section.current}</span> 行 / <span class="total-row">${section.total} ${unitLabelText}</span>
        </div>

        <div class="button-group">
          <button class="btn-counter btn-minus" onclick="changeRow(${section.id}, -1)">-1 行</button>
          <button class="btn-counter btn-plus" onclick="changeRow(${section.id}, 1)">+1 行</button>
        </div>

        <div class="card-notes-area">
          <textarea placeholder="📝 填寫區塊筆記 (例: 4.0mm 棒針...)" 
                    onchange="updateSectionNotes(${section.id}, this.value)">${section.notes || ''}</textarea>
        </div>
      `;
    }

    counterList.appendChild(card);
  });
}

// ==========================================
// 10. 區塊互動與更新邏輯
// ==========================================
window.handleGridClick = function(sectionId, rowNumber) {
  const section = getActiveSection(sectionId);
  if (!section || section.isLocked) return;

  if (section.hasReminder && section.mode === 'edit') {
    if (!Array.isArray(section.customReminders)) {
      section.customReminders = [];
    }
    const index = section.customReminders.indexOf(rowNumber);
    if (index > -1) {
      section.customReminders.splice(index, 1);
    } else {
      section.customReminders.push(rowNumber);
    }
    saveToStorage();
  } else {
    if (section.current === rowNumber) {
      section.current = rowNumber - 1;
    } else {
      section.current = rowNumber;
    }
    saveToStorage();
  }
};

window.switchSectionMode = function(sectionId, mode) {
  const section = getActiveSection(sectionId);
  if (!section) return;
  section.mode = mode;
  saveToStorage();
};

window.toggleReminder = function(sectionId, enable) {
  const section = getActiveSection(sectionId);
  if (!section) return;
  section.hasReminder = enable;
  if (enable && (!section.customReminders || section.customReminders.length === 0)) {
    section.customReminders = calculateDefaultReminders(section.total, section.interval, section.startRow);
  }
  saveToStorage();
};

window.updateSectionActionType = function(sectionId, type) {
  const section = getActiveSection(sectionId);
  if (!section) return;
  section.actionType = type;
  saveToStorage();
};

window.updateSectionInterval = function(sectionId, value) {
  const section = getActiveSection(sectionId);
  if (!section) return;
  section.interval = parseInt(value) || 1;
  section.customReminders = calculateDefaultReminders(section.total, section.interval, section.startRow);
  saveToStorage();
};

window.updateSectionStartRow = function(sectionId, value) {
  const section = getActiveSection(sectionId);
  if (!section) return;
  section.startRow = parseInt(value) || 1;
  section.customReminders = calculateDefaultReminders(section.total, section.interval, section.startRow);
  saveToStorage();
};

window.updateSectionNotes = function(sectionId, value) {
  const section = getActiveSection(sectionId);
  if (!section) return;
  section.notes = value.trim();
  saveToStorage();
};

window.changeRow = function (sectionId, delta) {
  const section = getActiveSection(sectionId);
  if (!section || section.isLocked) return;

  section.current += delta;
  if (section.current < 0) section.current = 0;

  saveToStorage();
};

window.resetSection = function (sectionId) {
  if (confirm('確定要把這個區塊的行數歸零嗎？')) {
    const section = getActiveSection(sectionId);
    if (!section) return;
    section.isLocked = false;
    section.current = 0;
    saveToStorage();
  }
};

window.editSectionName = function (sectionId) {
  const section = getActiveSection(sectionId);
  if (!section) return;

  const newName = prompt('請輸入新的區塊名稱：', section.name);
  if (newName && newName.trim() !== '') {
    section.name = newName.trim();
    saveToStorage();
  }
};

window.deleteSection = function (sectionId) {
  if (confirm('確定要刪除這個區塊嗎？')) {
    const currentProject = projects.find(p => p.id === currentProjectId);
    if (!currentProject || !currentProject.sections) return;

    currentProject.sections = currentProject.sections.filter(s => s.id !== sectionId);
    saveToStorage();
  }
};

window.copySection = function (sectionId) {
  const currentProject = projects.find(p => p.id === currentProjectId);
  if (!currentProject || !currentProject.sections) return;

  const targetSection = currentProject.sections.find(s => s.id === sectionId);
  if (!targetSection) return;

  const duplicatedSection = JSON.parse(JSON.stringify(targetSection));
  duplicatedSection.id = Date.now();
  duplicatedSection.name = targetSection.name + " (複製)";
  duplicatedSection.current = 0;
  duplicatedSection.isLocked = false;

  currentProject.sections.push(duplicatedSection);
  saveToStorage();
};

window.toggleLockSection = function (sectionId) {
  const section = getActiveSection(sectionId);
  if (!section) return;

  section.isLocked = !section.isLocked;
  saveToStorage();
};

function getActiveSection(sectionId) {
  const currentProject = projects.find(p => p.id === currentProjectId);
  return (currentProject && currentProject.sections) ? currentProject.sections.find(s => s.id === sectionId) : null;
}