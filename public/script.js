// public/script.js

// --- 全局状态管理 ---
const gameState = {
    mode: null, type: null, board: [], currentPlayer: 1,
    moveHistory: [], // action: {type: 'place' | 'undo', player, x, y, timestamp, originalMove?}
    isGameActive: false, gameOptions: {}, isTrueBoardVisible: false,
    startTime: null, isAiThinking: false, aiControlTimer5s: null, aiControlTimer10s: null,
};

const replayState = {
    data: null, currentMoveIndex: -1, isPlaying: false, speed: 1.0, timerId: null, board: [],
};

// --- DOM 元素引用 (在此处仅声明) ---
let views = {}; // **修复**: 在此处声明为空对象
let settingsModal, aboutModal, boardCanvas, ctx, moveListEl, gameTitleEl, gameClockEl, toggleBoardBtn;
let aiStatusPanel, aiStatusText, aiControls, replayFileInput, replayContentEl, replayFileSelectorEl;
let replayBoardCanvas, replayCtx, replayMoveListEl, replayMetaInfoEl, replayControlsEl, replayTitleEl;

const GRID_SIZE = 15;
let CELL_SIZE; // 将在初始化时计算

// --- 初始化与事件监听 ---
document.addEventListener('DOMContentLoaded', () => {
    // **修复**: DOM加载完成后再获取所有元素引用
    views = {
        home: document.getElementById('home-view'),
        classicMenu: document.getElementById('classic-menu-view'),
        higherMenu: document.getElementById('higher-menu-view'),
        game: document.getElementById('game-view'),
        replay: document.getElementById('replay-view'),
    };
    settingsModal = document.getElementById('game-settings-modal');
    aboutModal = document.getElementById('about-modal');
    boardCanvas = document.getElementById('gobang-board');
    ctx = boardCanvas.getContext('2d');
    CELL_SIZE = boardCanvas.width / GRID_SIZE;
    moveListEl = document.getElementById('move-list');
    gameTitleEl = document.getElementById('game-title');
    gameClockEl = document.getElementById('game-clock');
    toggleBoardBtn = document.getElementById('toggle-board-btn');
    aiStatusPanel = document.getElementById('ai-status-panel');
    aiStatusText = document.getElementById('ai-status-text');
    aiControls = document.getElementById('ai-controls');
    replayFileInput = document.getElementById('replay-file-input');
    replayContentEl = document.getElementById('replay-content');
    replayFileSelectorEl = document.getElementById('replay-file-selector');
    replayBoardCanvas = document.getElementById('replay-board');
    replayCtx = replayBoardCanvas.getContext('2d');
    replayMoveListEl = document.getElementById('replay-move-list');
    replayMetaInfoEl = document.getElementById('replay-meta-info');
    replayControlsEl = document.getElementById('replay-controls');
    replayTitleEl = document.getElementById('replay-title');

    setupEventListeners();
    drawBoard();
    setInterval(updateClock, 1000);
    showView('home');
});

function setupEventListeners() {
    // 首页按钮
    document.getElementById('home-to-classic-btn').addEventListener('click', () => {
        document.title = '五子棋 – 经典五子棋';
        showView('classicMenu');
    });
    document.getElementById('home-to-higher-btn').addEventListener('click', () => {
        document.title = '五子棋 – 幕布五子棋';
        showView('higherMenu');
    });
    document.getElementById('home-to-replay-btn').addEventListener('click', () => {
        document.title = '棋局录像回放';
        showView('replay');
    });
    
    // 全局关于按钮
    document.getElementById('global-about-btn').addEventListener('click', loadAboutInfo);
    document.getElementById('close-about-modal-btn').addEventListener('click', () => aboutModal.classList.add('hidden'));

    // 返回首页按钮
    document.querySelectorAll('.back-to-home').forEach(btn => {
        btn.addEventListener('click', () => {
            document.title = '五子棋 – 首页';
            showView('home');
        });
    });

    // 开始游戏按钮
    document.querySelectorAll('.start-game-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            openSettingsModal(e.target.dataset.mode, e.target.dataset.type);
        });
    });

    // 设置弹窗内的按钮事件
    document.getElementById('confirm-start-game-btn').addEventListener('click', () => {
        const options = {
            playerOrder: document.querySelector('input[name="player-order"]:checked')?.value,
            aiModel: document.getElementById('ai-model-select').value,
            enableForbiddenMoves: document.getElementById('enable-forbidden-moves').checked,
            unifiedColor: document.querySelector('input[name="unified-color"]:checked')?.value
        };
        startGame(gameState.mode, gameState.type, options);
        settingsModal.classList.add('hidden');
    });
    document.getElementById('cancel-settings-btn').addEventListener('click', () => { settingsModal.classList.add('hidden'); });
    
    // 游戏内交互
    boardCanvas.addEventListener('click', handleBoardClick);
    document.getElementById('undo-btn').addEventListener('click', undoMove);
    document.getElementById('save-replay-btn').addEventListener('click', saveReplay);
    document.getElementById('game-back-to-home-btn').addEventListener('click', () => {
        document.title = '五子棋 – 首页';
        showView('home')
    });
    toggleBoardBtn.addEventListener('click', toggleTrueBoard);
    
    // 回放文件加载
    replayFileInput.addEventListener('change', handleFileLoad);
}

// --- 页面导航逻辑 ---
function showView(viewId) {
    for (const id in views) {
        if (views[id]) {
            views[id].classList.remove('active');
        }
    }
    if (views[viewId]) {
        views[viewId].classList.add('active');
    } else {
        console.error(`View with id "${viewId}" not found.`);
    }
}


// --- 游戏设置与开始 ---
function openSettingsModal(mode, type) {
    gameState.mode = mode;
    gameState.type = type;
    document.getElementById('single-player-options').style.display = type === 'single' ? 'block' : 'none';
    document.getElementById('classic-mode-options').style.display = mode === 'classic' ? 'block' : 'none';
    document.getElementById('higher-mode-options').style.display = mode === 'higher' ? 'block' : 'none';
    settingsModal.classList.remove('hidden');
}

function startGame(mode, type, options) {
    gameState.gameOptions = options;
    if (options.initialBoard) {
        gameState.board = options.initialBoard;
        gameState.currentPlayer = options.initialPlayer;
        gameState.moveHistory = options.initialMoveHistory;
    } else {
        gameState.board = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
        gameState.currentPlayer = 1;
        gameState.moveHistory = [];
    }
    
    gameState.isGameActive = true;
    gameState.isTrueBoardVisible = false;
    gameState.startTime = new Date().toISOString(); 
    gameState.mode = mode;
    gameState.type = type;

    if (mode === 'higher') { toggleBoardBtn.classList.remove('hidden'); toggleBoardBtn.textContent = '显示黑白子棋盘'; } 
    else { toggleBoardBtn.classList.add('hidden'); }
    
    let title = mode === 'classic' ? '经典五子棋' : '幕布五子棋';
    title += ` – ${type === 'single' ? '单人游戏' : '双人对战'}`;
    if (type === 'single') {
        const modelName = options.aiModel.split('_')[0];
        title += ` – ${modelName.charAt(0) + modelName.slice(1).toLowerCase()} 模型`;
    }
    gameTitleEl.textContent = title;
    
    updateMoveList();
    drawBoard();
    drawPieces();
    showView('game');

    if (type === 'single' && gameState.isGameActive) {
        const aiPlayer = options.playerOrder === 'player' ? 2 : 1;
        if (gameState.currentPlayer === aiPlayer) {
            getAiMove();
        }
    }
}

// --- 游戏核心逻辑 ---
function handleBoardClick(event) {
    if (!gameState.isGameActive || gameState.isAiThinking) return;

    if (gameState.type === 'single') {
        const playerToken = gameState.gameOptions.playerOrder === 'player' ? 1 : 2;
        if (gameState.currentPlayer !== playerToken) { return; }
    }

    const rect = boardCanvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    const x = Math.round((canvasX - CELL_SIZE / 2) / CELL_SIZE);
    const y = Math.round((canvasY - CELL_SIZE / 2) / CELL_SIZE);
    
    placePiece(x, y);
}

function placePiece(x, y) {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE || gameState.board[y][x] !== 0) { return; }
    if (gameState.isAiThinking) { clearAiTimersAndHideControls(); }
    
    if (gameState.currentPlayer === 1 && gameState.gameOptions.enableForbiddenMoves) {
        if (getLineCount(x, y, 1, gameState.board).some(count => count === 5)) {
            // Winning move is not forbidden
        } else if (isForbiddenMove(x, y)) {
            alert("禁手落子点: 您不能在此处形成长连、双四或双三。");
            return;
        }
    }

    const action = { type: 'place', player: gameState.currentPlayer, x, y, timestamp: Date.now() };
    gameState.moveHistory.push(action);
    rebuildBoardFromHistory();

    updateMoveList();
    drawBoard();
    drawPieces();

    if (checkWin(x, y)) {
        gameState.isGameActive = false;
        if (gameState.mode === 'higher') {
            gameState.isTrueBoardVisible = true;
            drawBoard();
            drawPieces();
        }
        let winnerText;
        if (gameState.mode === 'higher') {
            const validMoves = getValidMovesFromHistory();
            winnerText = validMoves.length % 2 !== 0 ? '玩家P1' : '玩家P2';
        } else {
            winnerText = gameState.currentPlayer === 1 ? '黑棋' : '白棋';
        }
        setTimeout(() => alert(`${winnerText} 胜利!`), 100);
        return;
    }

    if (gameState.type === 'single' && gameState.isGameActive) {
        const aiPlayer = gameState.gameOptions.playerOrder === 'player' ? 2 : 1;
        if (gameState.currentPlayer === aiPlayer) {
            getAiMove();
        }
    }
}

function checkWin(x, y) {
    const player = gameState.board[y][x];
    if (player === 0) return false;
    const counts = getLineCount(x, y, player);
    if (player === 1 && gameState.gameOptions.enableForbiddenMoves) {
        return counts.some(count => count === 5);
    } else {
        return counts.some(count => count >= 5);
    }
}

// --- 悔棋与状态重构 ---
function rebuildBoardFromHistory() {
    const board = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
    const validMoves = getValidMovesFromHistory();
    validMoves.forEach(move => {
        board[move.y][move.x] = move.player;
    });
    gameState.board = board;
    const lastValidMove = validMoves[validMoves.length - 1];
    gameState.currentPlayer = lastValidMove ? (lastValidMove.player % 2) + 1 : 1;
}

function getValidMovesFromHistory(history = gameState.moveHistory) {
    const moveStack = [];
    for (const action of history) {
        if (action.type === 'place') {
            moveStack.push(action);
        } else if (action.type === 'undo') {
            moveStack.pop();
        }
    }
    return moveStack;
}

function undoMove() {
    const validMoves = getValidMovesFromHistory();
    if (validMoves.length === 0) {
        alert("没有棋步可以悔棋。");
        return;
    }

    const lastValidMove = validMoves[validMoves.length - 1];
    const action = { type: 'undo', player: lastValidMove.player, originalMove: lastValidMove, timestamp: Date.now() };
    gameState.moveHistory.push(action);
    
    if (!gameState.isGameActive) {
        gameState.isGameActive = true;
    }
    
    rebuildBoardFromHistory();
    updateMoveList();
    drawBoard();
    drawPieces();
}

// --- 禁手规则 ---
function getLineCount(x, y, player, board = gameState.board) {
    const directions = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }];
    return directions.map(dir => {
        let count = 1;
        for (let i = 1; i < 6; i++) { const nx = x + i * dir.dx, ny = y + i * dir.dy; if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && board[ny][nx] === player) count++; else break; }
        for (let i = 1; i < 6; i++) { const nx = x - i * dir.dx, ny = y - i * dir.dy; if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && board[ny][nx] === player) count++; else break; }
        return count;
    });
}

function isForbiddenMove(x, y) {
    const tempBoard = JSON.parse(JSON.stringify(gameState.board));
    tempBoard[y][x] = 1;
    if (getLineCount(x, y, 1, tempBoard).some(c => c > 5)) return true;
    let fourCount = 0, threeCount = 0;
    const directions = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }];
    for (const dir of directions) {
        if (isLiveFour(tempBoard, x, y, dir)) fourCount++;
        if (isLiveThree(tempBoard, x, y, dir)) threeCount++;
    }
    return fourCount >= 2 || threeCount >= 2;
}

function getLinePattern(board, x, y, dir) {
    let line = [{ p: board[y][x] }];
    for (let i = 1; i <= 5; i++) { const nx = x + i * dir.dx, ny = y + i * dir.dy; if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) line.push({ p: board[ny][nx] }); else { line.push({ p: 3 }); break; } }
    for (let i = 1; i <= 5; i++) { const nx = x - i * dir.dx, ny = y - i * dir.dy; if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) line.unshift({ p: board[ny][nx] }); else { line.unshift({ p: 3 }); break; } }
    return line.map(c => c.p === 1 ? 'B' : (c.p === 2 ? 'W' : (c.p === 0 ? '_' : 'E'))).join('');
}

function isLiveFour(board, x, y, dir) { const p = getLinePattern(board, x, y, dir); return p.includes('_BBBB_'); }
function isLiveThree(board, x, y, dir) { if (isLiveFour(board,x,y,dir)) return false; const p = getLinePattern(board,x,y,dir); return p.includes('_B_BB_') || p.includes('_BB_B_'); }


// --- AI 对战与本地智能 ---
function getAiMove() {
    if (gameState.isAiThinking) return;
    gameState.isAiThinking = true;
    aiStatusPanel.classList.remove('hidden');
    updateAiStatus('AI 正在思考中...', []);
    gameState.aiControlTimer5s = setTimeout(() => { updateAiStatus('AI 思考时间过长...', ['retry']); }, 5000);
    gameState.aiControlTimer10s = setTimeout(() => { updateAiStatus('AI 无响应，您可以...', ['retry', 'override', 'local']); }, 10000);
    fetch('/api/get-ai-move', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            boardState: gameState.board, moveHistory: getValidMovesFromHistory(),
            aiModel: gameState.gameOptions.aiModel, playerColor: gameState.currentPlayer,
        }),
    })
    .then(res => res.ok ? res.json() : Promise.reject(new Error(`API 错误: ${res.status}`)))
    .then(data => {
        if (data.error) throw new Error(data.error);
        clearAiTimersAndHideControls();
        const [y, x] = data.move;
        if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE || gameState.board[y][x] !== 0) {
            throw new Error("AI返回了无效坐标");
        }
        placePiece(x, y);
    })
    .catch(err => {
        console.error('AI请求失败:', err);
        updateAiStatus(`AI 出错: ${err.message}`, ['retry', 'override', 'local']);
    });
}

function updateAiStatus(text, buttonsToShow) {
    aiStatusText.textContent = text;
    aiControls.innerHTML = '';
    if (buttonsToShow.includes('retry')) { const btn = document.createElement('button'); btn.textContent = '重试'; btn.onclick = () => { clearAiTimersAndHideControls(); getAiMove(); }; aiControls.appendChild(btn); }
    if (buttonsToShow.includes('override')) { const btn = document.createElement('button'); btn.textContent = '替AI下棋'; btn.onclick = () => { alert('请在棋盘上为您想让AI下的位置点击。'); clearAiTimersAndHideControls(); }; aiControls.appendChild(btn); }
    if (buttonsToShow.includes('local')) { const btn = document.createElement('button'); btn.textContent = '使用本地智能'; btn.onclick = () => { clearAiTimersAndHideControls(); const move = calculateLocalAiMove(); if (move) { placePiece(move.x, move.y); } else { alert("本地智能未能找到合适的棋步。"); } }; aiControls.appendChild(btn); }
}

function clearAiTimersAndHideControls() {
    if (gameState.aiControlTimer5s) clearTimeout(gameState.aiControlTimer5s);
    if (gameState.aiControlTimer10s) clearTimeout(gameState.aiControlTimer10s);
    aiStatusPanel.classList.add('hidden');
    gameState.isAiThinking = false;
}

function calculateLocalAiMove() {
    const board = gameState.board;
    const aiPlayer = gameState.currentPlayer;
    let bestScore = -Infinity;
    let bestMove = null;
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (board[y][x] === 0) {
                const score = getMoveScore(board, x, y, aiPlayer);
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { x, y };
                }
            }
        }
    }
    return bestMove;
}

function getMoveScore(board, x, y, player) {
    const scores = { 5: 100000, 4: 10000, 3: 100, 2: 10, 1: 1 };
    let totalScore = 0;
    const opponent = player === 1 ? 2 : 1;
    // Calculate offensive score
    board[y][x] = player;
    let counts = getLineCount(x, y, player, board);
    counts.forEach(count => { totalScore += scores[Math.min(count, 5)] || 0; });
    // Calculate defensive score
    board[y][x] = opponent;
    counts = getLineCount(x, y, opponent, board);
    counts.forEach(count => { totalScore += (scores[Math.min(count, 5)] || 0) * 0.9; });
    board[y][x] = 0;
    return totalScore;
}

// --- UI 更新与辅助函数 ---
async function loadAboutInfo() {
    const contentEl = document.getElementById('about-modal-content');
    contentEl.innerHTML = '<p>正在加载信息...</p>'; // Show loading indicator
    aboutModal.classList.remove('hidden');
    try {
        const response = await fetch('/api/about');
        if (!response.ok) {
            throw new Error(`API 请求失败，状态: ${response.status}`);
        }
        const html = await response.text();
        if (!html.trim()) {
            contentEl.innerHTML = '<p>未能加载“关于”信息，内容为空。</p>';
        } else {
            contentEl.innerHTML = html;
        }
    } catch (error) {
        console.error('加载“关于”信息失败:', error);
        contentEl.innerHTML = `<p style="color: red;">加载信息时出错: ${error.message}</p>`;
    }
}

function updateMoveList() {
    moveListEl.innerHTML = '';
    if (!gameState.moveHistory) return;
    const moveIndexMap = new Map();
    getValidMovesFromHistory().forEach((move, index) => { const key = `${move.x}-${move.y}-${move.timestamp}`; moveIndexMap.set(key, index); });
    gameState.moveHistory.slice().reverse().forEach(action => {
        const li = document.createElement('li');
        const time = new Date(action.timestamp).toLocaleTimeString();
        let text = '';
        if (action.type === 'place') {
            const key = `${action.x}-${action.y}-${action.timestamp}`;
            const moveIndex = moveIndexMap.get(key);
            let playerText = action.player === 1 ? '黑子' : '白子';
            if (gameState.mode === 'higher' && moveIndex !== undefined) {
                playerText = moveIndex % 2 === 0 ? '玩家P1' : '玩家P2';
            }
            text = `${time} - ${playerText} 落子于 (${action.x}, ${action.y})`;
        } else {
            let playerText = action.player === 1 ? '黑方' : '白方';
            text = `${time} - ${playerText} 进行了悔棋`;
            li.style.color = 'var(--secondary-color)'; li.style.fontStyle = 'italic';
        }
        li.textContent = text;
        moveListEl.appendChild(li);
    });
}

function updateClock() {
    const now = new Date();
    const formattedTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${now.toLocaleTimeString()}`;
    const timezoneOffset = -now.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
    const offsetSign = timezoneOffset >= 0 ? '+' : '-';
    const timezone = `(UTC${offsetSign}${offsetHours})`;
    if (views.game.classList.contains('active')) { gameClockEl.textContent = `${formattedTime} ${timezone}`; }
}

// --- 存盘与回放 ---
function saveReplay() {
    if (gameState.moveHistory.length === 0) { alert("对局尚未开始，无法保存！"); return; }
    const validMoves = getValidMovesFromHistory();
    const lastValidMove = validMoves.length > 0 ? validMoves[validMoves.length - 1] : null;
    const winner = gameState.isGameActive ? "interrupted" : (lastValidMove ? lastValidMove.player : "unknown");
    const replayData = {
        fileFormatVersion: "1.1",
        saveTimestamp: new Date().toISOString(),
        gameInfo: { mode: gameState.mode, type: gameState.type, options: gameState.gameOptions, startTime: gameState.startTime, winner: winner },
        deviceInfo: { userAgent: navigator.userAgent },
        moveHistory: gameState.moveHistory
    };
    const jsonString = JSON.stringify(replayData, null, 2);
    const date = new Date(gameState.startTime);
    const timeString = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
    const filenameSuffix = "GobangReplay";
    const filename = `${timeString}-${filenameSuffix}.ftidea`;
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function handleFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.fileFormatVersion || !data.moveHistory) throw new Error("无效的录像文件格式。");
            setupReplay(data);
        } catch (error) { alert(`加载录像文件失败: ${error.message}`); }
    };
    reader.readAsText(file);
}

function setupReplay(data) {
    replayState.data = data;
    replayState.currentMoveIndex = -1;
    replayState.isPlaying = false;
    replayState.board = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
    if (replayState.timerId) clearTimeout(replayState.timerId);

    replayFileSelectorEl.classList.add('hidden');
    replayContentEl.classList.remove('hidden');
    const startTime = new Date(data.gameInfo.startTime);
    replayTitleEl.textContent = `${startTime.toLocaleString()} 的五子棋棋局回放录像`;
    let winnerText = data.gameInfo.winner === 'interrupted' ? '中断对局' : (data.gameInfo.winner === 1 ? '黑棋' : '白棋');
    replayMetaInfoEl.innerHTML = `<p><strong>对局时间:</strong> ${startTime.toLocaleString()}</p><p><strong>对局模式:</strong> ${data.gameInfo.mode} - ${data.gameInfo.type}</p><p><strong>最终获胜者:</strong> ${winnerText}</p>`;
    
    replayControlsEl.innerHTML = '';
    const controls = [ { text: '返回主菜单', action: () => { showView('home'); replayContentEl.classList.add('hidden'); replayFileSelectorEl.classList.remove('hidden'); replayFileInput.value = ''; } }, { text: '上一步', action: handleReplayPrev }, { text: '暂停/继续', action: handleReplayPlayPause }, { text: '下一步', action: handleReplayNext }, ];
    controls.forEach(c => { const btn = document.createElement('button'); btn.textContent = c.text; btn.onclick = c.action; replayControlsEl.appendChild(btn); });
    const speedSelect = document.createElement('select');
    [1, 2, 4, 8].forEach(s => { const opt = document.createElement('option'); opt.value = s; opt.textContent = `${s}x 倍速`; speedSelect.appendChild(opt); });
    speedSelect.onchange = (e) => { replayState.speed = parseFloat(e.target.value); };
    replayControlsEl.appendChild(speedSelect);
    const startFromHereBtn = document.createElement('button');
    startFromHereBtn.textContent = '从当前对局情况开始';
    startFromHereBtn.onclick = initiateGameFromReplay;
    replayControlsEl.appendChild(startFromHereBtn);
    renderReplayStep();
}

function initiateGameFromReplay() {
    if (!replayState.data) return;
    const capturedBoard = JSON.parse(JSON.stringify(replayState.board));
    const validMoves = getValidMovesFromHistory(replayState.data.moveHistory.slice(0, replayState.currentMoveIndex + 1));
    const lastValidMove = validMoves[validMoves.length - 1];
    const nextPlayer = lastValidMove ? (lastValidMove.player % 2) + 1 : 1;
    const gameType = prompt("从当前棋局开始一场新的游戏，请选择模式: (输入 'single' 或 'dual')", "dual");
    if (gameType !== 'single' && gameType !== 'dual') return;
    const options = {
        playerOrder: 'player', aiModel: 'INTERMEDIATE_MODEL', enableForbiddenMoves: false, unifiedColor: '1',
        initialBoard: capturedBoard, initialPlayer: nextPlayer,
        initialMoveHistory: replayState.data.moveHistory.slice(0, replayState.currentMoveIndex + 1)
    };
    startGame('classic', gameType, options);
}

function renderReplayStep() {
    replayState.board.forEach(row => row.fill(0));
    const validMoves = getValidMovesFromHistory(replayState.data.moveHistory.slice(0, replayState.currentMoveIndex + 1));
    validMoves.forEach(move => { replayState.board[move.y][move.x] = move.player; });
    
    drawReplayBoard();
    replayMoveListEl.innerHTML = '';
    replayState.data.moveHistory.slice(0, replayState.currentMoveIndex + 1).slice().reverse().forEach(action => {
        const li = document.createElement('li');
        const time = new Date(action.timestamp).toLocaleTimeString();
        let text = '';
        if (action.type === 'place') {
            text = `${time} - ${action.player === 1 ? '黑子' : '白子'} 落子于 (${action.x}, ${action.y})`;
        } else {
            text = `${time} - ${action.player === 1 ? '黑方' : '白方'} 进行了悔棋`;
            li.style.color = 'var(--secondary-color)'; li.style.fontStyle = 'italic';
        }
        li.textContent = text;
        replayMoveListEl.appendChild(li);
    });
}

function handleReplayNext() {
    if (replayState.currentMoveIndex < replayState.data.moveHistory.length - 1) {
        replayState.currentMoveIndex++;
        renderReplayStep();
    } else { if (replayState.isPlaying) handleReplayPlayPause(); }
}

function handleReplayPrev() {
    if (replayState.isPlaying) handleReplayPlayPause();
    if (replayState.currentMoveIndex >= 0) {
        replayState.currentMoveIndex--;
        renderReplayStep();
    }
}

function handleReplayPlayPause() {
    replayState.isPlaying = !replayState.isPlaying;
    replayControlsEl.children[2].textContent = replayState.isPlaying ? '暂停' : '继续';
    if (replayState.isPlaying) scheduleNextMove();
    else if (replayState.timerId) clearTimeout(replayState.timerId);
}

function scheduleNextMove() {
    if (!replayState.isPlaying || replayState.currentMoveIndex >= replayState.data.moveHistory.length - 1) {
        if (replayState.isPlaying) handleReplayPlayPause();
        return;
    }
    const currentAction = replayState.data.moveHistory[replayState.currentMoveIndex];
    const nextAction = replayState.data.moveHistory[replayState.currentMoveIndex + 1];
    let timeDiff = nextAction.timestamp - (currentAction ? currentAction.timestamp : new Date(replayState.data.gameInfo.startTime).getTime());
    if (nextAction.type === 'undo') timeDiff = 1000;
    const delay = Math.max(100, timeDiff / replayState.speed);
    replayState.timerId = setTimeout(() => {
        handleReplayNext();
        if (replayState.isPlaying) scheduleNextMove();
    }, delay);
}


// --- 绘图函数 ---
function drawBoard(canvas = boardCanvas) {
    const localCtx = canvas.getContext('2d');
    localCtx.clearRect(0, 0, canvas.width, canvas.height);
    localCtx.fillStyle = 'hsla(34, 59%, 68%, 1)';
    localCtx.fillRect(0,0,canvas.width, canvas.height);
    localCtx.strokeStyle = 'hsla(34, 41%, 29%, 1)';
    localCtx.lineWidth = 1;
    for (let i = 0; i < GRID_SIZE; i++) {
        const pos = CELL_SIZE / 2 + i * CELL_SIZE;
        localCtx.beginPath(); localCtx.moveTo(pos, CELL_SIZE / 2); localCtx.lineTo(pos, canvas.height - CELL_SIZE / 2); localCtx.stroke();
        localCtx.beginPath(); localCtx.moveTo(CELL_SIZE / 2, pos); localCtx.lineTo(canvas.width - CELL_SIZE / 2, pos); localCtx.stroke();
    }
    const starPoints = [ {x:3, y:3}, {x:11, y:3}, {x:7, y:7}, {x:3, y:11}, {x:11, y:11} ];
    localCtx.fillStyle = 'hsla(34, 41%, 29%, 1)';
    starPoints.forEach(p => { localCtx.beginPath(); localCtx.arc(CELL_SIZE/2 + p.x*CELL_SIZE, CELL_SIZE/2 + p.y*CELL_SIZE, CELL_SIZE/8, 0, 2*Math.PI); localCtx.fill(); });
}

function drawPieces() {
    const validMoves = getValidMovesFromHistory();
    const lastMove = validMoves[validMoves.length - 1];
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (gameState.board[y][x] !== 0) {
                const piecePlayer = gameState.board[y][x];
                drawPiece(ctx, x, y, piecePlayer);
                if (lastMove && lastMove.x === x && lastMove.y === y) {
                    drawRedDot(ctx, x, y);
                }
            }
        }
    }
}

function drawPiece(context, x, y, player) {
    context.beginPath();
    const radius = CELL_SIZE / 2 * 0.9;
    const centerX = CELL_SIZE / 2 + x * CELL_SIZE;
    const centerY = CELL_SIZE / 2 + y * CELL_SIZE;
    context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    let pieceColor;
    if (context === ctx && gameState.isGameActive && gameState.mode === 'higher' && !gameState.isTrueBoardVisible) {
        pieceColor = gameState.gameOptions.unifiedColor === '1' ? 'black' : 'white';
    } else {
        pieceColor = player === 1 ? 'black' : 'white';
    }
    context.fillStyle = pieceColor;
    context.fill();
    context.strokeStyle = '#555';
    context.stroke();
}

function drawRedDot(context, x, y) {
    context.beginPath();
    const radius = CELL_SIZE / 8;
    const centerX = CELL_SIZE / 2 + x * CELL_SIZE;
    const centerY = CELL_SIZE / 2 + y * CELL_SIZE;
    context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    context.fillStyle = 'red';
    context.fill();
}

function drawReplayBoard() {
    drawBoard(replayBoardCanvas);
    const lastMove = getValidMovesFromHistory(replayState.data.moveHistory.slice(0, replayState.currentMoveIndex + 1)).pop();
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (replayState.board[y][x] !== 0) {
                const player = replayState.board[y][x];
                drawPiece(replayCtx, x, y, player);
                if (lastMove && lastMove.x === x && lastMove.y === y) {
                    drawRedDot(replayCtx, x, y);
                }
            }
        }
    }
}
