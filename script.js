// ==========================================
// 1. Firebase 雲端資料庫初始化
// ==========================================
console.log("🔍 開始初始化 Firebase...");

// ⚠️ 請將下方的內容替換為你在 Firebase Console 複製到的專屬金鑰
const firebaseConfig = {
  apiKey: "AIzaSyBBMfACHtbo33b1RzjNEfJAl2rTOdNAuzE",
  authDomain: "knitting-counter-dabb7.firebaseapp.com",
  projectId: "knitting-counter-dabb7",
  storageBucket: "knitting-counter-dabb7.firebasestorage.app",
  messagingSenderId: "914715073456",
  appId: "1:914715073456:web:ecb537d693bb8cb5e8d475",
  measurementId: "G-RQYZQNS07T"
};

// 使用全域 firebase 物件初始化
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// 設定雲端儲存路徑
const syncRoomId = "my-knitting-room";
const dbRef = database.ref(`knitting_apps/${syncRoomId}`);

// ==========================================
// 2. DOM 元件擷取
// ==========================================
const projectSelect = document.getElementById('project-select');
const newProjectInput = document.getElementById('new-project-name');
const addProjectBtn = document.getElementById('add-project-btn');
const editProjectBtn = document.getElementById('edit-project-btn'); // 🌟 新增
const deleteProjectBtn = document.getElementById('delete-project-btn'); // 🌟 新增
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
      
      // 防呆處理：確保每個作品都包含 sections 陣列
      projects.forEach(p => {
        if (!p.sections) {
          p.sections = [];
        }
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

// ==========================================
// 5. 作品管理邏輯 (新增 / 編輯 / 刪除)
// ==========================================
// 新增作品
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

// 切換作品
projectSelect.addEventListener('change', (e) => {
  currentProjectId = Number(e.target.value);
  saveToStorage();
});

// 🌟 新增：修改當前作品名稱
editProjectBtn.addEventListener('click', () => {
  const currentProject = projects.find(p => p.id === currentProjectId);
  if (!currentProject) return;

  const newName = prompt('請輸入新的作品名稱：', currentProject.name);
  if (newName && newName.trim() !== '') {
    currentProject.name = newName.trim();
    saveToStorage();
  }
});

// 🌟 新增：刪除當前作品
deleteProjectBtn.addEventListener('click', () => {
  const currentProject = projects.find(p => p.id === currentProjectId);
  if (!currentProject) return;

  if (confirm(`確定要刪除作品「${currentProject.name}」嗎？裡面的所有區塊都會被刪除喔！`)) {
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

  const newSection = {
    id: Date.now(),
    name: name,
    current: 0,
    total: total
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

  if (!currentProject.sections) {
    currentProject.sections = [];
  }

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

    let gridHTML = '<div class="grid-container">';
    for (let i = 0; i < section.total; i++) {
      const isFilled = i < section.current ? 'filled' : '';
      gridHTML += `<div class="grid-square ${isFilled}" title="第 ${i + 1} 行" onclick="setRow(${section.id}, ${i + 1})"></div>`;
    }
    gridHTML += '</div>';

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

      ${gridHTML}

      <div class="progress-info">
        <span class="current-row">${section.current}</span> / <span class="total-row">${section.total}</span> 行
      </div>

      <div class="button-group">
        <button class="btn-counter btn-minus" onclick="changeRow(${section.id}, -1)">-1 行</button>
        <button class="btn-counter btn-plus" onclick="changeRow(${section.id}, 1)">+1 行</button>
      </div>
    `;

    counterList.appendChild(card);
  });
}

// ==========================================
// 8. 卡片互動邏輯
// ==========================================
window.changeRow = function (sectionId, delta) {
  const section = getActiveSection(sectionId);
  if (!section) return;

  section.current += delta;
  if (section.current < 0) section.current = 0;

  saveToStorage();
};

window.setRow = function (sectionId, targetRow) {
  const section = getActiveSection(sectionId);
  if (!section) return;

  if (section.current === targetRow) {
    section.current = targetRow - 1;
  } else {
    section.current = targetRow;
  }

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