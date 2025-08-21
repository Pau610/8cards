// Enhanced Game State Management with Multi-Game Support
let gameManager = {
    games: {
        'game_20250821_001': {
            id: 'game_20250821_001',
            name: '週五麻將局',
            creator: 'John',
            createdAt: '2025-08-21T08:58:00.000Z',
            lastModified: '2025-08-21T08:58:00.000Z',
            lastEditor: 'John',
            isLocked: false,
            lockExpiry: null,
            lockHolder: null,
            playerCount: 4,
            roundCount: 8,
            gameData: {
                players: [
                    {id: 1, name: 'John', totalWinLoss: 150, bankerRounds: 2},
                    {id: 2, name: 'Mary', totalWinLoss: -50, bankerRounds: 2},
                    {id: 3, name: 'Peter', totalWinLoss: -80, bankerRounds: 2},
                    {id: 4, name: 'Lisa', totalWinLoss: -20, bankerRounds: 2}
                ],
                currentRound: 9,
                currentBankerId: null,
                defaultBankerRounds: 3,
                customBankerRounds: 3,
                rounds: [],
                gameStarted: true,
                nextPlayerId: 5,
                gameCreatedAt: '2025-08-21T08:58:00.000Z',
                lastModified: '2025-08-21T08:58:00.000Z'
            }
        },
        'game_20250821_002': {
            id: 'game_20250821_002',
            name: '週末德州撲克',
            creator: 'Alice',
            createdAt: '2025-08-21T10:30:00.000Z',
            lastModified: '2025-08-21T10:30:00.000Z',
            lastEditor: 'Alice',
            isLocked: true,
            lockExpiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
            lockHolder: 'Alice',
            playerCount: 6,
            roundCount: 12,
            gameData: {
                players: [],
                currentRound: 1,
                currentBankerId: null,
                defaultBankerRounds: 3,
                customBankerRounds: 3,
                rounds: [],
                gameStarted: false,
                nextPlayerId: 1,
                gameCreatedAt: '2025-08-21T10:30:00.000Z',
                lastModified: '2025-08-21T10:30:00.000Z'
            }
        }
    },
    currentGameId: null,
    currentUser: 'John'
};

let cloudConfig = {
    provider: 'googledrive',
    autoSyncInterval: 300000, // 5 minutes
    lastSyncTime: new Date(Date.now() - 3 * 60 * 1000).toISOString(), // 3 minutes ago
    syncEnabled: true
};

// Current game state (for backward compatibility)
let gameState = null;
let currentScreen = 'welcome';
let currentRecordingPlayerId = null;
let editingRecord = { roundNumber: null, playerId: null };

// Utility Functions
function generateGameId() {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `game_${timestamp}_${random}`;
}

function formatDateTime(isoString) {
    return new Date(isoString).toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDate(isoString) {
    return new Date(isoString).toLocaleDateString('zh-TW');
}

function isGameLocked(game) {
    if (!game.isLocked) return false;
    if (!game.lockExpiry) return false;
    return new Date() < new Date(game.lockExpiry);
}

// Screen Navigation
function showScreen(screenId) {
    console.log('Showing screen:', screenId);
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.add('hidden');
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        currentScreen = screenId;
    } else {
        console.error('Screen not found:', screenId);
    }
    
    updateBottomNavigation();
}

function updateBottomNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    if (currentScreen === 'recordScreen') {
        navItems[0]?.classList.add('active');
    } else if (currentScreen === 'detailedRecordsScreen') {
        navItems[1]?.classList.add('active');
    } else if (currentScreen === 'statisticsScreen') {
        navItems[2]?.classList.add('active');
    } else if (currentScreen === 'settingsScreen') {
        navItems[3]?.classList.add('active');
    }
}

function showWelcome() {
    console.log('Showing welcome screen');
    showScreen('welcomeScreen');
    updateSyncStatus();
}

function showGameManagement() {
    console.log('Showing game management screen');
    showScreen('gameManagementScreen');
    updateGamesList();
}

function showGameList() {
    console.log('Showing game list screen');
    showScreen('gameListScreen');
    updateGamesSelectionList();
}

function backToGameManagement() {
    if (gameManager.currentGameId) {
        showGameManagement();
    } else {
        showWelcome();
    }
}

// Game Management Functions
function updateGamesList() {
    const container = document.getElementById('gamesList');
    if (!container) return;
    
    container.innerHTML = '';
    
    const games = Object.values(gameManager.games);
    if (games.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>尚無遊戲</h3>
                <p>點擊「創建新遊戲」開始第一個遊戲</p>
            </div>
        `;
        return;
    }
    
    games.forEach(game => {
        const gameDiv = document.createElement('div');
        const locked = isGameLocked(game);
        gameDiv.className = `game-card ${locked ? 'locked' : ''}`;
        gameDiv.onclick = () => selectGame(game.id);
        
        gameDiv.innerHTML = `
            ${locked ? '<div class="lock-indicator">🔒</div>' : ''}
            <div class="game-header">
                <h3 class="game-title">${game.name}</h3>
            </div>
            <div class="game-meta">
                <div class="game-meta-item">
                    <span class="meta-label">創建者</span>
                    <span>${game.creator}</span>
                </div>
                <div class="game-meta-item">
                    <span class="meta-label">玩家數</span>
                    <span>${game.playerCount} 人</span>
                </div>
                <div class="game-meta-item">
                    <span class="meta-label">創建時間</span>
                    <span>${formatDate(game.createdAt)}</span>
                </div>
                <div class="game-meta-item">
                    <span class="meta-label">最後修改</span>
                    <span>${formatDate(game.lastModified)}</span>
                </div>
            </div>
            <div class="game-status ${locked ? 'locked' : 'available'}">
                ${locked ? `正被 ${game.lockHolder} 編輯中` : '可編輯'}
            </div>
        `;
        container.appendChild(gameDiv);
    });
}

function updateGamesSelectionList() {
    const container = document.getElementById('gamesSelectionList');
    if (!container) return;
    
    container.innerHTML = '';
    
    const games = Object.values(gameManager.games);
    if (games.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>尚無遊戲</h3>
                <p>返回首頁創建您的第一個遊戲</p>
            </div>
        `;
        return;
    }
    
    games.forEach(game => {
        const gameDiv = document.createElement('div');
        const locked = isGameLocked(game);
        gameDiv.className = `game-card ${locked ? 'locked' : ''}`;
        gameDiv.onclick = () => {
            if (locked) {
                showToast(`遊戲正被 ${game.lockHolder} 編輯中，請稍後再試`, 'warning');
                return;
            }
            selectAndStartGame(game.id);
        };
        
        gameDiv.innerHTML = `
            ${locked ? '<div class="lock-indicator">🔒</div>' : ''}
            <div class="game-header">
                <h3 class="game-title">${game.name}</h3>
            </div>
            <div class="game-meta">
                <div class="game-meta-item">
                    <span class="meta-label">創建者</span>
                    <span>${game.creator}</span>
                </div>
                <div class="game-meta-item">
                    <span class="meta-label">輪數</span>
                    <span>${game.roundCount} 輪</span>
                </div>
                <div class="game-meta-item">
                    <span class="meta-label">創建時間</span>
                    <span>${formatDate(game.createdAt)}</span>
                </div>
                <div class="game-meta-item">
                    <span class="meta-label">最後修改</span>
                    <span>${formatDate(game.lastModified)}</span>
                </div>
            </div>
            <div class="game-status ${locked ? 'locked' : 'available'}">
                ${locked ? `正被 ${game.lockHolder} 編輯中` : '點擊繼續遊戲'}
            </div>
        `;
        container.appendChild(gameDiv);
    });
}

function selectGame(gameId) {
    const game = gameManager.games[gameId];
    if (!game) return;
    
    if (isGameLocked(game)) {
        showToast(`遊戲正被 ${game.lockHolder} 編輯中，請稍後再試`, 'warning');
        return;
    }
    
    gameManager.currentGameId = gameId;
    gameState = game.gameData;
    
    if (gameState.gameStarted && gameState.rounds.length > 0) {
        showRecord();
    } else if (gameState.gameStarted) {
        showBankerSelection();
    } else {
        showPlayerSetup();
    }
    
    acquireGameLock(gameId);
}

function selectAndStartGame(gameId) {
    selectGame(gameId);
}

// Game Lock Management
function acquireGameLock(gameId) {
    const game = gameManager.games[gameId];
    if (!game) return;
    
    if (isGameLocked(game) && game.lockHolder !== gameManager.currentUser) {
        throw new Error(`遊戲正被 ${game.lockHolder} 編輯中`);
    }
    
    game.isLocked = true;
    game.lockExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes
    game.lockHolder = gameManager.currentUser;
    
    autoSave();
    updateGameLockStatus();
    
    // Auto-refresh lock every 10 minutes
    setTimeout(() => {
        if (gameManager.currentGameId === gameId && currentScreen !== 'welcome') {
            refreshGameLock(gameId);
        }
    }, 10 * 60 * 1000);
}

function refreshGameLock(gameId) {
    const game = gameManager.games[gameId];
    if (!game || !game.isLocked || game.lockHolder !== gameManager.currentUser) return;
    
    game.lockExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    autoSave();
    updateGameLockStatus();
}

function releaseGameLock(gameId) {
    const game = gameManager.games[gameId];
    if (!game) return;
    
    game.isLocked = false;
    game.lockExpiry = null;
    game.lockHolder = null;
    
    autoSave();
}

function updateGameLockStatus() {
    const statusEl = document.getElementById('gameLockStatus');
    if (!statusEl || !gameManager.currentGameId) return;
    
    const game = gameManager.games[gameManager.currentGameId];
    if (!game) return;
    
    if (game.isLocked && game.lockHolder === gameManager.currentUser) {
        const lockExpiry = new Date(game.lockExpiry);
        const timeLeft = Math.floor((lockExpiry - new Date()) / 60000); // minutes
        
        statusEl.className = 'game-lock-status';
        statusEl.innerHTML = `您正在編輯此遊戲 (${timeLeft} 分鐘後自動釋放)`;
        statusEl.style.display = 'block';
        
        if (timeLeft <= 3) {
            statusEl.className = 'game-lock-status warning';
            statusEl.innerHTML = `注意：編輯權限將在 ${timeLeft} 分鐘後過期`;
        }
    } else {
        statusEl.style.display = 'none';
    }
}

// Create Game Functions
function createNewGame() {
    const modal = document.getElementById('createGameModal');
    const nameInput = document.getElementById('gameNameInput');
    const creatorInput = document.getElementById('creatorNameInput');
    
    if (nameInput) nameInput.value = '';
    if (creatorInput) creatorInput.value = gameManager.currentUser;
    
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            if (nameInput) nameInput.focus();
        }, 100);
    }
}

function closeCreateGameModal() {
    const modal = document.getElementById('createGameModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function confirmCreateGame() {
    const nameInput = document.getElementById('gameNameInput');
    const creatorInput = document.getElementById('creatorNameInput');
    
    const gameName = nameInput?.value.trim();
    const creatorName = creatorInput?.value.trim();
    
    if (!gameName) {
        showToast('請輸入遊戲名稱', 'error');
        return;
    }
    
    if (!creatorName) {
        showToast('請輸入創建者名稱', 'error');
        return;
    }
    
    // Check if game name already exists
    const existingGame = Object.values(gameManager.games).find(g => g.name === gameName);
    if (existingGame) {
        showToast('遊戲名稱已存在', 'error');
        return;
    }
    
    const gameId = generateGameId();
    const now = new Date().toISOString();
    
    const newGame = {
        id: gameId,
        name: gameName,
        creator: creatorName,
        createdAt: now,
        lastModified: now,
        lastEditor: creatorName,
        isLocked: false,
        lockExpiry: null,
        lockHolder: null,
        playerCount: 0,
        roundCount: 0,
        gameData: {
            players: [],
            currentRound: 1,
            currentBankerId: null,
            defaultBankerRounds: 3,
            customBankerRounds: 3,
            rounds: [],
            gameStarted: false,
            nextPlayerId: 1,
            gameCreatedAt: now,
            lastModified: now
        }
    };
    
    gameManager.games[gameId] = newGame;
    gameManager.currentGameId = gameId;
    gameState = newGame.gameData;
    
    autoSave();
    closeCreateGameModal();
    showPlayerSetup();
    showToast('遊戲創建成功');
}

// Cloud Sync Functions
function syncWithCloud() {
    updateSyncStatus('syncing');
    
    // Simulate cloud sync
    setTimeout(() => {
        cloudConfig.lastSyncTime = new Date().toISOString();
        updateSyncStatus('success');
        showToast('雲端同步成功');
        autoSave();
    }, 2000);
}

function updateSyncStatus(status = 'success') {
    const indicator = document.getElementById('syncIndicator');
    const statusText = document.getElementById('syncStatusText');
    
    if (!indicator || !statusText) return;
    
    indicator.className = 'sync-indicator';
    
    if (status === 'syncing') {
        indicator.classList.add('syncing');
        statusText.textContent = '同步中...';
    } else if (status === 'error') {
        indicator.classList.add('error');
        statusText.textContent = '同步失敗';
    } else {
        const lastSync = new Date(cloudConfig.lastSyncTime);
        const minutesAgo = Math.floor((Date.now() - lastSync.getTime()) / 60000);
        statusText.textContent = minutesAgo < 1 ? '剛剛同步' : `${minutesAgo}分鐘前同步`;
    }
}

function autoSave() {
    // Update game metadata
    if (gameManager.currentGameId && gameState) {
        const currentGame = gameManager.games[gameManager.currentGameId];
        if (currentGame) {
            currentGame.lastModified = new Date().toISOString();
            currentGame.lastEditor = gameManager.currentUser;
            currentGame.playerCount = gameState.players.length;
            currentGame.roundCount = gameState.rounds.length;
            currentGame.gameData = { ...gameState };
        }
    }
    
    console.log('Game auto-saved');
    
    // Auto-sync to cloud every 5 minutes
    const lastSync = new Date(cloudConfig.lastSyncTime);
    if (Date.now() - lastSync.getTime() > cloudConfig.autoSyncInterval) {
        syncWithCloud();
    }
}

// Player Setup Functions
function showPlayerSetup() {
    console.log('Showing player setup screen');
    showScreen('playerSetupScreen');
    updateCurrentGameTitle();
    updateBankerRoundsDisplay();
    updatePlayerList();
    updateConfirmButton();
}

function updateCurrentGameTitle() {
    const titleEl = document.getElementById('currentGameTitle');
    if (titleEl && gameManager.currentGameId) {
        const game = gameManager.games[gameManager.currentGameId];
        titleEl.textContent = game ? game.name : '新遊戲';
    }
}

function addPlayer() {
    console.log('Adding player...');
    const input = document.getElementById('playerNameInput');
    if (!input || !gameState) {
        console.error('Player name input not found or no game state');
        return;
    }
    
    const name = input.value.trim();
    
    if (name === '') {
        showToast('請輸入玩家名稱', 'error');
        return;
    }
    
    if (gameState.players.some(player => player.name === name)) {
        showToast('玩家名稱已存在', 'error');
        return;
    }
    
    if (gameState.players.length >= 20) {
        showToast('最多只能添加20位玩家', 'error');
        return;
    }
    
    const player = {
        id: gameState.nextPlayerId++,
        name: name,
        totalWinLoss: 0,
        bankerRounds: 0
    };
    
    gameState.players.push(player);
    input.value = '';
    updatePlayerList();
    updateConfirmButton();
    autoSave();
}

function removePlayer(playerId) {
    if (!gameState) return;
    
    console.log('Removing player:', playerId);
    gameState.players = gameState.players.filter(player => player.id !== playerId);
    updatePlayerList();
    updateConfirmButton();
    autoSave();
}

function updatePlayerList() {
    const container = document.getElementById('playerList');
    if (!container || !gameState) return;
    
    container.innerHTML = '';
    
    gameState.players.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        playerDiv.innerHTML = `
            <span class="player-name">${player.name}</span>
            <button class="remove-player" onclick="removePlayer(${player.id})">移除</button>
        `;
        container.appendChild(playerDiv);
    });
}

function updateConfirmButton() {
    const btn = document.getElementById('confirmPlayersBtn');
    if (!btn || !gameState) return;
    
    const canConfirm = gameState.players.length >= 2;
    btn.disabled = !canConfirm;
    btn.textContent = canConfirm ? `確認玩家 (${gameState.players.length}人)` : '確認玩家 (最少2人)';
}

function confirmPlayers() {
    console.log('Confirming players...');
    if (!gameState || gameState.players.length < 2) {
        showToast('至少需要2位玩家', 'error');
        return;
    }
    
    gameState.gameStarted = true;
    gameState.gameCreatedAt = new Date().toISOString();
    gameState.lastModified = new Date().toISOString();
    autoSave();
    showBankerSelection();
}

// Settings Functions
function showSettings() {
    console.log('Showing settings screen');
    showScreen('settingsScreen');
    updateSettingsDisplay();
}

function updateSettingsDisplay() {
    const bankerSelect = document.getElementById('bankerRoundsSelect');
    const userInput = document.getElementById('userNameInput');
    
    if (bankerSelect && gameState) {
        bankerSelect.value = gameState.customBankerRounds.toString();
    }
    
    if (userInput) {
        userInput.value = gameManager.currentUser;
    }
}

function updateBankerRounds(rounds) {
    if (!gameState) return;
    
    gameState.customBankerRounds = parseInt(rounds);
    gameState.defaultBankerRounds = parseInt(rounds);
    updateBankerRoundsDisplay();
    autoSave();
}

function updateUserName(name) {
    if (name.trim()) {
        gameManager.currentUser = name.trim();
        autoSave();
    }
}

function updateBankerRoundsDisplay() {
    const display = document.getElementById('currentBankerRounds');
    if (display && gameState) {
        display.textContent = gameState.customBankerRounds;
    }
}

function goBackFromSettings() {
    if (gameState && gameState.gameStarted && gameState.rounds.length > 0) {
        showRecord();
    } else if (gameState && gameState.gameStarted) {
        showBankerSelection();
    } else {
        showPlayerSetup();
    }
}

// Banker Selection Functions
function showBankerSelection() {
    console.log('Showing banker selection screen');
    showScreen('bankerSelectionScreen');
    updateBankerList();
    const currentRoundEl = document.getElementById('currentRoundNumber');
    if (currentRoundEl && gameState) {
        currentRoundEl.textContent = gameState.currentRound;
    }
}

function updateBankerList() {
    const container = document.getElementById('bankerList');
    if (!container || !gameState) return;
    
    container.innerHTML = '';
    
    gameState.players.forEach(player => {
        const bankerDiv = document.createElement('div');
        bankerDiv.className = 'banker-item';
        bankerDiv.onclick = () => selectBanker(player.id);
        
        const totalClass = player.totalWinLoss > 0 ? 'positive' : player.totalWinLoss < 0 ? 'negative' : '';
        
        bankerDiv.innerHTML = `
            <div class="banker-info">
                <div class="banker-name">${player.name}</div>
                <div class="banker-rounds">已當莊: ${player.bankerRounds} 輪</div>
            </div>
            <div class="banker-total ${totalClass}">
                總計: ${player.totalWinLoss >= 0 ? '+' : ''}${player.totalWinLoss}
            </div>
        `;
        container.appendChild(bankerDiv);
    });
}

function selectBanker(playerId) {
    console.log('Selecting banker:', playerId);
    if (!gameState) return;
    
    gameState.currentBankerId = playerId;
    
    const banker = gameState.players.find(p => p.id === playerId);
    if (!banker) {
        console.error('Banker not found:', playerId);
        return;
    }
    
    const currentRound = {
        roundNumber: gameState.currentRound,
        bankerId: playerId,
        bankerName: banker.name,
        records: []
    };
    
    gameState.players.forEach(player => {
        if (player.id !== playerId) {
            currentRound.records.push({
                playerId: player.id,
                playerName: player.name,
                amount: 0,
                completed: false
            });
        }
    });
    
    const existingRoundIndex = gameState.rounds.findIndex(r => r.roundNumber === gameState.currentRound);
    if (existingRoundIndex >= 0) {
        gameState.rounds[existingRoundIndex] = currentRound;
    } else {
        gameState.rounds.push(currentRound);
    }
    
    gameState.lastModified = new Date().toISOString();
    autoSave();
    showRecord();
}

function goBackFromBankerSelection() {
    if (!gameState) return;
    
    if (gameState.rounds.length === 0) {
        showPlayerSetup();
    } else {
        showRecord();
    }
}

// Record Screen Functions
function showRecord() {
    console.log('Showing record screen');
    showScreen('recordScreen');
    updateRecordScreen();
    updateGameLockStatus();
}

function updateRecordScreen() {
    if (!gameState) return;
    
    const roundNumberEl = document.getElementById('recordRoundNumber');
    if (roundNumberEl) {
        roundNumberEl.textContent = gameState.currentRound;
    }
    
    const banker = gameState.players.find(p => p.id === gameState.currentBankerId);
    const bankerNameEl = document.getElementById('currentBankerName');
    if (bankerNameEl) {
        bankerNameEl.textContent = banker ? banker.name : '';
    }
    
    const container = document.getElementById('playerRecordList');
    if (!container) return;
    
    container.innerHTML = '';
    
    const currentRound = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
    if (!currentRound) return;
    
    currentRound.records.forEach(record => {
        const recordDiv = document.createElement('div');
        recordDiv.className = `record-item ${record.completed ? 'completed' : 'pending'}`;
        recordDiv.onclick = () => openAmountModal(record.playerId);
        
        const amountClass = record.amount > 0 ? 'positive' : record.amount < 0 ? 'negative' : '';
        const statusText = record.completed ? '已完成' : '待記錄';
        const statusClass = record.completed ? 'completed' : '';
        
        recordDiv.innerHTML = `
            <div class="record-player-info">
                <div class="record-player-name">${record.playerName}</div>
                <div class="record-status ${statusClass}">${statusText}</div>
            </div>
            <div class="record-amount">
                <div class="amount-value ${amountClass}">
                    ${record.completed ? (record.amount >= 0 ? '+' : '') + record.amount : '---'}
                </div>
            </div>
        `;
        container.appendChild(recordDiv);
    });
    
    updateNextRoundButton();
    addFloatingActionButton();
}

function updateNextRoundButton() {
    const btn = document.getElementById('nextRoundBtn');
    if (!btn || !gameState) return;
    
    const currentRound = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
    
    if (!currentRound) {
        btn.disabled = true;
        return;
    }
    
    const allCompleted = currentRound.records.every(record => record.completed);
    btn.disabled = !allCompleted;
}

function addFloatingActionButton() {
    if (!document.querySelector('.add-player-btn')) {
        const addBtn = document.createElement('button');
        addBtn.className = 'add-player-btn';
        addBtn.innerHTML = '+';
        addBtn.onclick = openAddPlayerModal;
        document.body.appendChild(addBtn);
    }
}

// Next Round Logic
function nextRound() {
    if (!gameState) return;
    
    const currentRound = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
    if (!currentRound) return;
    
    const bankerTotal = currentRound.records.reduce((sum, record) => sum - record.amount, 0);
    
    currentRound.records.forEach(record => {
        const player = gameState.players.find(p => p.id === record.playerId);
        if (player) {
            player.totalWinLoss += record.amount;
        }
    });
    
    const banker = gameState.players.find(p => p.id === gameState.currentBankerId);
    if (banker) {
        banker.totalWinLoss += bankerTotal;
        banker.bankerRounds++;
    }
    
    gameState.currentRound++;
    gameState.lastModified = new Date().toISOString();
    autoSave();
    
    if (banker && banker.bankerRounds % gameState.customBankerRounds === 0) {
        gameState.currentBankerId = null;
        showBankerSelection();
    } else {
        selectBanker(gameState.currentBankerId);
    }
}

// Modal Functions (Amount Input)
function openAmountModal(playerId) {
    if (!gameState) return;
    
    currentRecordingPlayerId = playerId;
    const currentRound = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
    const record = currentRound.records.find(r => r.playerId === playerId);
    
    const modalTitle = document.getElementById('modalTitle');
    const amountInput = document.getElementById('amountInput');
    const modal = document.getElementById('amountModal');
    
    if (modalTitle && record) {
        modalTitle.textContent = `記錄 ${record.playerName} 的輸贏`;
    }
    
    if (amountInput) {
        amountInput.value = record && record.completed ? record.amount : '';
    }
    
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            if (amountInput) {
                amountInput.focus();
            }
        }, 100);
    }
}

function closeAmountModal() {
    const modal = document.getElementById('amountModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentRecordingPlayerId = null;
}

function confirmAmount() {
    const amountInput = document.getElementById('amountInput');
    if (!amountInput || !gameState) return;
    
    const amount = parseInt(amountInput.value);
    
    if (isNaN(amount)) {
        showToast('請輸入有效的整數', 'error');
        return;
    }
    
    const currentRound = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
    if (!currentRound) return;
    
    const record = currentRound.records.find(r => r.playerId === currentRecordingPlayerId);
    if (!record) return;
    
    record.amount = amount;
    record.completed = true;
    
    gameState.lastModified = new Date().toISOString();
    autoSave();
    
    closeAmountModal();
    updateRecordScreen();
}

// Add Player Modal
function openAddPlayerModal() {
    const input = document.getElementById('newPlayerNameInput');
    const modal = document.getElementById('addPlayerModal');
    
    if (input) {
        input.value = '';
    }
    
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            if (input) {
                input.focus();
            }
        }, 100);
    }
}

function closeAddPlayerModal() {
    const modal = document.getElementById('addPlayerModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function confirmAddPlayer() {
    const input = document.getElementById('newPlayerNameInput');
    if (!input || !gameState) return;
    
    const name = input.value.trim();
    
    if (name === '') {
        showToast('請輸入玩家名稱', 'error');
        return;
    }
    
    if (gameState.players.some(player => player.name === name)) {
        showToast('玩家名稱已存在', 'error');
        return;
    }
    
    if (gameState.players.length >= 20) {
        showToast('最多只能添加20位玩家', 'error');
        return;
    }
    
    const player = {
        id: gameState.nextPlayerId++,
        name: name,
        totalWinLoss: 0,
        bankerRounds: 0
    };
    
    gameState.players.push(player);
    
    // Add to current round if not banker
    const currentRound = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
    if (currentRound && player.id !== gameState.currentBankerId) {
        currentRound.records.push({
            playerId: player.id,
            playerName: player.name,
            amount: 0,
            completed: false
        });
    }
    
    gameState.lastModified = new Date().toISOString();
    autoSave();
    
    closeAddPlayerModal();
    updateRecordScreen();
}

// Detailed Records Functions
function showDetailedRecords() {
    console.log('Showing detailed records screen');
    showScreen('detailedRecordsScreen');
    updateDetailedRecords();
}

function updateDetailedRecords() {
    console.log('Updating detailed records...');
    if (!gameState) return;
    
    const headerRow = document.getElementById('tableHeaderRow');
    const tableBody = document.getElementById('recordsTableBody');
    const totalsRow = document.getElementById('totalsRow');
    
    if (!headerRow || !tableBody || !totalsRow) {
        console.error('Table elements not found');
        return;
    }
    
    // Build header with player names
    headerRow.innerHTML = `
        <th>輪數</th>
        <th>莊家</th>
        ${gameState.players.map(player => `<th>${player.name}</th>`).join('')}
    `;
    
    // Build table body with round data
    let bodyHtml = '';
    gameState.rounds.forEach(round => {
        let rowHtml = `
            <tr>
                <td>${round.roundNumber}</td>
                <td>${round.bankerName}</td>
        `;
        
        gameState.players.forEach(player => {
            if (player.id === round.bankerId) {
                // Calculate banker's total for this round
                const bankerTotal = round.records.reduce((sum, record) => sum - record.amount, 0);
                const amountClass = bankerTotal > 0 ? 'positive' : bankerTotal < 0 ? 'negative' : '';
                rowHtml += `<td><span class="editable-amount ${amountClass}">莊家 (${bankerTotal >= 0 ? '+' : ''}${bankerTotal})</span></td>`;
            } else {
                // Find player's record for this round
                const record = round.records.find(r => r.playerId === player.id);
                const amount = record ? record.amount : 0;
                const amountClass = amount > 0 ? 'positive' : amount < 0 ? 'negative' : '';
                rowHtml += `<td><span class="editable-amount ${amountClass}" onclick="openEditRecordModal(${round.roundNumber}, ${player.id})">${amount >= 0 ? '+' : ''}${amount}</span></td>`;
            }
        });
        
        rowHtml += '</tr>';
        bodyHtml += rowHtml;
    });
    tableBody.innerHTML = bodyHtml;
    
    // Build totals row
    totalsRow.innerHTML = `
        <td><strong>總計</strong></td>
        <td>-</td>
        ${gameState.players.map(player => {
            const totalClass = player.totalWinLoss > 0 ? 'positive' : player.totalWinLoss < 0 ? 'negative' : '';
            return `<td><strong class="${totalClass}">${player.totalWinLoss >= 0 ? '+' : ''}${player.totalWinLoss}</strong></td>`;
        }).join('')}
    `;
}

// Edit Record Modal
function openEditRecordModal(roundNumber, playerId) {
    if (!gameState) return;
    
    editingRecord.roundNumber = roundNumber;
    editingRecord.playerId = playerId;
    
    const round = gameState.rounds.find(r => r.roundNumber === roundNumber);
    const record = round?.records.find(r => r.playerId === playerId);
    const player = gameState.players.find(p => p.id === playerId);
    
    const modalTitle = document.getElementById('editModalTitle');
    const amountInput = document.getElementById('editAmountInput');
    const modal = document.getElementById('editRecordModal');
    
    if (modalTitle && player) {
        modalTitle.textContent = `編輯第${roundNumber}輪 - ${player.name}`;
    }
    
    if (amountInput && record) {
        amountInput.value = record.amount;
    }
    
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            if (amountInput) {
                amountInput.focus();
                amountInput.select();
            }
        }, 100);
    }
}

function closeEditRecordModal() {
    const modal = document.getElementById('editRecordModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    editingRecord = { roundNumber: null, playerId: null };
}

function confirmEditRecord() {
    const amountInput = document.getElementById('editAmountInput');
    if (!amountInput || !gameState) return;
    
    const amount = parseInt(amountInput.value);
    
    if (isNaN(amount)) {
        showToast('請輸入有效的整數', 'error');
        return;
    }
    
    const round = gameState.rounds.find(r => r.roundNumber === editingRecord.roundNumber);
    if (!round) return;
    
    const record = round.records.find(r => r.playerId === editingRecord.playerId);
    if (!record) return;
    
    record.amount = amount;
    record.completed = true;
    
    // Recalculate player totals
    recalculatePlayerTotals();
    
    gameState.lastModified = new Date().toISOString();
    autoSave();
    
    closeEditRecordModal();
    updateDetailedRecords();
    showToast('記錄已更新，總計重新計算');
}

function recalculatePlayerTotals() {
    if (!gameState) return;
    
    // Reset all totals
    gameState.players.forEach(player => {
        player.totalWinLoss = 0;
        player.bankerRounds = 0;
    });
    
    // Recalculate from all completed rounds
    gameState.rounds.forEach(round => {
        if (round.records.every(r => r.completed)) {
            const banker = gameState.players.find(p => p.id === round.bankerId);
            if (banker) {
                banker.bankerRounds++;
                const bankerTotal = round.records.reduce((sum, record) => sum - record.amount, 0);
                banker.totalWinLoss += bankerTotal;
            }
            
            round.records.forEach(record => {
                const player = gameState.players.find(p => p.id === record.playerId);
                if (player) {
                    player.totalWinLoss += record.amount;
                }
            });
        }
    });
}

// Statistics Functions
function showStatistics() {
    console.log('Showing statistics screen');
    showScreen('statisticsScreen');
    updateStatistics();
}

function updateStatistics() {
    const container = document.getElementById('statisticsContent');
    if (!container || !gameState) return;
    
    container.innerHTML = '';
    
    const sortedPlayers = [...gameState.players].sort((a, b) => b.totalWinLoss - a.totalWinLoss);
    
    sortedPlayers.forEach(player => {
        const statsDiv = document.createElement('div');
        statsDiv.className = 'stats-item';
        
        const totalClass = player.totalWinLoss > 0 ? 'positive' : 
                          player.totalWinLoss < 0 ? 'negative' : 'neutral';
        
        statsDiv.innerHTML = `
            <div class="stats-player-info">
                <div class="stats-player-name">${player.name}</div>
                <div class="stats-banker-rounds">已當莊: ${player.bankerRounds} 輪</div>
            </div>
            <div class="stats-total">
                <div class="stats-total-amount ${totalClass}">
                    ${player.totalWinLoss >= 0 ? '+' : ''}${player.totalWinLoss}
                </div>
            </div>
        `;
        container.appendChild(statsDiv);
    });
}

function goBackFromStatistics() {
    showRecord();
}

// Export Functions
function exportToExcel() {
    try {
        if (typeof XLSX === 'undefined') {
            showToast('Excel匯出功能不可用，請檢查網路連接', 'error');
            return;
        }
        
        if (!gameState) {
            showToast('沒有遊戲數據可匯出', 'error');
            return;
        }
        
        const wb = XLSX.utils.book_new();
        
        // Player summary sheet
        const summaryData = [
            ['玩家統計表'],
            ['玩家名稱', '總輸贏', '當莊輪數'],
            ...gameState.players.map(player => [
                player.name,
                player.totalWinLoss,
                player.bankerRounds
            ])
        ];
        
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summaryWs, '玩家統計');
        
        // Detailed records sheet
        const detailHeaders = ['輪數', '莊家', ...gameState.players.map(p => p.name)];
        const detailData = [
            ['詳細記錄表'],
            detailHeaders,
            ...gameState.rounds.map(round => {
                const row = [round.roundNumber, round.bankerName];
                gameState.players.forEach(player => {
                    if (player.id === round.bankerId) {
                        const bankerTotal = round.records.reduce((sum, record) => sum - record.amount, 0);
                        row.push(`莊家 (${bankerTotal})`);
                    } else {
                        const record = round.records.find(r => r.playerId === player.id);
                        row.push(record ? record.amount : 0);
                    }
                });
                return row;
            }),
            ['', '總計', ...gameState.players.map(p => p.totalWinLoss)]
        ];
        
        const detailWs = XLSX.utils.aoa_to_sheet(detailData);
        XLSX.utils.book_append_sheet(wb, detailWs, '詳細記錄');
        
        const timestamp = new Date().toLocaleString('zh-TW').replace(/[/:]/g, '-');
        const gameName = gameManager.currentGameId ? gameManager.games[gameManager.currentGameId].name : '遊戲記錄';
        const filename = `${gameName}_${timestamp}.xlsx`;
        
        XLSX.writeFile(wb, filename);
        showToast('Excel檔案匯出成功');
    } catch (error) {
        console.error('Export error:', error);
        showToast('匯出失敗，請重試', 'error');
    }
}

function saveGame() {
    try {
        if (!gameState || !gameManager.currentGameId) {
            showToast('沒有遊戲數據可保存', 'error');
            return;
        }
        
        const currentGame = gameManager.games[gameManager.currentGameId];
        const gameData = {
            ...currentGame,
            exportedAt: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(gameData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toLocaleString('zh-TW').replace(/[/:]/g, '-');
        const filename = `${currentGame.name}_${timestamp}.json`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('遊戲存檔已下載');
    } catch (error) {
        console.error('Save error:', error);
        showToast('保存失敗，請重試', 'error');
    }
}

// Toast Notifications
function showToast(message, type = 'success') {
    const toast = document.getElementById('successToast');
    const messageEl = document.getElementById('toastMessage');
    
    if (toast && messageEl) {
        messageEl.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.remove('hidden', 'fade-out');
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 250);
        }, 3000);
    }
}

// Event Listeners
function initializeEventListeners() {
    console.log('Initializing event listeners...');
    
    // Enter key handlers
    const inputs = [
        { id: 'playerNameInput', action: addPlayer },
        { id: 'amountInput', action: confirmAmount },
        { id: 'editAmountInput', action: confirmEditRecord },
        { id: 'newPlayerNameInput', action: confirmAddPlayer },
        { id: 'gameNameInput', action: confirmCreateGame },
        { id: 'creatorNameInput', action: confirmCreateGame }
    ];
    
    inputs.forEach(({ id, action }) => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    action();
                }
            });
            console.log('Added enter key listener to:', id);
        }
    });
    
    // Modal background click to close
    const modals = [
        { id: 'amountModal', closeFunc: closeAmountModal },
        { id: 'editRecordModal', closeFunc: closeEditRecordModal },
        { id: 'addPlayerModal', closeFunc: closeAddPlayerModal },
        { id: 'createGameModal', closeFunc: closeCreateGameModal }
    ];
    
    modals.forEach(({ id, closeFunc }) => {
        const modal = document.getElementById(id);
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    closeFunc();
                }
            });
            console.log('Added click listener to modal:', id);
        }
    });
    
    console.log('Event listeners initialized');
}

// Auto-sync timer
setInterval(() => {
    updateSyncStatus();
    updateGameLockStatus();
}, 60000); // Update every minute

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    initializeEventListeners();
    showWelcome();
});

console.log('Enhanced script loaded with game management features');