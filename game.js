const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// キャンバスサイズを設定
canvas.width = 800;
canvas.height = 600;

// ゲーム状態
let gameState = 'player1Drawing'; // 'player1Drawing', 'player2Drawing', 'playing', 'player1Win', 'player2Win'

// 描画関連の変数
let isDrawing = false;
let currentPath = [];
const player1Drawing = []; // プレイヤー1の描画データ
const player2Drawing = []; // プレイヤー2の描画データ
const drawingCanvasSize = 80; // 描画キャンバスのサイズ（大きめに設定）
const drawingDisplayScale = 2.0; // 描画の表示倍率（大きく表示する）

// フィールドの定義
const field = {
    x: 100, // フィールドの左上X座標
    y: 100, // フィールドの左上Y座標
    width: 600, // フィールドの幅
    height: 400, // フィールドの高さ
    color: '#1e3a5f' // フィールドの色
};

// プレイヤー1の状態（矢印キー操作）
const player1 = {
    x: canvas.width / 2 - 100,
    y: canvas.height / 2,
    angle: 0, // 角度（ラジアン）- 右を向く
    baseSpeed: 3, // 基本移動速度
    speed: 3, // 現在の移動速度（描画面積によって変動）
    rotationSpeed: 0.05, // 回転速度（ラジアン）
    baseSize: 20, // 基本サイズ
    size: 20, // 現在のサイズ
    color: '#4CAF50', // 緑色
    fallSpeed: 0.3, // 落下速度（サイズが小さくなる速度）
    hasLeftField: false, // 一度フィールド外に出たかどうか
    customDrawing: player1Drawing, // カスタム描画データ
    damageTimer: 0 // ダメージのクールダウンタイマー
};

// プレイヤー2の状態（WASD操作）
const player2 = {
    x: canvas.width / 2 + 100,
    y: canvas.height / 2,
    angle: Math.PI, // 角度（ラジアン）- 左を向く
    baseSpeed: 3, // 基本移動速度
    speed: 3, // 現在の移動速度（描画面積によって変動）
    rotationSpeed: 0.05, // 回転速度（ラジアン）
    baseSize: 20, // 基本サイズ
    size: 20, // 現在のサイズ
    color: '#FF5722', // オレンジ色
    fallSpeed: 0.3, // 落下速度（サイズが小さくなる速度）
    hasLeftField: false, // 一度フィールド外に出たかどうか
    customDrawing: player2Drawing, // カスタム描画データ
    damageTimer: 0 // ダメージのクールダウンタイマー
};

// キーの状態を管理
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false
};

// キーダウンイベント
document.addEventListener('keydown', (e) => {
    // スペースキーでリスタート
    if (e.code === 'Space' && (gameState === 'player1Win' || gameState === 'player2Win')) {
        resetGame();
        e.preventDefault();
        return;
    }
    
    // 描画フェーズでEnterキーを押したら次に進む
    if (e.code === 'Enter' && (gameState === 'player1Drawing' || gameState === 'player2Drawing')) {
        if (gameState === 'player1Drawing') {
            gameState = 'player2Drawing';
        } else if (gameState === 'player2Drawing') {
            gameState = 'playing';
            // ゲーム開始時に両プレイヤーの速度を描画面積に基づいて更新
            updatePlayerSpeed(player1);
            updatePlayerSpeed(player2);
        }
        e.preventDefault();
        return;
    }
    
    // 矢印キーはe.key、WASDはe.codeを使用
    const key = e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
                e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? e.key : e.code;
    if (keys.hasOwnProperty(key)) {
        keys[key] = true;
        e.preventDefault(); // スクロールを防ぐ
    }
});

// キーアップイベント
document.addEventListener('keyup', (e) => {
    // 矢印キーはe.key、WASDはe.codeを使用
    const key = e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
                e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? e.key : e.code;
    if (keys.hasOwnProperty(key)) {
        keys[key] = false;
        e.preventDefault();
    }
});

// 描画の総面積（線の長さの合計）を計算
function calculateDrawingArea(drawing) {
    let totalLength = 0;
    
    for (const path of drawing) {
        for (let i = 0; i < path.length - 1; i++) {
            const dx = path[i + 1].x - path[i].x;
            const dy = path[i + 1].y - path[i].y;
            const length = Math.sqrt(dx * dx + dy * dy);
            totalLength += length;
        }
    }
    
    return totalLength;
}

// 描画面積に基づいて速度を調整
function updatePlayerSpeed(playerObj) {
    const drawingArea = calculateDrawingArea(playerObj.customDrawing);
    
    // 面積が0の場合は基本速度
    if (drawingArea === 0) {
        playerObj.speed = playerObj.baseSpeed;
        return;
    }
    
    // 面積に応じて速度を減少（面積が大きいほど遅くなる）
    // 基準値: 200の面積で速度が半分になるように設定
    const slowdownFactor = 1 / (1 + drawingArea / 200);
    playerObj.speed = playerObj.baseSpeed * slowdownFactor;
    
    // 最低速度を設定（完全に止まらないように）
    playerObj.speed = Math.max(0.5, playerObj.speed);
}

// 描画キャンバスの中心座標を計算
function getDrawingCanvasCenter() {
    return {
        x: canvas.width / 2,
        y: canvas.height / 2
    };
}

// マウスイベント：描画開始
canvas.addEventListener('mousedown', (e) => {
    if (gameState !== 'player1Drawing' && gameState !== 'player2Drawing') {
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const center = getDrawingCanvasCenter();
    const relX = x - center.x;
    const relY = y - center.y;
    
    // 描画エリア内かチェック
    if (Math.abs(relX) <= drawingCanvasSize / 2 && Math.abs(relY) <= drawingCanvasSize / 2) {
        isDrawing = true;
        currentPath = [{x: relX, y: relY}];
    }
});

// マウスイベント：描画中
canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing || (gameState !== 'player1Drawing' && gameState !== 'player2Drawing')) {
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const center = getDrawingCanvasCenter();
    const relX = x - center.x;
    const relY = y - center.y;
    
    // 描画エリア内に制限
    const clampedX = Math.max(-drawingCanvasSize / 2, Math.min(drawingCanvasSize / 2, relX));
    const clampedY = Math.max(-drawingCanvasSize / 2, Math.min(drawingCanvasSize / 2, relY));
    
    currentPath.push({x: clampedX, y: clampedY});
});

// マウスイベント：描画終了
canvas.addEventListener('mouseup', () => {
    if (isDrawing && currentPath.length > 0) {
        if (gameState === 'player1Drawing') {
            player1Drawing.push([...currentPath]);
        } else if (gameState === 'player2Drawing') {
            player2Drawing.push([...currentPath]);
        }
    }
    isDrawing = false;
    currentPath = [];
});

// ゲームをリセット
function resetGame() {
    // ゲーム状態をリセット（描画フェーズから開始）
    gameState = 'player1Drawing';
    
    // 描画データをクリア
    player1Drawing.length = 0;
    player2Drawing.length = 0;
    
    // プレイヤー1をリセット（左側、右を向く）
    player1.x = canvas.width / 2 - 100;
    player1.y = canvas.height / 2;
    player1.angle = 0;
    player1.speed = player1.baseSpeed;
    player1.size = player1.baseSize;
    player1.hasLeftField = false;
    player1.damageTimer = 0;
    
    // プレイヤー2をリセット（右側、左を向く）
    player2.x = canvas.width / 2 + 100;
    player2.y = canvas.height / 2;
    player2.angle = Math.PI;
    player2.speed = player2.baseSpeed;
    player2.size = player2.baseSize;
    player2.hasLeftField = false;
    player2.damageTimer = 0;
}

// フィールド内にいるかチェック
function isInsideField(playerObj) {
    return playerObj.x >= field.x &&
           playerObj.x <= field.x + field.width &&
           playerObj.y >= field.y &&
           playerObj.y <= field.y + field.height;
}

// プレイヤーのカスタム描画を含む全体のバウンディングボックスを取得
function getPlayerTotalBounds(playerObj) {
    const scale = (playerObj.size / drawingCanvasSize) * drawingDisplayScale;
    const drawingBounds = getDrawingBounds(playerObj.customDrawing);
    
    // 四角の範囲
    const bodyMinX = -playerObj.size / 2;
    const bodyMaxX = playerObj.size / 2;
    const bodyMinY = -playerObj.size / 2;
    const bodyMaxY = playerObj.size / 2;
    
    // カスタム描画の範囲（描画の左端が四角の右端に接する）
    const drawingOffsetX = playerObj.size / 2 - drawingBounds.minX * scale;
    const drawingOffsetY = 0;
    
    const drawingMinX = drawingOffsetX + drawingBounds.minX * scale;
    const drawingMaxX = drawingOffsetX + drawingBounds.maxX * scale;
    const drawingMinY = drawingOffsetY + drawingBounds.minY * scale;
    const drawingMaxY = drawingOffsetY + drawingBounds.maxY * scale;
    
    // 全体の範囲
    return {
        minX: Math.min(bodyMinX, drawingMinX),
        maxX: Math.max(bodyMaxX, drawingMaxX),
        minY: Math.min(bodyMinY, drawingMinY),
        maxY: Math.max(bodyMaxY, drawingMaxY)
    };
}

// 回転を考慮した点の変換
function rotatePoint(x, y, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: x * cos - y * sin,
        y: x * sin + y * cos
    };
}

// 点と線分の最短距離を計算
function pointToLineSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
        // 線分が点の場合
        const dpx = px - x1;
        const dpy = py - y1;
        return Math.sqrt(dpx * dpx + dpy * dpy);
    }
    
    // 線分上の最も近い点のパラメータt（0～1）を計算
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    
    // 最も近い点
    const nearestX = x1 + t * dx;
    const nearestY = y1 + t * dy;
    
    // 点と最も近い点の距離
    const dpx = px - nearestX;
    const dpy = py - nearestY;
    return Math.sqrt(dpx * dpx + dpy * dpy);
}

// プレイヤーのカスタム描画の線分をワールド座標に変換
function getWorldSpaceDrawingSegments(playerObj) {
    const scale = (playerObj.size / drawingCanvasSize) * drawingDisplayScale;
    const bounds = getDrawingBounds(playerObj.customDrawing);
    const offsetX = playerObj.size / 2 - bounds.minX * scale;
    const offsetY = 0;
    
    const segments = [];
    
    for (const path of playerObj.customDrawing) {
        for (let i = 0; i < path.length - 1; i++) {
            const x1 = offsetX + path[i].x * scale;
            const y1 = offsetY + path[i].y * scale;
            const x2 = offsetX + path[i + 1].x * scale;
            const y2 = offsetY + path[i + 1].y * scale;
            
            // 回転を適用
            const p1 = rotatePoint(x1, y1, playerObj.angle);
            const p2 = rotatePoint(x2, y2, playerObj.angle);
            
            segments.push({
                x1: p1.x + playerObj.x,
                y1: p1.y + playerObj.y,
                x2: p2.x + playerObj.x,
                y2: p2.y + playerObj.y
            });
        }
    }
    
    return segments;
}

// プレイヤー本体（四角）の四辺を取得
function getPlayerBodySegments(playerObj) {
    const halfSize = playerObj.size / 2;
    
    // 四角の四隅（ローカル座標）
    const corners = [
        { x: -halfSize, y: -halfSize },
        { x: halfSize, y: -halfSize },
        { x: halfSize, y: halfSize },
        { x: -halfSize, y: halfSize }
    ];
    
    // 回転を適用してワールド座標に変換
    const worldCorners = corners.map(c => {
        const rotated = rotatePoint(c.x, c.y, playerObj.angle);
        return {
            x: rotated.x + playerObj.x,
            y: rotated.y + playerObj.y
        };
    });
    
    // 四辺の線分を作成
    const segments = [];
    for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        segments.push({
            x1: worldCorners[i].x,
            y1: worldCorners[i].y,
            x2: worldCorners[next].x,
            y2: worldCorners[next].y
        });
    }
    
    return segments;
}

// プレイヤー同士の衝突判定と処理（白い描画部分と全ての部分）
function checkPlayerCollision() {
    // 両プレイヤーが落下中の場合は判定しない
    if (player1.hasLeftField || player2.hasLeftField) {
        return;
    }
    
    const lineWidth = 3 * drawingDisplayScale; // 線の太さ（当たり判定の半径・小さめに設定）
    const damageAmount = 0.1; // ダメージ量
    const damageCooldown = 10; // ダメージのクールダウン（フレーム数）
    
    // ダメージタイマーを減少
    if (player1.damageTimer > 0) player1.damageTimer--;
    if (player2.damageTimer > 0) player2.damageTimer--;
    
    // プレイヤーのカスタム描画部分と本体を取得
    const p1DrawingSegments = getWorldSpaceDrawingSegments(player1);
    const p2DrawingSegments = getWorldSpaceDrawingSegments(player2);
    const p1BodySegments = getPlayerBodySegments(player1);
    const p2BodySegments = getPlayerBodySegments(player2);
    
    let collisionDetected = false;
    let collisionPoint = null;
    let minDistance = Infinity;
    let p1DrawingHitsP2Body = false; // プレイヤー1の描画がプレイヤー2の本体に当たったか
    let p2DrawingHitsP1Body = false; // プレイヤー2の描画がプレイヤー1の本体に当たったか
    
    // 衝突判定のペアを作成
    const collisionPairs = [
        { seg1List: p1DrawingSegments, seg2List: p2DrawingSegments, type: 'drawing-drawing' },
        { seg1List: p1DrawingSegments, seg2List: p2BodySegments, type: 'p1drawing-p2body' },
        { seg1List: p1BodySegments, seg2List: p2DrawingSegments, type: 'p1body-p2drawing' }
    ];
    
    for (const pair of collisionPairs) {
        // どちらかが空の場合はスキップ
        if (pair.seg1List.length === 0 || pair.seg2List.length === 0) {
            continue;
        }
        
        for (const seg1 of pair.seg1List) {
            for (const seg2 of pair.seg2List) {
                // 線分1の両端点から線分2への距離
                const dist1 = pointToLineSegmentDistance(seg1.x1, seg1.y1, seg2.x1, seg2.y1, seg2.x2, seg2.y2);
                const dist2 = pointToLineSegmentDistance(seg1.x2, seg1.y2, seg2.x1, seg2.y1, seg2.x2, seg2.y2);
                
                // 線分2の両端点から線分1への距離
                const dist3 = pointToLineSegmentDistance(seg2.x1, seg2.y1, seg1.x1, seg1.y1, seg1.x2, seg1.y2);
                const dist4 = pointToLineSegmentDistance(seg2.x2, seg2.y2, seg1.x1, seg1.y1, seg1.x2, seg1.y2);
                
                const minDist = Math.min(dist1, dist2, dist3, dist4);
                
                // 線の太さを考慮した衝突判定（判定範囲を小さく）
                if (minDist < lineWidth * 1.2) {
                    collisionDetected = true;
                    
                    // ダメージ判定
                    if (pair.type === 'p1drawing-p2body' && player2.damageTimer === 0) {
                        p1DrawingHitsP2Body = true;
                    } else if (pair.type === 'p1body-p2drawing' && player1.damageTimer === 0) {
                        p2DrawingHitsP1Body = true;
                    }
                    
                    if (minDist < minDistance) {
                        minDistance = minDist;
                        collisionPoint = {
                            x: (seg1.x1 + seg1.x2) / 2,
                            y: (seg1.y1 + seg1.y2) / 2
                        };
                    }
                }
            }
        }
    }
    
    // ダメージ処理
    if (p1DrawingHitsP2Body) {
        player2.size = Math.max(0, player2.size - damageAmount);
        player2.damageTimer = damageCooldown;
    }
    if (p2DrawingHitsP1Body) {
        player1.size = Math.max(0, player1.size - damageAmount);
        player1.damageTimer = damageCooldown;
    }
    
    // 衝突している場合、プレイヤーを押し返す
    if (collisionDetected) {
        const dx = player2.x - player1.x;
        const dy = player2.y - player1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            // 重なり具合に基づいた押し返し
            const overlapFactor = Math.max(0, lineWidth * 1.2 - minDistance);
            const pushForce = 3 + overlapFactor * 0.5;
            
            const pushX = (dx / distance) * pushForce;
            const pushY = (dy / distance) * pushForce;
            
            // 両プレイヤーを互いに押し返す
            player1.x -= pushX;
            player1.y -= pushY;
            player2.x += pushX;
            player2.y += pushY;
        }
    }
}

// 衝突判定を複数回実行して確実に分離させる
function checkPlayerCollisionMultiple() {
    // 最大3回繰り返して、確実に分離させる
    for (let i = 0; i < 3; i++) {
        checkPlayerCollision();
    }
}

// 勝利判定
function checkWinner() {
    if (player1.size <= 0 && gameState === 'playing') {
        gameState = 'player2Win';
    } else if (player2.size <= 0 && gameState === 'playing') {
        gameState = 'player1Win';
    }
}

// 勝利メッセージを描画
function drawWinMessage() {
    if (gameState === 'player1Win') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('プレイヤー1の勝利！', canvas.width / 2, canvas.height / 2 - 20);
        
        ctx.fillStyle = '#fff';
        ctx.font = '24px Arial';
        ctx.fillText('スペースキーを押して再スタート', canvas.width / 2, canvas.height / 2 + 40);
    } else if (gameState === 'player2Win') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#FF5722';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('プレイヤー2の勝利！', canvas.width / 2, canvas.height / 2 - 20);
        
        ctx.fillStyle = '#fff';
        ctx.font = '24px Arial';
        ctx.fillText('スペースキーを押して再スタート', canvas.width / 2, canvas.height / 2 + 40);
    }
}

// フィールドを描画
function drawField() {
    ctx.fillStyle = field.color;
    ctx.fillRect(field.x, field.y, field.width, field.height);
    
    // フィールドの枠線
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(field.x, field.y, field.width, field.height);
}

// カスタム描画のバウンディングボックスを計算
function getDrawingBounds(drawing) {
    if (drawing.length === 0) {
        return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
    }
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const path of drawing) {
        for (const point of path) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
    }
    
    return {
        minX, maxX, minY, maxY,
        width: maxX - minX,
        height: maxY - minY
    };
}

// カスタム描画を描画
function drawCustomDrawing(drawing, scale = 1) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5 * scale; // 線を太くする
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    for (const path of drawing) {
        if (path.length < 2) continue;
        
        ctx.beginPath();
        ctx.moveTo(path[0].x * scale, path[0].y * scale);
        
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x * scale, path[i].y * scale);
        }
        
        ctx.stroke();
    }
}

// プレイヤーを描画（汎用関数）
function drawPlayer(playerObj) {
    ctx.save();
    
    // プレイヤーの位置と回転を適用
    ctx.translate(playerObj.x, playerObj.y);
    ctx.rotate(playerObj.angle);
    
    // サイズが0以下になったら描画しない
    if (playerObj.size <= 0) {
        ctx.restore();
        return;
    }
    
    // 四角形を描画（進行方向を向くように）
    ctx.fillStyle = playerObj.color;
    ctx.fillRect(-playerObj.size / 2, -playerObj.size / 2, playerObj.size, playerObj.size);
    
    // カスタム描画を前側に表示（描画の左端が四角の右端に完全に接するように）
    // 表示倍率を適用して大きく表示
    const scale = (playerObj.size / drawingCanvasSize) * drawingDisplayScale;
    const bounds = getDrawingBounds(playerObj.customDrawing);
    
    ctx.save();
    // 四角の前面（右端）から開始し、描画の左端（minX）をその位置に合わせる
    ctx.translate(playerObj.size / 2 - bounds.minX * scale, 0);
    drawCustomDrawing(playerObj.customDrawing, scale);
    ctx.restore();
    
    ctx.restore();
}

// 描画フェーズのUI表示
function drawDrawingPhaseUI() {
    const center = getDrawingCanvasCenter();
    
    const color = gameState === 'player1Drawing' ? '#4CAF50' : '#FF5722';
    const squareSize = 20;
    
    // 四角を左側中央に配置
    const squareX = center.x - drawingCanvasSize / 2 - squareSize;
    const squareY = center.y;
    
    // 四角を描画
    ctx.fillStyle = color;
    ctx.fillRect(
        squareX - squareSize / 2,
        squareY - squareSize / 2,
        squareSize,
        squareSize
    );
    
    // 進行方向を示す矢印（右向き・四角の右側）
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(squareX + squareSize / 2, squareY);
    ctx.lineTo(squareX + squareSize / 2 + 15, squareY);
    ctx.stroke();
    
    // 矢印の先端
    ctx.beginPath();
    ctx.moveTo(squareX + squareSize / 2 + 15, squareY);
    ctx.lineTo(squareX + squareSize / 2 + 10, squareY - 5);
    ctx.lineTo(squareX + squareSize / 2 + 10, squareY + 5);
    ctx.closePath();
    ctx.fill();
    
    // 描画キャンバスの枠を描画（四角の右側・進行方向側）
    const drawingX = center.x - drawingCanvasSize / 2;
    const drawingY = center.y - drawingCanvasSize / 2;
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(drawingX, drawingY, drawingCanvasSize, drawingCanvasSize);
    
    // 薄い背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(drawingX, drawingY, drawingCanvasSize, drawingCanvasSize);
    
    // 現在のプレイヤーに応じたメッセージ
    const playerName = gameState === 'player1Drawing' ? 'プレイヤー1（緑）' : 'プレイヤー2（オレンジ）';
    
    ctx.fillStyle = color;
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(playerName, canvas.width / 2, 80);
    
    ctx.fillStyle = '#fff';
    ctx.font = '18px Arial';
    ctx.fillText('左の四角が体です。右側（進行方向）に武器を描いてください', canvas.width / 2, 110);
    ctx.fillText('完成したらEnterキーを押してください', canvas.width / 2, canvas.height - 40);
    
    // 進行方向のラベル（描画エリア上部）
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('↓ 進行方向 ↓', center.x, drawingY - 10);
    
    // 現在描画中のパスを表示
    if (isDrawing && currentPath.length > 0) {
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        for (let i = 1; i < currentPath.length; i++) {
            ctx.lineTo(currentPath[i].x, currentPath[i].y);
        }
        ctx.stroke();
        ctx.restore();
    }
    
    // 既に描画されたパスを表示
    const currentDrawing = gameState === 'player1Drawing' ? player1Drawing : player2Drawing;
    if (currentDrawing.length > 0) {
        ctx.save();
        ctx.translate(center.x, center.y);
        drawCustomDrawing(currentDrawing);
        ctx.restore();
    }
}

// プレイヤー1を更新（矢印キー）
function updatePlayer1() {
    // ゲーム終了時は更新しない
    if (gameState !== 'playing') {
        return;
    }
    
    // 一度フィールド外に出たら操作できない
    if (player1.hasLeftField) {
        // フィールド外なら落下（サイズを小さくする）だけ継続
        player1.size = Math.max(0, player1.size - player1.fallSpeed);
        return;
    }
    
    // 左右矢印キーで旋回
    if (keys.ArrowLeft) {
        player1.angle -= player1.rotationSpeed;
    }
    if (keys.ArrowRight) {
        player1.angle += player1.rotationSpeed;
    }
    
    // 上下矢印キーで前後に移動
    if (keys.ArrowUp) {
        player1.x += Math.cos(player1.angle) * player1.speed;
        player1.y += Math.sin(player1.angle) * player1.speed;
    }
    if (keys.ArrowDown) {
        player1.x -= Math.cos(player1.angle) * player1.speed;
        player1.y -= Math.sin(player1.angle) * player1.speed;
    }
    
    // フィールド内にいるかチェック
    if (isInsideField(player1)) {
        // フィールド内なら元のサイズに戻す
        if (player1.size < player1.baseSize) {
            player1.size = Math.min(player1.baseSize, player1.size + player1.fallSpeed * 2);
        }
    } else {
        // フィールド外に出たことを記録
        player1.hasLeftField = true;
        // フィールド外なら落下（サイズを小さくする）
        player1.size = Math.max(0, player1.size - player1.fallSpeed);
    }
}

// プレイヤー2を更新（WASDキー）
function updatePlayer2() {
    // ゲーム終了時は更新しない
    if (gameState !== 'playing') {
        return;
    }
    
    // 一度フィールド外に出たら操作できない
    if (player2.hasLeftField) {
        // フィールド外なら落下（サイズを小さくする）だけ継続
        player2.size = Math.max(0, player2.size - player2.fallSpeed);
        return;
    }
    
    // A/Dキーで旋回
    if (keys.KeyA) {
        player2.angle -= player2.rotationSpeed;
    }
    if (keys.KeyD) {
        player2.angle += player2.rotationSpeed;
    }
    
    // W/Sキーで前後に移動
    if (keys.KeyW) {
        player2.x += Math.cos(player2.angle) * player2.speed;
        player2.y += Math.sin(player2.angle) * player2.speed;
    }
    if (keys.KeyS) {
        player2.x -= Math.cos(player2.angle) * player2.speed;
        player2.y -= Math.sin(player2.angle) * player2.speed;
    }
    
    // フィールド内にいるかチェック
    if (isInsideField(player2)) {
        // フィールド内なら元のサイズに戻す
        if (player2.size < player2.baseSize) {
            player2.size = Math.min(player2.baseSize, player2.size + player2.fallSpeed * 2);
        }
    } else {
        // フィールド外に出たことを記録
        player2.hasLeftField = true;
        // フィールド外なら落下（サイズを小さくする）
        player2.size = Math.max(0, player2.size - player2.fallSpeed);
    }
}

// ゲームループ
function gameLoop() {
    // キャンバスをクリア
    ctx.fillStyle = '#0f3460';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 描画フェーズの場合
    if (gameState === 'player1Drawing' || gameState === 'player2Drawing') {
        drawDrawingPhaseUI();
    } else {
        // ゲームプレイフェーズ
        // フィールドを描画
        drawField();
        
        // プレイヤーを更新
        updatePlayer1();
        updatePlayer2();
        
        // プレイヤー同士の衝突判定（複数回実行してすり抜け防止）
        checkPlayerCollisionMultiple();
        
        // 勝利判定
        checkWinner();
        
        // プレイヤーを描画
        drawPlayer(player1);
        drawPlayer(player2);
        
        // 勝利メッセージを描画
        drawWinMessage();
    }
    
    // 次のフレームをリクエスト
    requestAnimationFrame(gameLoop);
}

// ゲームを開始
gameLoop();

