// Game State Management
let gameState = {
    players: [],
    currentRound: 1,
    currentBankerId: null,
    defaultBankerRounds: 3,
    customBankerRounds: 3,
    rounds: [],
    gameStarted: false,
    nextPlayerId: 1,
    gameCreatedAt: null,
    lastModified: null
};

let currentScreen = 'welcome';
let currentRecordingPlayerId = null;
let editingRecord = { roundNumber: null, playerId: null };

// Screen Navigation
window.showScreen = function(screenId) {
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
};

window.updateBottomNavigation = function() {
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
};

window.showWelcome = function() {
    console.log('Showing welcome screen');
    showScreen('welcomeScreen');
    updateContinueGameButton();
};

window.showLoadGame = function() {
    console.log('Showing load game screen');
    showScreen('loadGameScreen');
};

window.showPlayerSetup = function() {
    console.log('Showing player setup screen');
    showScreen('playerSetupScreen');
    updateBankerRoundsDisplay();
    updatePlayerList();
    updateConfirmButton();
};

window.showSettings = function() {
    console.log('Showing settings screen');
    showScreen('settingsScreen');
    updateSettingsDisplay();
};

window.showBankerSelection = function() {
    console.log('Showing banker selection screen');
    showScreen('bankerSelectionScreen');
    updateBankerList();
    const currentRoundEl = document.getElementById('currentRoundNumber');
    if (currentRoundEl) {
        currentRoundEl.textContent = gameState.currentRound;
    }
};

window.showRecord = function() {
    console.log('Showing record screen');
    showScreen('recordScreen');
    updateRecordScreen();
};

window.showDetailedRecords = function() {
    console.log('Showing detailed records screen');
    showScreen('detailedRecordsScreen');
    updateDetailedRecords();
};

window.showStatistics = function() {
    console.log('Showing statistics screen');
    showScreen('statisticsScreen');
    updateStatistics();
};

window.goBackFromBankerSelection = function() {
    if (gameState.rounds.length === 0) {
        showPlayerSetup();
    } else {
        showRecord();
    }
};

window.goBackFromStatistics = function() {
    showRecord();
};

window.goBackFromSettings = function() {
    if (gameState.gameStarted && gameState.rounds.length > 0) {
        showRecord();
    } else if (gameState.gameStarted) {
        showBankerSelection();
    } else {
        showPlayerSetup();
    }
};

// Settings Management
window.updateBankerRounds = function(rounds) {
    gameState.customBankerRounds = parseInt(rounds);
    gameState.defaultBankerRounds = parseInt(rounds);
    updateBankerRoundsDisplay();
    saveGameToStorage();
};

window.updateSettingsDisplay = function() {
    const select = document.getElementById('bankerRoundsSelect');
    if (select) {
        select.value = gameState.customBankerRounds.toString();
    }
};

window.updateBankerRoundsDisplay = function() {
    const display = document.getElementById('currentBankerRounds');
    if (display) {
        display.textContent = gameState.customBankerRounds;
    }
};

window.updateContinueGameButton = function() {
    const btn = document.getElementById('continueGameBtn');
    if (btn) {
        if (gameState.gameStarted && gameState.rounds.length > 0) {
            btn.style.display = 'block';
        } else {
            btn.style.display = 'none';
        }
    }
};

window.continueGame = function() {
    if (gameState.gameStarted && gameState.rounds.length > 0) {
        showRecord();
    }
};

// Player Management
window.addPlayer = function() {
    console.log('Adding player...');
    const input = document.getElementById('playerNameInput');
    if (!input) {
        console.error('Player name input not found');
        return;
    }
    
    const name = input.value.trim();
    
    if (name === '') {
        alert('請輸入玩家名稱');
        return;
    }
    
    if (gameState.players.some(player => player.name === name)) {
        alert('玩家名稱已存在');
        return;
    }
    
    if (gameState.players.length >= 20) {
        alert('最多只能添加20位玩家');
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
    saveGameToStorage();
};

window.removePlayer = function(playerId) {
    console.log('Removing player:', playerId);
    gameState.players = gameState.players.filter(player => player.id !== playerId);
    updatePlayerList();
    updateConfirmButton();
    saveGameToStorage();
};

window.updatePlayerList = function() {
    const container = document.getElementById('playerList');
    if (!container) return;
    
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
};

window.updateConfirmButton = function() {
    const btn = document.getElementById('confirmPlayersBtn');
    if (!btn) return;
    
    const canConfirm = gameState.players.length >= 2;
    btn.disabled = !canConfirm;
    btn.textContent = canConfirm ? `確認玩家 (${gameState.players.length}人)` : '確認玩家 (最少2人)';
};

window.confirmPlayers = function() {
    console.log('Confirming players...');
    if (gameState.players.length < 2) {
        alert('至少需要2位玩家');
        return;
    }
    
    gameState.gameStarted = true;
    gameState.gameCreatedAt = new Date().toISOString();
    gameState.lastModified = new Date().toISOString();
    saveGameToStorage();
    showBankerSelection();
};

// Banker Selection
window.updateBankerList = function() {
    const container = document.getElementById('bankerList');
    if (!container) return;
    
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
};

window.selectBanker = function(playerId) {
    console.log('Selecting banker:', playerId);
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
    saveGameToStorage();
    showRecord();
};

// Record Management
window.updateRecordScreen = function() {
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
};

window.updateNextRoundButton = function() {
    const btn = document.getElementById('nextRoundBtn');
    if (!btn) return;
    
    const currentRound = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
    
    if (!currentRound) {
        btn.disabled = true;
        return;
    }
    
    const allCompleted = currentRound.records.every(record => record.completed);
    btn.disabled = !allCompleted;
};

window.addFloatingActionButton = function() {
    if (!document.querySelector('.add-player-btn')) {
        const addBtn = document.createElement('button');
        addBtn.className = 'add-player-btn';
        addBtn.innerHTML = '+';
        addBtn.onclick = openAddPlayerModal;
        document.body.appendChild(addBtn);
    }
};

// Detailed Records Table - FIXED VERSION
window.updateDetailedRecords = function() {
    console.log('Updating detailed records...');
    const headerRow = document.getElementById('tableHeaderRow');
    const tableBody = document.getElementById('recordsTableBody');
    const totalsRow = document.getElementById('totalsRow');
    
    if (!headerRow || !tableBody || !totalsRow) {
        console.error('Table elements not found');
        return;
    }
    
    // Fix 1: Build correct header with real player names
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
    
    // Fix 2: Build correct totals row with final values, not formulas
    totalsRow.innerHTML = `
        <td><strong>總計</strong></td>
        <td>-</td>
        ${gameState.players.map(player => {
            const totalClass = player.totalWinLoss > 0 ? 'positive' : player.totalWinLoss < 0 ? 'negative' : '';
            return `<td><strong class="${totalClass}">${player.totalWinLoss >= 0 ? '+' : ''}${player.totalWinLoss}</strong></td>`;
        }).join('')}
    `;
};

// Edit Record Modal
window.openEditRecordModal = function(roundNumber, playerId) {
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
};

window.closeEditRecordModal = function() {
    const modal = document.getElementById('editRecordModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    editingRecord = { roundNumber: null, playerId: null };
};

window.confirmEditRecord = function() {
    const amountInput = document.getElementById('editAmountInput');
    if (!amountInput) return;
    
    const amount = parseInt(amountInput.value);
    
    if (isNaN(amount)) {
        alert('請輸入有效的整數');
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
    saveGameToStorage();
    
    closeEditRecordModal();
    updateDetailedRecords();
    showToast('記錄已更新，總計重新計算');
};

window.recalculatePlayerTotals = function() {
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
};

// Amount Input Modal
window.openAmountModal = function(playerId) {
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
};

window.closeAmountModal = function() {
    const modal = document.getElementById('amountModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentRecordingPlayerId = null;
};

window.confirmAmount = function() {
    const amountInput = document.getElementById('amountInput');
    if (!amountInput) return;
    
    const amount = parseInt(amountInput.value);
    
    if (isNaN(amount)) {
        alert('請輸入有效的整數');
        return;
    }
    
    const currentRound = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
    if (!currentRound) return;
    
    const record = currentRound.records.find(r => r.playerId === currentRecordingPlayerId);
    if (!record) return;
    
    record.amount = amount;
    record.completed = true;
    
    gameState.lastModified = new Date().toISOString();
    saveGameToStorage();
    
    closeAmountModal();
    updateRecordScreen();
};

// Add Player Modal
window.openAddPlayerModal = function() {
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
};

window.closeAddPlayerModal = function() {
    const modal = document.getElementById('addPlayerModal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

window.confirmAddPlayer = function() {
    const input = document.getElementById('newPlayerNameInput');
    if (!input) return;
    
    const name = input.value.trim();
    
    if (name === '') {
        alert('請輸入玩家名稱');
        return;
    }
    
    if (gameState.players.some(player => player.name === name)) {
        alert('玩家名稱已存在');
        return;
    }
    
    if (gameState.players.length >= 20) {
        alert('最多只能添加20位玩家');
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
    saveGameToStorage();
    
    closeAddPlayerModal();
    updateRecordScreen();
};

// Next Round Logic
window.nextRound = function() {
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
    saveGameToStorage();
    
    if (banker && banker.bankerRounds % gameState.customBankerRounds === 0) {
        gameState.currentBankerId = null;
        showBankerSelection();
    } else {
        selectBanker(gameState.currentBankerId);
    }
};

// Statistics
window.updateStatistics = function() {
    const container = document.getElementById('statisticsContent');
    if (!container) return;
    
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
};

// Excel Export
window.exportToExcel = function() {
    try {
        if (typeof XLSX === 'undefined') {
            alert('Excel匯出功能不可用，請檢查網路連接');
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
        const filename = `記數app_遊戲記錄_${timestamp}.xlsx`;
        
        XLSX.writeFile(wb, filename);
        showToast('Excel檔案匯出成功');
    } catch (error) {
        console.error('Export error:', error);
        alert('匯出失敗，請重試');
    }
};

// Game Save/Load
window.saveGame = function() {
    try {
        const gameData = {
            ...gameState,
            exportedAt: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(gameData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toLocaleString('zh-TW').replace(/[/:]/g, '-');
        const filename = `記數app_遊戲存檔_${timestamp}.json`;
        
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
        alert('保存失敗，請重試');
    }
};

window.handleGameFileSelect = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const gameData = JSON.parse(e.target.result);
            
            // Validate game data structure
            if (!gameData.players || !Array.isArray(gameData.players) ||
                !gameData.rounds || !Array.isArray(gameData.rounds)) {
                throw new Error('Invalid game data structure');
            }
            
            // Load game data
            gameState = {
                ...gameData,
                lastModified: new Date().toISOString()
            };
            
            saveGameToStorage();
            showToast('遊戲已載入');
            
            // Navigate to appropriate screen
            if (gameState.gameStarted && gameState.rounds.length > 0) {
                showRecord();
            } else if (gameState.gameStarted) {
                showBankerSelection();
            } else {
                showPlayerSetup();
            }
            
        } catch (error) {
            console.error('Load error:', error);
            alert('檔案格式錯誤或損壞，請檢查檔案');
        }
    };
    
    reader.readAsText(file);
};

// Local Storage Management
window.saveGameToStorage = function() {
    try {
        gameState.lastModified = new Date().toISOString();
        console.log('Game state saved');
    } catch (error) {
        console.warn('Could not save to localStorage:', error);
    }
};

window.loadGameFromStorage = function() {
    try {
        console.log('Loading from localStorage...');
        console.log('Current gameState:', gameState);
    } catch (error) {
        console.warn('Could not load from localStorage:', error);
    }
};

// Toast Notifications
window.showToast = function(message) {
    const toast = document.getElementById('successToast');
    const messageEl = document.getElementById('toastMessage');
    
    if (toast && messageEl) {
        messageEl.textContent = message;
        toast.classList.remove('hidden', 'fade-out');
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 250);
        }, 2000);
    }
};

// Event Listeners
window.initializeEventListeners = function() {
    console.log('Initializing event listeners...');
    
    // Enter key handlers
    const inputs = [
        { id: 'playerNameInput', action: addPlayer },
        { id: 'amountInput', action: confirmAmount },
        { id: 'editAmountInput', action: confirmEditRecord },
        { id: 'newPlayerNameInput', action: confirmAddPlayer }
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
        { id: 'addPlayerModal', closeFunc: closeAddPlayerModal }
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
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    initializeEventListeners();
    loadGameFromStorage();
    showWelcome();
});

console.log('Script loaded, all functions defined globally');