let state = {
  channels: {},
  topics: {},
  activeTab: 'pending',
  activeChannelFilter: 'all',
  searchQuery: '',
  eventSource: null
};

// DOM Elements
const statsGrid = document.getElementById('statsGrid');
const pendingList = document.getElementById('pendingList');
const doneList = document.getElementById('doneList');
const pendingCountBadge = document.getElementById('pendingCountBadge');
const doneCountBadge = document.getElementById('doneCountBadge');
const channelFilter = document.getElementById('channelFilter');
const searchInput = document.getElementById('searchInput');
const addTopicForm = document.getElementById('addTopicForm');
const btnTopUp = document.getElementById('btnTopUp');
const btnPipeline = document.getElementById('btnPipeline');
const consoleBody = document.getElementById('consoleBody');
const btnClearLog = document.getElementById('btnClearLog');
const statusDot = document.getElementById('statusDot');
const processBadge = document.getElementById('processBadge');

// Fetch initial data
async function loadData() {
  try {
    const res = await fetch('/api/topics');
    const data = await res.json();
    state.channels = data.channels || {};
    state.topics = data.topics || {};
    render();
  } catch (err) {
    appendLog(`[Error] Failed to fetch data: ${err.message}`, 'error');
  }
}

// Render entire UI based on state
function render() {
  renderStats();
  renderTopics();
}

// Render channel overview stat cards
function renderStats() {
  statsGrid.innerHTML = '';
  const channelKeys = Object.keys(state.channels);

  channelKeys.forEach((key) => {
    if (state.activeChannelFilter !== 'all' && state.activeChannelFilter !== key) return;

    const ch = state.channels[key];
    const chTopics = state.topics[key] || [];
    const pendingCount = chTopics.filter((t) => t.status === 'pending').length;
    const doneCount = chTopics.filter((t) => t.status === 'done').length;

    const card = document.createElement('div');
    card.className = 'card glass channel-card';
    card.innerHTML = `
      <div class="channel-header">
        <div>
          <div class="channel-name">${ch.displayName}</div>
          <div class="channel-niche">${ch.topicNiche}</div>
        </div>
        <span class="badge badge-info">${ch.language}</span>
      </div>

      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-val" style="color: #FBBF24;">${pendingCount}</span>
          <span class="stat-label">Pending Topics</span>
        </div>
        <div class="stat-item">
          <span class="stat-val" style="color: #34D399;">${doneCount}</span>
          <span class="stat-label">Done Topics</span>
        </div>
      </div>

      <div class="channel-meta">
        <span class="meta-pill">Aspect: ${ch.aspectRatio}</span>
        <span class="meta-pill">Voice: ${ch.piperVoice}</span>
        <span class="meta-pill">Scenes: ${ch.sceneCount}</span>
      </div>
    `;
    statsGrid.appendChild(card);
  });
}

// Render Pending and Done topics
function renderTopics() {
  pendingList.innerHTML = '';
  doneList.innerHTML = '';

  let allPending = [];
  let allDone = [];

  Object.keys(state.topics).forEach((chKey) => {
    if (state.activeChannelFilter !== 'all' && state.activeChannelFilter !== chKey) return;

    const chName = state.channels[chKey]?.displayName || chKey;
    const list = state.topics[chKey] || [];

    list.forEach((topic) => {
      const itemData = { ...topic, channelKey: chKey, channelName: chName };

      // Apply search filter
      if (
        state.searchQuery &&
        !topic.title.toLowerCase().includes(state.searchQuery.toLowerCase()) &&
        !topic.id.toLowerCase().includes(state.searchQuery.toLowerCase())
      ) {
        return;
      }

      if (topic.status === 'pending') {
        allPending.push(itemData);
      } else {
        allDone.push(itemData);
      }
    });
  });

  pendingCountBadge.textContent = allPending.length;
  doneCountBadge.textContent = allDone.length;

  // Render Pending List
  if (allPending.length === 0) {
    pendingList.innerHTML = '<div class="empty-state">No pending topics found in queue.</div>';
  } else {
    allPending.forEach((t) => pendingList.appendChild(createTopicElement(t)));
  }

  // Render Done List
  if (allDone.length === 0) {
    doneList.innerHTML = '<div class="empty-state">No completed topics found yet.</div>';
  } else {
    allDone.forEach((t) => doneList.appendChild(createTopicElement(t)));
  }
}

// Create Topic Element DOM
function createTopicElement(topic) {
  const el = document.createElement('div');
  el.className = 'topic-item';

  const isPending = topic.status === 'pending';

  el.innerHTML = `
    <div class="topic-info">
      <div class="topic-title">${topic.title}</div>
      <div class="topic-meta">
        <span class="badge badge-channel">${topic.channelName}</span>
        <span class="badge ${isPending ? 'badge-pending' : 'badge-done'}">${topic.status}</span>
        <span class="badge badge-info">ID: ${topic.id}</span>
      </div>
    </div>
    <div class="topic-actions">
      <button class="btn-sm btn-ghost" onclick="toggleStatus('${topic.channelKey}', '${topic.id}', '${isPending ? 'done' : 'pending'}')">
        ${isPending ? '✅ Mark Done' : '🔄 Mark Pending'}
      </button>
      <button class="btn-sm btn-ghost" style="color: #F87171;" onclick="deleteTopic('${topic.channelKey}', '${topic.id}')">
        🗑️ Delete
      </button>
    </div>
  `;
  return el;
}

// Add Topic Handler
addTopicForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const channelId = document.getElementById('newTopicChannel').value;
  const title = document.getElementById('newTopicTitle').value.trim();
  if (!title) return;

  try {
    const res = await fetch('/api/topics/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, title }),
    });
    const data = await res.json();
    state.topics = data.topics;
    document.getElementById('newTopicTitle').value = '';
    render();
    appendLog(`[Success] Added new custom topic to ${channelId}: "${title}"`, 'success');
  } catch (err) {
    appendLog(`[Error] Failed to add topic: ${err.message}`, 'error');
  }
});

// Toggle Topic Status
async function toggleStatus(channelId, topicId, newStatus) {
  try {
    const res = await fetch('/api/topics/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, topicId, status: newStatus }),
    });
    const data = await res.json();
    state.topics = data.topics;
    render();
  } catch (err) {
    appendLog(`[Error] Failed to update status: ${err.message}`, 'error');
  }
}

// Delete Topic
async function deleteTopic(channelId, topicId) {
  if (!confirm('Are you sure you want to delete this topic from queue?')) return;
  try {
    const res = await fetch('/api/topics/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, topicId }),
    });
    const data = await res.json();
    state.topics = data.topics;
    render();
    appendLog(`[Notice] Deleted topic ${topicId}`, 'info');
  } catch (err) {
    appendLog(`[Error] Failed to delete topic: ${err.message}`, 'error');
  }
}

// Tab Switching
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));

    btn.classList.add('active');
    const tabName = btn.dataset.tab;
    document.getElementById(`${tabName}Tab`).classList.add('active');
  });
});

// Filter & Search Event Listeners
channelFilter.addEventListener('change', (e) => {
  state.activeChannelFilter = e.target.value;
  render();
});

searchInput.addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  renderTopics();
});

// Console Log Utility
function appendLog(text, type = 'info') {
  const line = document.createElement('div');
  line.className = `log-line ${type}`;

  if (text.includes('SUCCESS') || text.includes('Uploaded:')) line.className = 'log-line success';
  else if (text.includes('FAILED') || text.includes('Error') || text.includes('❌')) line.className = 'log-line error';
  else if (text.includes('===') || text.includes('Topic:')) line.className = 'log-line highlight';

  line.textContent = text;
  consoleBody.appendChild(line);
  consoleBody.scrollTop = consoleBody.scrollHeight;
}

btnClearLog.addEventListener('click', () => {
  consoleBody.innerHTML = '<div class="log-line info">[System] Console cleared.</div>';
});

// Stream process execution (Top Up or Pipeline)
function runStreamAction(action) {
  if (state.eventSource) {
    state.eventSource.close();
  }

  const channel = channelFilter.value;
  const actionLabel = action === 'topup' ? 'Topic Top-Up' : 'Video Generation & Upload';
  appendLog(`\n==================================================`, 'highlight');
  appendLog(`[Action Started] Launching ${actionLabel} (Scope: ${channel})...`, 'highlight');
  appendLog(`==================================================`, 'highlight');

  statusDot.classList.add('running');
  processBadge.textContent = action === 'topup' ? 'Top Up Running...' : 'Pipeline Running...';
  processBadge.className = 'badge badge-pending';

  btnTopUp.disabled = true;
  btnPipeline.disabled = true;

  const url = `/api/run-stream?action=${action}&channel=${channel}`;
  state.eventSource = new EventSource(url);

  state.eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'log') {
      appendLog(data.text);
    } else if (data.type === 'done') {
      state.eventSource.close();
      state.eventSource = null;

      btnTopUp.disabled = false;
      btnPipeline.disabled = false;

      statusDot.classList.remove('running');

      if (data.success) {
        processBadge.textContent = 'Completed Successfully';
        processBadge.className = 'badge badge-done';
        appendLog(`\n🎉 [Completed] ${actionLabel} finished cleanly!`, 'success');
      } else {
        processBadge.textContent = 'Execution Failed';
        processBadge.className = 'badge badge-pending';
        appendLog(`\n❌ [Failed] Process exited with code ${data.code}`, 'error');
      }

      // Refresh topic lists automatically
      loadData();
    } else if (data.type === 'error') {
      appendLog(`[Error] ${data.message}`, 'error');
    }
  };

  state.eventSource.onerror = (err) => {
    appendLog(`[Connection Error] Lost connection to process stream.`, 'error');
    btnTopUp.disabled = false;
    btnPipeline.disabled = false;
    statusDot.classList.remove('running');
    processBadge.textContent = 'Disconnected';
    if (state.eventSource) state.eventSource.close();
  };
}

btnTopUp.addEventListener('click', () => runStreamAction('topup'));
btnPipeline.addEventListener('click', () => runStreamAction('pipeline'));

// Initialize on page load
loadData();
