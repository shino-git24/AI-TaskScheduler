// DOM Elements
const generateButton = document.getElementById('generate-button');
const rawScheduleTextarea = document.getElementById('rawScheduleTextarea');
const aiError = document.getElementById('ai-error');
const aiSection = document.getElementById('ai-section');

const proposedTasksSection = document.getElementById('proposed-tasks-section');
const proposedTasksList = document.getElementById('proposed-tasks-list');
const confirmProposedTasksButton = document.getElementById('confirm-proposed-tasks-button');
const retryProposedTasksButton = document.getElementById('retry-proposed-tasks-button');

const taskListSection = document.getElementById('task-list-section');
const taskList = document.getElementById('task-list');
const noTasksMessage = document.getElementById('no-tasks-message');
const clearAllTasksButton = document.getElementById('clear-all-tasks-button');

const addTaskForm = document.getElementById('add-task-form');
const newTaskTimeInput = document.getElementById('newTaskTime');
const newTaskDescriptionInput = document.getElementById('newTaskDescription');


// Application State
let tasks = [];
let proposedTasks = null;
let isLoadingAi = false;
let editingTaskId = null;

// --- Helper Functions ---

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
const getCurrentTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

// --- Rendering Functions ---

/**
 * Renders the list of tasks to the DOM.
 */
const renderTasks = () => {
  // Clear current list
  taskList.innerHTML = '';

  if (tasks.length === 0) {
    noTasksMessage.classList.remove('hidden');
    clearAllTasksButton.classList.add('hidden');
    return;
  }
  
  noTasksMessage.classList.add('hidden');
  clearAllTasksButton.classList.remove('hidden');

  const sortedTasks = [...tasks].sort((a, b) => a.time.localeCompare(b.time));

  sortedTasks.forEach(task => {
    const li = document.createElement('li');
    li.dataset.taskId = task.id;

    if (editingTaskId === task.id) {
      // Render edit form
      li.className = "bg-slate-700 p-4 rounded-lg shadow-md flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3";
      li.innerHTML = `
        <input type="text" name="time" value="${task.time}" class="edit-time-input bg-slate-600 text-slate-100 p-2 rounded-md border border-slate-500 focus:ring-sky-500 focus:border-sky-500 w-full sm:w-1/5" placeholder="時間">
        <input type="text" name="task" value="${task.task}" class="edit-task-input bg-slate-600 text-slate-100 p-2 rounded-md border border-slate-500 focus:ring-sky-500 focus:border-sky-500 w-full sm:flex-grow" placeholder="タスク内容">
        <div class="flex space-x-2">
          <button class="save-edit-button p-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition duration-150" aria-label="保存">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          </button>
          <button class="cancel-edit-button p-2 bg-slate-500 hover:bg-slate-600 text-white rounded-md transition duration-150" aria-label="キャンセル">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      `;
    } else {
      // Render normal task item
      li.className = `p-4 rounded-lg shadow-md flex items-center space-x-3 transition-all duration-300 ${task.isCompleted ? 'bg-slate-700 opacity-60' : 'bg-slate-800 hover:bg-slate-700/50'}`;
      li.innerHTML = `
        <input type="checkbox" ${task.isCompleted ? 'checked' : ''} class="toggle-complete-checkbox form-checkbox h-5 w-5 text-sky-500 bg-slate-700 border-slate-600 rounded focus:ring-sky-500 cursor-pointer flex-shrink-0" aria-label="${task.isCompleted ? `タスク「${task.task}」を未完了にする` : `タスク「${task.task}」を完了にする`}">
        <div class="flex-grow">
          <div class="${task.isCompleted ? 'line-through text-slate-400' : ''}">
            <span class="font-semibold text-sky-400">${task.time}</span> - <span class="text-slate-200">${task.task}</span>
          </div>
          ${task.isCompleted && task.completedAt ? `<span class="block text-xs text-slate-500 mt-1">完了日時: ${task.completedAt}</span>` : ''}
        </div>
        <div class="flex flex-shrink-0 space-x-1">
          ${!task.isCompleted ? `<button class="start-edit-button p-2 hover:bg-slate-600 rounded-md transition duration-150 text-slate-400 hover:text-sky-400" aria-label="編集"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg></button>` : ''}
          <button class="delete-task-button p-2 hover:bg-slate-600 rounded-md transition duration-150 text-slate-400 hover:text-red-500" aria-label="削除">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c.342.052.682.107 1.022.166m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
          </button>
        </div>
      `;
    }
    taskList.appendChild(li);
  });
};

/**
 * Renders the list of proposed tasks from the AI.
 */
const renderProposedTasks = () => {
  proposedTasksList.innerHTML = '';
  if (proposedTasks) {
    proposedTasks.forEach(pt => {
      const li = document.createElement('li');
      li.className = "bg-slate-700 p-3 rounded-md text-sm";
      li.innerHTML = `<span class="font-semibold text-sky-400">${pt.time}</span> - <span class="text-slate-200">${pt.task}</span>`;
      proposedTasksList.appendChild(li);
    });
    proposedTasksSection.classList.remove('hidden');
    proposedTasksSection.classList.add('fade-enter');
    requestAnimationFrame(() => {
        proposedTasksSection.classList.add('fade-enter-active');
    });

  } else {
    proposedTasksSection.classList.add('hidden');
    proposedTasksSection.classList.remove('fade-enter', 'fade-enter-active');
  }
};

/**
 * Updates the loading state of the AI generate button.
 */
const setAILoadingState = (isLoading) => {
  isLoadingAi = isLoading;
  if (isLoading) {
    generateButton.disabled = true;
    rawScheduleTextarea.disabled = true;
    generateButton.innerHTML = `
      <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      処理中...
    `;
  } else {
    generateButton.disabled = false;
    rawScheduleTextarea.disabled = false;
    generateButton.innerHTML = 'AIで生成';
  }
};

/**
 * Shows or hides the AI-related error message.
 */
const showAiError = (message) => {
  if (message) {
    aiError.textContent = message;
    aiError.classList.remove('hidden');
  } else {
    aiError.classList.add('hidden');
  }
};


// --- Data Persistence ---

const saveTasks = () => {
  localStorage.setItem('tasks', JSON.stringify(tasks));
};

const loadTasks = () => {
  const savedTasks = localStorage.getItem('tasks');
  if (savedTasks) {
    tasks = JSON.parse(savedTasks);
  }
};

// --- Event Handlers ---

/**
 * Handles the "Generate with AI" button click.
 * Calls the Netlify function to get task suggestions.
 */
const handleGenerateSchedule = async () => {
  const rawText = rawScheduleTextarea.value.trim();
  if (!rawText) {
    showAiError("スケジュール詳細を入力してください。");
    return;
  }

  setAILoadingState(true);
  showAiError(null);
  proposedTasks = null;
  renderProposedTasks();

  try {
    const response = await fetch('/.netlify/functions/generate-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawScheduleText: rawText }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `サーバーエラー: ${response.status}`);
    }

    const data = await response.json();
    proposedTasks = data.tasks;
    renderProposedTasks();
    aiSection.classList.add('hidden');
    taskListSection.classList.add('hidden');

  } catch (error) {
    console.error("Error generating schedule:", error);
    showAiError(error.message);
  } finally {
    setAILoadingState(false);
  }
};

/**
 * Confirms the AI-proposed tasks and adds them to the main list.
 */
const handleConfirmProposedTasks = () => {
  if (proposedTasks) {
    const newTasks = proposedTasks.map(pt => ({
      ...pt,
      id: generateId(),
      isCompleted: false,
    }));
    tasks = newTasks; // Replace current tasks with proposed ones
    saveTasks();
    renderTasks();
    
    // Reset UI
    proposedTasks = null;
    rawScheduleTextarea.value = '';
    renderProposedTasks(); // This will hide the section
    aiSection.classList.remove('hidden');
    taskListSection.classList.remove('hidden');
  }
};

/**
 * Rejects the AI proposal and returns to the input view.
 */
const handleRetryProposedTasks = () => {
  proposedTasks = null;
  renderProposedTasks(); // Hides the section
  aiSection.classList.remove('hidden');
  taskListSection.classList.remove('hidden');
  rawScheduleTextarea.focus();
};

/**
 * Handles submission of the manual "Add Task" form.
 */
const handleAddNewTask = (event) => {
  event.preventDefault();
  const description = newTaskDescriptionInput.value.trim();
  if (!description) return;

  const time = newTaskTimeInput.value.trim() || "指定なし";

  const newTask = {
    id: generateId(),
    time: time,
    task: description,
    isCompleted: false,
  };

  tasks.push(newTask);
  saveTasks();
  renderTasks();
  
  // Reset form
  addTaskForm.reset();
};

/**
 * Handles clicks on the main task list for actions like toggle, edit, delete.
 */
const handleTaskListClick = (event) => {
  const target = event.target;
  const taskLi = target.closest('li[data-task-id]');
  if (!taskLi) return;

  const taskId = taskLi.dataset.taskId;

  // Toggle complete
  if (target.matches('.toggle-complete-checkbox')) {
    tasks = tasks.map(task => 
      task.id === taskId 
        ? { ...task, isCompleted: !task.isCompleted, completedAt: !task.isCompleted ? getCurrentTime() : undefined }
        : task
    );
    saveTasks();
    renderTasks();
  }

  // Delete task
  if (target.closest('.delete-task-button')) {
    tasks = tasks.filter(task => task.id !== taskId);
    saveTasks();
    renderTasks();
  }
  
  // Start editing
  if (target.closest('.start-edit-button')) {
    editingTaskId = taskId;
    renderTasks();
  }

  // Save edit
  if (target.closest('.save-edit-button')) {
    const newTime = taskLi.querySelector('.edit-time-input').value;
    const newTaskDesc = taskLi.querySelector('.edit-task-input').value;
    tasks = tasks.map(task =>
      task.id === taskId
        ? { ...task, time: newTime, task: newTaskDesc }
        : task
    );
    editingTaskId = null;
    saveTasks();
    renderTasks();
  }
  
  // Cancel edit
  if (target.closest('.cancel-edit-button')) {
    editingTaskId = null;
    renderTasks();
  }
};

/**
 * Clears all tasks from the list after confirmation.
 */
const handleClearAllTasks = () => {
  if (confirm("すべてのタスクを削除してもよろしいですか？")) {
    tasks = [];
    saveTasks();
    renderTasks();
  }
};


// --- Initialization ---

const init = () => {
  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => console.log('Service Worker registered with scope:', registration.scope))
        .catch(error => console.log('Service Worker registration failed:', error));
    });
  }

  // Add Event Listeners
  generateButton.addEventListener('click', handleGenerateSchedule);
  confirmProposedTasksButton.addEventListener('click', handleConfirmProposedTasks);
  retryProposedTasksButton.addEventListener('click', handleRetryProposedTasks);
  addTaskForm.addEventListener('submit', handleAddNewTask);
  taskList.addEventListener('click', handleTaskListClick);
  clearAllTasksButton.addEventListener('click', handleClearAllTasks);

  // Load initial data and render
  loadTasks();
  renderTasks();
};

// Start the application
init();
