// ==========================================
// 1. Firebase 雲端資料庫初始化
// ==========================================
console.log("🔍 開始初始化 Firebase...");

const firebaseConfig = {
  apiKey: "AIzaSyBBMfACHtbo33b1RzjNEfJAl2rTOdNAuzE",
  authDomain: "knitting-counter-dabb7.firebaseapp.com",
  projectId: "knitting-counter-dabb7",
  storageBucket: "knitting-counter-dabb7.firebasestorage.app",
  messagingSenderId: "914715073456",
  appId: "1:914715073456:web:ecb537d693bb8cb5e8d475",
  measurementId: "G-RQYZQNS07T"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const syncRoomId = "my-knitting-room";
const dbRef = database.ref(`knitting_apps/${syncRoomId}`);

// ==========================================
// 2. DOM 元件擷取
// ==========================================
const projectSelect = document.getElementById('project-select');
const newProjectInput = document.getElementById('new-project-name');
const addProjectBtn = document.getElementById('add-project-btn');
const editProjectBtn = document.getElementById('edit-project-btn');
const deleteProjectBtn = document.getElementById('delete-project-btn');
const currentProjectTitle = document.getElementById('current-project-title');

const sectionNameInput = document.getElementById('section-name');
const totalRowsInput = document.getElementById('total-rows');
const addBtn = document.getElementById('add-btn');
const counterList = document.getElementById('counter-list');

// ==========================================
// 3. 全局資料狀態
// ==========================================
let projects = [];
let currentProjectId = null;

// ==========================================
// 4. 網頁初始化與 Firebase 雲端即時監聽
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  listenToCloudStorage();
});

function listenToCloudStorage() {
  dbRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      projects = data.projects || [];
      
      // 補全屬性預設值
      projects.forEach(p => {
        if (!p.sections) p.sections = [];
        p.sections.forEach(s => {
          if (s.hasReminder === undefined) s.hasReminder = false;
          if (s.actionType === undefined) s.actionType = 'increase';
          if (s.interval === undefined) s.interval = 4;
          if (s.startRow === undefined) s.startRow = 1;
          if (s.notes === undefined) s.notes = "";
          if (s.mode === undefined) s.mode = 'progress';
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

function saveToStorage() {
  dbRef.set({
    projects: projects,
    currentProjectId: currentProjectId,
    updatedAt: Date.now()
  });
}

// 計算預設提醒行數的輔助函式
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

// ==========================================
// 5. 作品管理邏輯
// ==========================================
addProjectBtn.addEventListener('click', () => {
  const name = newProjectInput.value.trim();
  if (!name) {
    alert('請輸入作品名稱！');
    return;
  }

  const newProject = {
    id: Date.now(),
    name: name,
    sections: []
  };

  projects.push(newProject);
  currentProjectId = newProject.id;
  newProjectInput.value = '';
  
  saveToStorage();
});

projectSelect.addEventListener('change', (e) => {
  currentProjectId = Number(e.target.value);
  saveToStorage();
});

editProjectBtn.addEventListener('click', () => {
  const currentProject = projects.find(p => p.id === currentProjectId);
  if (!currentProject) return;

  const newName = prompt('請輸入新的作品名稱：', currentProject.name);
  if (newName && newName.trim() !== '') {
    currentProject.name = newName.trim();
    saveToStorage();
  }
});

deleteProjectBtn.addEventListener('click', () => {
  const currentProject = projects.find(p => p.id === currentProjectId);
  if (!currentProject) return;

  if (confirm(`確定要刪除作品「${currentProject.name}」嗎？`)) {
    projects = projects.filter(p => p.id !== currentProjectId);

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
});

// ==========================================
// 6. 區塊建立邏輯
// ==========================================
addBtn.addEventListener('click', () => {
  const name = sectionNameInput.value.trim();
  const total = parseInt(totalRowsInput.value);

  if (!name || isNaN(total) || total <= 0) {
    alert('請輸入有效的區塊名稱與目標總行數！');
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
    name: name,
    current: 0,
    total: total,
    hasReminder: false,
    actionType: 'increase',
    interval: defaultInterval,
    startRow: defaultStart,
    customReminders: calculateDefaultReminders(total, defaultInterval, defaultStart),
    mode: 'progress',
    notes: ""
  };

  currentProject.sections.push(newSection);
  sectionNameInput.value = '';
  totalRowsInput.value = '';

  saveToStorage();
});

// ==========================================
// 7. 核心畫面渲染 (Render)
// ==========================================
function render() {
  projectSelect.innerHTML = '';
  projects.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.name;
    if (p.id === currentProjectId) option.selected = true;
    projectSelect.appendChild(option);
  });

  const currentProject = projects.find(p => p.id === currentProjectId);
  if (!currentProject) return;

  if (!currentProject.sections) currentProject.sections = [];

  currentProjectTitle.textContent = `${currentProject.name} - 區塊列表`;
  counterList.innerHTML = '';

  if (currentProject.sections.length === 0) {
    counterList.innerHTML = `
      <p style="text-align: center; color: #636e72; padding: 20px 0;">
        此作品目前沒有任何區塊，請在上方建立！
      </p>`;
    return;
  }

  currentProject.sections.forEach(section => {
    const isCompleted = section.current >= section.total;
    const statusText = isCompleted ? '🎉 已完成' : '進行中';
    const statusClass = isCompleted ? 'status-badge completed' : 'status-badge';

    // 提醒控制列 HTML 渲染
    let reminderBarHTML = '';
    let modeSwitchBarHTML = '';

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

    // 格子渲染與判斷
    const editModeClass = (section.hasReminder && section.mode === 'edit') ? 'edit-mode-active' : '';
    let gridHTML = `<div class="grid-container ${editModeClass}">`;

    for (let i = 0; i < section.total; i++) {
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

    // 🌟【判斷減針模式以給予紫色 class】
    const isDecreaseMode = section.hasReminder && section.actionType === 'decrease';
    const currentRowClass = isDecreaseMode ? 'current-row is-decrease' : 'current-row';

    const card = document.createElement('div');
    card.className = 'counter-card';
    card.innerHTML = `
      <div class="card-header">
        <div class="card-title-group">
          <h3>${section.name}</h3>
          <span class="${statusClass}">${statusText}</span>
        </div>
        <div class="card-tools">
          <button class="btn-tool" onclick="editSectionName(${section.id})" title="編輯名稱">✏️</button>
          <button class="btn-tool" onclick="resetSection(${section.id})" title="歸零">🔄</button>
          <button class="btn-tool" onclick="deleteSection(${section.id})" title="刪除">🗑️</button>
        </div>
      </div>

      ${reminderBarHTML}
      ${modeSwitchBarHTML}

      ${gridHTML}

      <div class="progress-info">
        <span class="${currentRowClass}">${section.current}</span> / <span class="total-row">${section.total}</span> 行
      </div>

      <div class="button-group">
        <button class="btn-counter btn-minus" onclick="changeRow(${section.id}, -1)">-1 行</button>
        <button class="btn-counter btn-plus" onclick="changeRow(${section.id}, 1)">+1 行</button>
      </div>

      <div class="card-notes-area">
        <textarea placeholder="📝 填寫區塊筆記 (例: 4.0mm 棒針、第 10 行右二併針...)" 
                  onchange="updateSectionNotes(${section.id}, this.value)">${section.notes || ''}</textarea>
      </div>
    `;

    counterList.appendChild(card);
  });
}

// ==========================================
// 8. 互動與設定更新邏輯
// ==========================================

window.handleGridClick = function(sectionId, rowNumber) {
  const section = getActiveSection(sectionId);
  if (!section) return;

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
  if (!section) return;

  section.current += delta;
  if (section.current < 0) section.current = 0;

  saveToStorage();
};

window.resetSection = function (sectionId) {
  if (confirm('確定要把這個區塊的行數歸零嗎？')) {
    const section = getActiveSection(sectionId);
    if (!section) return;
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

function getActiveSection(sectionId) {
  const currentProject = projects.find(p => p.id === currentProjectId);
  return (currentProject && currentProject.sections) ? currentProject.sections.find(s => s.id === sectionId) : null;
}