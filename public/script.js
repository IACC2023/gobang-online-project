// public/script.js

// --- 全局状态管理 ---
const gameState = {
    mode: null, // 'classic' or 'higher'
    type: null, // 'single' or 'dual'
    board: [], // 15x15 棋盘, 0: empty, 1: black, 2: white
    currentPlayer: 1, // 1: black, 2: white
    moveHistory: [], // [{player, x, y, timestamp}, ...]
    isGameActive: false,
    gameOptions: {}, // 存储游戏设置
    isTrueBoardVisible: false, // 用于幕布模式，跟踪是否显示真实棋盘
    startTime: null, // 记录对局开始时间
    isAiThinking: false,
    aiControlTimer5s: null,
    aiControlTimer10s: null,
};

const replayState = { // 回放状态管理
    data: null,
    currentMoveIndex: -1,
    isPlaying: false,
    speed: 1.0,
    timerId: null,
    board: [],
};


// --- DOM 元素引用 ---
const views = {
    home: document.getElementById('home-view'),
    about: document.getElementById('about-view'),
    classicMenu: document.getElementById('classic-menu-view'),
    higherMenu: document.getElementById('higher-menu-view'),
    game: document.getElementById('game-view'),
    replay: document.getElementById('replay-view'),
};

const settingsModal = document.getElementById('game-settings-modal');
const boardCanvas = document.getElementById('gobang-board');
const ctx = boardCanvas.getContext('2d');
const moveListEl = document.getElementById('move-list');
const gameTitleEl = document.getElementById('game-title');
const gameClockEl = document.getElementById('game-clock');
const toggleBoardBtn = document.getElementById('toggle-board-btn');
const aiStatusPanel = document.getElementById('ai-status-panel');
const aiStatusText = document.getElementById('ai-status-text');
const aiControls = document.getElementById('ai-controls');
const replayFileInput = document.getElementById('replay-file-input');
const replayContentEl = document.getElementById('replay-content');
const replayFileSelectorEl = document.getElementById('replay-file-selector');
const replayBoardCanvas = document.getElementById('replay-board');
const replayCtx = replayBoardCanvas.getContext('2d');
const replayMoveListEl = document.getElementById('replay-move-list');
const replayMetaInfoEl = document.getElementById('replay-meta-info');
const replayControlsEl = document.getElementById('replay-controls');
const replayTitleEl = document.getElementById('replay-title');

const GRID_SIZE = 15;
const CELL_SIZE = boardCanvas.width / GRID_SIZE;

// --- 页面导航逻辑 ---
function showView(viewId) {
    document.title = '五子棋';
    for (const id in views) {
        views[id].classList.remove('active');
    }
    views[viewId].classList.add('active');
}

// --- 初始化与事件监听 ---
document.addEventListener('DOMContentLoaded', () => {
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
    document.getElementById('home-to-about-btn').addEventListener('click', loadAboutInfo);
    
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
            const mode = e.target.dataset.mode;
            const type = e.target.dataset.type;
            openSettingsModal(mode, type);
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

    document.getElementById('cancel-settings-btn').addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });
    
    // 游戏内交互
    boardCanvas.addEventListener('click', handleBoardClick);
    document.getElementById('undo-btn').addEventListener('click', undoMove);
    document.getElementById('save-replay-btn').addEventListener('click', saveReplay);
    document.getElementById('game-back-to-home-btn').addEventListener('click', () => showView('home'));
    toggleBoardBtn.addEventListener('click', toggleTrueBoard);
    
    // 回放文件加载
    replayFileInput.addEventListener('change', handleFileLoad);
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
    console.log(`Starting game: ${mode}, ${type}`, options);
    gameState.gameOptions = options;
    
    if (options.initialBoard) {
        // 从回放状态恢复
        gameState.board = options.initialBoard;
        gameState.currentPlayer = options.initialPlayer;
        gameState.moveHistory = options.initialMoveHistory;
    } else {
        // 开始一个全新的游戏
        gameState.board = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
        gameState.currentPlayer = 1;
        gameState.moveHistory = [];
    }
    
    gameState.isGameActive = true;
    gameState.isTrueBoardVisible = false;
    gameState.startTime = new Date().toISOString(); 

    // 更新UI
    if (mode === 'higher') {
        toggleBoardBtn.classList.remove('hidden');
        toggleBoardBtn.textContent = '显示黑白子棋盘';
    } else {
        toggleBoardBtn.classList.add('hidden');
    }
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

    // 检查恢复后的游戏是否轮到AI
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
        if (gameState.currentPlayer !== playerToken) {
            console.log("现在是AI的回合");
            return;
        }
    }

    const rect = boardCanvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / (CELL_SIZE + 0.5));
    const y = Math.floor((event.clientY - rect.top) / (CELL_SIZE + 0.5));
    
    placePiece(x, y);
}

function placePiece(x, y) {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE || gameState.board[y][x] !== 0) {
        return;
    }
    
    if (gameState.isAiThinking) {
        clearAiTimersAndHideControls();
    }
    
    // 禁手规则判断
    if (gameState.currentPlayer === 1 && gameState.gameOptions.enableForbiddenMoves) {
        if (getLineCount(x, y, 1).some(count => count === 5)) {
            // 制胜一步，不是禁手
        } else if (isForbiddenMove(x, y)) {
            alert("禁手落子点: 您不能在此处形成长连、双四或双三。");
            return;
        }
    }

    gameState.board[y][x] = gameState.currentPlayer;
    const move = { player: gameState.currentPlayer, x, y, timestamp: Date.now() };
    gameState.moveHistory.push(move);

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
        let winnerText = gameState.currentPlayer === 1 ? '黑棋' : '白棋';
        if (gameState.mode === 'higher') {
            const winnerIndex = gameState.moveHistory.length - 1;
            winnerText = winnerIndex % 2 === 0 ? '玩家P1' : '玩家P2';
        }
        setTimeout(() => alert(`${winnerText} 胜利!`), 100);
        return;
    }

    gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;

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


// --- 禁手规则逻辑 ---
function getLineCount(x, y, player, board = gameState.board) {
    const directions = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }];
    const counts = [];

    for (const dir of directions) {
        let count = 1;
        for (let i = 1; i < 6; i++) {
            const nx = x + i * dir.dx, ny = y + i * dir.dy;
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && board[ny][nx] === player) count++;
            else break;
        }
        for (let i = 1; i < 6; i++) {
            const nx = x - i * dir.dx, ny = y - i * dir.dy;
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && board[ny][nx] === player) count++;
            else break;
        }
        counts.push(count);
    }
    return counts;
}

function isForbiddenMove(x, y) {
    const player = 1;
    const tempBoard = JSON.parse(JSON.stringify(gameState.board));
    tempBoard[y][x] = player;

    const lineCounts = getLineCount(x, y, player, tempBoard);
    if (lineCounts.some(count => count > 5)) {
        return true; // 长连
    }

    let fourCount = 0;
    let threeCount = 0;
    const directions = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }];

    for (const dir of directions) {
        if (isLiveFour(tempBoard, x, y, dir)) fourCount++;
        if (isLiveThree(tempBoard, x, y, dir)) threeCount++;
    }
    
    return fourCount >= 2 || threeCount >= 2;
}

function getLinePattern(board, x, y, dir) {
    let line = [{ p: board[y][x] }];
    for (let i = 1; i <= 4; i++) {
        const nx = x + i * dir.dx, ny = y + i * dir.dy;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) line.push({ p: board[ny][nx] });
        else line.push({ p: 3 });
    }
    for (let i = 1; i <= 4; i++) {
        const nx = x - i * dir.dx, ny = y - i * dir.dy;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) line.unshift({ p: board[ny][nx] });
        else line.unshift({ p: 3 });
    }
    return line.map(c => c.p === 1 ? 'B' : (c.p === 2 ? 'W' : (c.p === 0 ? '_' : 'E'))).join('');
}

function isLiveFour(board, x, y, dir) {
    const pattern = getLinePattern(board, x, y, dir);
    const patterns = ['_BBBB_', 'B_BBB', 'BB_BB', 'BBB_B'];
    return patterns.some(p => pattern.includes(p));
}

function isLiveThree(board, x, y, dir) {
    const pattern = getLinePattern(board, x, y, dir);
    if (isLiveFour(board, x, y, dir)) return false; 
    const patterns = ['_B_BB_', '_BB_B_'];
    return patterns.some(p => pattern.includes(p));
}

// --- AI 对战逻辑 ---
function getAiMove() {
    if (gameState.isAiThinking) return;

    gameState.isAiThinking = true;
    aiStatusText.textContent = 'AI 正在思考中...';
    aiStatusPanel.classList.remove('hidden');
    aiControls.innerHTML = '';

    const aiPlayer = gameState.gameOptions.playerOrder === 'player' ? 2 : 1;

    if (gameState.aiControlTimer5s) clearTimeout(gameState.aiControlTimer5s);
    if (gameState.aiControlTimer10s) clearTimeout(gameState.aiControlTimer10s);

    gameState.aiControlTimer5s = setTimeout(() => {
        aiStatusText.textContent = 'AI 思考时间过长...';
        showAiControls(['retry']);
    }, 5000);

    gameState.aiControlTimer10s = setTimeout(() => {
        showAiControls(['retry', 'override', 'local']);
    }, 10000);

    fetch('/api/get-ai-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            boardState: gameState.board,
            moveHistory: gameState.moveHistory,
            aiModel: gameState.gameOptions.aiModel,
            playerColor: aiPlayer,
        }),
    })
    .then(res => res.ok ? res.json() : Promise.reject(new Error(`API 错误，状态码: ${res.status}`)))
    .then(data => {
        if (data.error) throw new Error(data.error);
        const [y, x] = data.move;
        
        if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE || gameState.board[y][x] !== 0) {
            console.error("AI返回了无效坐标:", data.move);
            aiStatusText.textContent = 'AI 返回了无效棋步，正在自动重试...';
            getAiMove();
            return;
        }
        placePiece(x, y);
    })
    .catch(err => {
        console.error('AI请求失败:', err);
        aiStatusText.textContent = `AI 出错: ${err.message}`;
        showAiControls(['retry', 'override', 'local']);
    });
}

function showAiControls(buttonsToShow) {
    aiControls.innerHTML = '';
    if (buttonsToShow.includes('retry')) {
        const btn = document.createElement('button');
        btn.textContent = '重试';
        btn.onclick = getAiMove;
        aiControls.appendChild(btn);
    }
    if (buttonsToShow.includes('override')) {
        const btn = document.createElement('button');
        btn.textContent = '替AI下棋';
        btn.onclick = () => {
            alert('请在棋盘上为您想让AI下的位置点击。');
            clearAiTimersAndHideControls();
        };
        aiControls.appendChild(btn);
    }
    if (buttonsToShow.includes('local')) {
        const btn = document.createElement('button');
        btn.textContent = '使用本地智能';
        btn.onclick = () => {
            alert('本地智能功能：请在棋盘上为您想让AI下的位置点击。');
            clearAiTimersAndHideControls();
        };
        aiControls.appendChild(btn);
    }
}

function clearAiTimersAndHideControls() {
    if (gameState.aiControlTimer5s) clearTimeout(gameState.aiControlTimer5s);
    if (gameState.aiControlTimer10s) clearTimeout(gameState.aiControlTimer10s);
    aiStatusPanel.classList.add('hidden');
    aiControls.innerHTML = '';
    gameState.isAiThinking = false;
}

// --- 游戏内控制与UI更新 ---
function undoMove() {
    if (gameState.moveHistory.length === 0) return;

    const stepsToUndo = (gameState.type === 'single' && gameState.moveHistory.length > 1) ? 2 : 1;
    if (gameState.moveHistory.length < stepsToUndo) {
        const move = gameState.moveHistory.pop();
        gameState.board[move.y][move.x] = 0;
        gameState.currentPlayer = move.player;
    } else {
        for (let i = 0; i < stepsToUndo; i++) {
            const lastMove = gameState.moveHistory.pop();
            gameState.board[lastMove.y][lastMove.x] = 0;
            gameState.currentPlayer = lastMove.player;
        }
    }
    
    if (!gameState.isGameActive) gameState.isGameActive = true;
    if (gameState.mode === 'higher') {
        gameState.isTrueBoardVisible = false;
        toggleBoardBtn.textContent = '显示黑白子棋盘';
    }

    updateMoveList();
    drawBoard();
    drawPieces();
}

function toggleTrueBoard() {
    if (gameState.mode !== 'higher' || !gameState.isGameActive) return;
    gameState.isTrueBoardVisible = !gameState.isTrueBoardVisible;
    toggleBoardBtn.textContent = gameState.isTrueBoardVisible ? '恢复幕布棋盘' : '显示黑白子棋盘';
    drawBoard();
    drawPieces();
}

function updateMoveList() {
    moveListEl.innerHTML = ''; 
    if (!gameState.moveHistory) return;
    
    gameState.moveHistory.forEach((move, index) => {
        const li = document.createElement('li');
        const time = new Date(move.timestamp).toLocaleTimeString();
        let playerText = '';
        if (gameState.mode === 'higher') {
            playerText = index % 2 === 0 ? '玩家P1' : '玩家P2'; 
        } else {
            playerText = move.player === 1 ? '黑子' : '白子';
        }
        li.textContent = `${time} - ${playerText} 落子于 (${move.x}, ${move.y})`;
        moveListEl.prepend(li);
    });
}

function updateClock() {
    const now = new Date();
    const formattedTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${now.toLocaleTimeString()}`;
    const timezone = `(UTC${now.getTimezoneOffset() > 0 ? '-' : '+'}${Math.abs(now.getTimezoneOffset() / 60)})`;
    if (views.game.classList.contains('active')) {
        gameClockEl.textContent = `${formattedTime} ${timezone}`;
    }
}

async function loadAboutInfo() {
    try {
        const response = await fetch('/api/about');
        const html = await response.text();
        document.getElementById('about-content').innerHTML = html;
        document.title = '五子棋 – 关于';
        showView('about');
    } catch (error) {
        console.error('加载“关于”信息失败:', error);
    }
}

// --- 存盘与回放 ---
function saveReplay() {
    if (gameState.moveHistory.length === 0) {
        alert("对局尚未开始，无法保存！");
        return;
    }

    const replayData = {
        fileFormatVersion: "1.0",
        saveTimestamp: new Date().toISOString(),
        gameInfo: {
            mode: gameState.mode,
            type: gameState.type,
            options: gameState.gameOptions,
            startTime: gameState.startTime,
            winner: gameState.isGameActive ? "interrupted" : gameState.currentPlayer,
        },
        deviceInfo: { userAgent: navigator.userAgent },
        moveHistory: gameState.moveHistory.map(move => ({
            player: move.player,
            x: move.x,
            y: move.y,
            timestamp: move.timestamp
        }))
    };

    const jsonString = JSON.stringify(replayData, null, 2);
    const date = new Date(gameState.startTime);
    const timeString = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
    const filenameSuffix = "GobangReplay";
    const filename = `${timeString}-${filenameSuffix}.ftidea`;

    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
        } catch (error) {
            alert(`加载录像文件失败: ${error.message}`);
        }
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
    let winnerText = data.gameInfo.winner === 'interrupted' ? '中断对局，对局尚未分出胜负' : (data.gameInfo.winner === 1 ? '黑棋' : '白棋');
    replayMetaInfoEl.innerHTML = `<p><strong>对局时间:</strong> ${startTime.toLocaleString()}</p><p><strong>对局模式:</strong> ${data.gameInfo.mode} - ${data.gameInfo.type}</p><p><strong>最终获胜者:</strong> ${winnerText}</p>`;

    replayControlsEl.innerHTML = '';
    const controls = [
        { text: '返回主菜单', action: () => { showView('home'); replayContentEl.classList.add('hidden'); replayFileSelectorEl.classList.remove('hidden'); replayFileInput.value = ''; } },
        { text: '上一步', action: handleReplayPrev },
        { text: '暂停/继续', action: handleReplayPlayPause },
        { text: '下一步', action: handleReplayNext },
    ];
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
    const lastMove = replayState.data.moveHistory[replayState.currentMoveIndex];
    const nextPlayer = lastMove ? (lastMove.player % 2) + 1 : 1;
    const gameType = prompt("从当前棋局开始一场新的游戏，请选择模式: (输入 'single' 或 'dual')", "dual");
    if (gameType !== 'single' && gameType !== 'dual') return;
    const options = {
        playerOrder: 'player',
        aiModel: 'INTERMEDIATE_MODEL',
        enableForbiddenMoves: false,
        unifiedColor: '1',
        initialBoard: capturedBoard,
        initialPlayer: nextPlayer,
        initialMoveHistory: replayState.data.moveHistory.slice(0, replayState.currentMoveIndex + 1)
    };
    startGame('classic', gameType, options);
}

function renderReplayStep() {
    replayState.board.forEach(row => row.fill(0));
    for (let i = 0; i <= replayState.currentMoveIndex; i++) {
        const move = replayState.data.moveHistory[i];
        replayState.board[move.y][move.x] = move.player;
    }
    drawReplayBoard();
    replayMoveListEl.innerHTML = '';
    for (let i = 0; i <= replayState.currentMoveIndex; i++) {
        const move = replayState.data.moveHistory[i];
        const li = document.createElement('li');
        const time = new Date(move.timestamp).toLocaleTimeString();
        let playerText = move.player === 1 ? '黑子' : '白子';
        li.textContent = `${time} - ${playerText} 落子于 (${move.x}, ${move.y})`;
        replayMoveListEl.prepend(li);
    }
}

function handleReplayNext() {
    if (replayState.currentMoveIndex < replayState.data.moveHistory.length - 1) {
        replayState.currentMoveIndex++;
        renderReplayStep();
    } else {
        if (replayState.isPlaying) handleReplayPlayPause();
    }
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
    const currentMove = replayState.data.moveHistory[replayState.currentMoveIndex];
    const nextMove = replayState.data.moveHistory[replayState.currentMoveIndex + 1];
    const timeDiff = nextMove.timestamp - (currentMove ? currentMove.timestamp : replayState.data.gameInfo.startTime);
    const delay = Math.max(100, timeDiff / replayState.speed);
    replayState.timerId = setTimeout(() => {
        handleReplayNext();
        if (replayState.isPlaying) scheduleNextMove();
    }, delay);
}


// --- 绘图函数 ---
function drawBoard() {
    const ctx = boardCanvas.getContext('2d');
    ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    ctx.fillStyle = 'hsla(34, 59%, 68%, 1)';
    ctx.fillRect(0,0,boardCanvas.width, boardCanvas.height);
    ctx.strokeStyle = 'hsla(34, 41%, 29%, 1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < GRID_SIZE; i++) {
        const pos = CELL_SIZE / 2 + i * CELL_SIZE;
        ctx.beginPath();
        ctx.moveTo(pos, CELL_SIZE / 2);
        ctx.lineTo(pos, boardCanvas.height - CELL_SIZE / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(CELL_SIZE / 2, pos);
        ctx.lineTo(boardCanvas.width - CELL_SIZE / 2, pos);
        ctx.stroke();
    }
    const starPoints = [ {x:3, y:3}, {x:11, y:3}, {x:7, y:7}, {x:3, y:11}, {x:11, y:11} ];
    ctx.fillStyle = 'hsla(34, 41%, 29%, 1)';
    starPoints.forEach(p => {
        ctx.beginPath();
        ctx.arc(CELL_SIZE/2 + p.x*CELL_SIZE, CELL_SIZE/2 + p.y*CELL_SIZE, CELL_SIZE/8, 0, 2*Math.PI);
        ctx.fill();
    });
}

function drawPieces() {
    const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (gameState.board[y][x] !== 0) {
                const piecePlayer = gameState.board[y][x];
                drawPiece(boardCanvas.getContext('2d'), x, y, piecePlayer);
                if (lastMove && lastMove.x === x && lastMove.y === y) {
                    drawRedDot(boardCanvas.getContext('2d'), x, y);
                }
            }
        }
    }
}

function drawPiece(ctx, x, y, player) {
    ctx.beginPath();
    const radius = CELL_SIZE / 2 * 0.9;
    const centerX = CELL_SIZE / 2 + x * CELL_SIZE;
    const centerY = CELL_SIZE / 2 + y * CELL_SIZE;
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    let pieceColor;
    if (gameState.isGameActive && gameState.mode === 'higher' && !gameState.isTrueBoardVisible) {
        pieceColor = gameState.gameOptions.unifiedColor === '1' ? 'black' : 'white';
    } else {
        pieceColor = player === 1 ? 'black' : 'white';
    }
    ctx.fillStyle = pieceColor;
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.stroke();
}

function drawRedDot(ctx, x, y) {
    ctx.beginPath();
    const radius = CELL_SIZE / 8;
    const centerX = CELL_SIZE / 2 + x * CELL_SIZE;
    const centerY = CELL_SIZE / 2 + y * CELL_SIZE;
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = 'red';
    ctx.fill();
}

function drawReplayBoard() {
    const ctx = replayCtx;
    ctx.clearRect(0, 0, replayBoardCanvas.width, replayBoardCanvas.height);
    ctx.fillStyle = 'hsla(34, 59%, 68%, 1)';
    ctx.fillRect(0,0,replayBoardCanvas.width, replayBoardCanvas.height);
    ctx.strokeStyle = 'hsla(34, 41%, 29%, 1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < GRID_SIZE; i++) { const pos = CELL_SIZE / 2 + i * CELL_SIZE; ctx.beginPath(); ctx.moveTo(pos, CELL_SIZE / 2); ctx.lineTo(pos, replayBoardCanvas.height - CELL_SIZE / 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(CELL_SIZE / 2, pos); ctx.lineTo(replayBoardCanvas.width - CELL_SIZE / 2, pos); ctx.stroke(); }

    const lastMove = replayState.data.moveHistory[replayState.currentMoveIndex];
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (replayState.board[y][x] !== 0) {
                const player = replayState.board[y][x];
                drawPiece(ctx, x, y, player);
                if (lastMove && lastMove.x === x && lastMove.y === y) {
                    drawRedDot(ctx, x, y);
                }
            }
        }
    }
}
