/**
 * THE UNFAIR (Extended Mobile Version v3)
 * Optimized for Touch Controls & New Gimmicks
 */

// --- Constants & Config ---
// Internal resolution
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// Physics
const GRAVITY = 0.6;
const FRICTION = 0.82;
const ACCEL = 1.2;
const JUMP_FORCE = 13.5; // Slightly higher for mobile comfort
const WALL_JUMP_FORCE_X = 10;
const WALL_JUMP_FORCE_Y = 11;
const MAX_SPEED = 7;

// Storage Keys
const STORAGE_KEY_DEATHS = 'unfair_death_history_v3';
const STORAGE_KEY_COUNT = 'unfair_death_count_v3';

// Audio Context
let audioCtx = null;
let bgmInterval = null;

// Game State
const STATES = { TITLE: 0, STAGE_SELECT: 1, PLAYING: 2, GAMEOVER: 3, WIN: 4 };
let currentState = STATES.TITLE;
let currentStage = 1;

// Stage unlock storage
const STORAGE_KEY_STAGES = 'unfair_stages_v3';
let frameCount = 0;
let shakeIntensity = 0;
let glitchIntensity = 0;

// Camera
let cameraX = 0;

// Persistence variables
let spawnPoint = { x: 50, y: 400 };

// Mocking Texts
const MOCKERY = [
    "重力をご存知ない？",
    "指が滑りました？",
    "学習能力ゼロ",
    "それは罠でした（笑）",
    "スマホ投げないでね",
    "惜しい！（大嘘）",
    "予測通りです",
    "開発者の思うツボ",
    "見えないものを見ようとして",
    "後ろ！後ろ！"
];

let lastMockery = "";

// --- Audio System (Web Audio API) ---
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        startBGM();
    } else if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'jump') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'die') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        // Noise burst
        const bufferSize = audioCtx.sampleRate * 0.3;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.value = 0.2;
        noise.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        noise.start(now);

        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'buzzer') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.5);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'checkpoint') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.5);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554, now + 0.1);
        osc.frequency.setValueAtTime(659, now + 0.2);
        gain.gain.value = 0.2;
        osc.start(now);
        osc.stop(now + 0.6);
    } else if (type === 'explosion') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(50, now);
        osc.frequency.exponentialRampToValueAtTime(1, now + 0.5);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    }
}

function startBGM() {
    let noteIndex = 0;
    const notes = [110, 103, 97, 103];

    if (bgmInterval) clearInterval(bgmInterval);

    bgmInterval = setInterval(() => {
        if (!audioCtx || currentState !== STATES.PLAYING) return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        // Progress increases pitch/speed tension (Meta audio)
        const progressFactor = Math.max(0, (player.x / 3000));
        const pitchMod = 1 + (progressFactor * 0.5);

        osc.type = 'triangle';
        osc.frequency.value = notes[noteIndex] * pitchMod;

        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);

        noteIndex = (noteIndex + 1) % notes.length;
    }, 400);
}

// --- Persistence ---
let deathHistory = [];
let deathCount = 0;

function loadPersistence() {
    const d = localStorage.getItem(STORAGE_KEY_DEATHS);
    if (d) deathHistory = JSON.parse(d);
    const c = localStorage.getItem(STORAGE_KEY_COUNT);
    if (c) deathCount = parseInt(c);
}

function saveDeath(x, y) {
    deathCount++;
    deathHistory.push({ x: Math.round(x), y: Math.round(y) });
    if (deathHistory.length > 200) deathHistory.shift();

    localStorage.setItem(STORAGE_KEY_DEATHS, JSON.stringify(deathHistory));
    localStorage.setItem(STORAGE_KEY_COUNT, deathCount);
}

// --- Setup Canvas ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    // Keep aspect ratio but fit window
    let scale = Math.min(window.innerWidth / CANVAS_WIDTH, window.innerHeight / CANVAS_HEIGHT);
    canvas.style.width = (CANVAS_WIDTH * scale) + 'px';
    canvas.style.height = (CANVAS_HEIGHT * scale) + 'px';
}
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- Input Handling ---
const keys = {};
const touchInput = { left: false, right: false, jump: false, activeTouches: [] };
const mouse = { x: 0, y: 0, clicked: false };

// Touch Controls (Mobile)
canvas.addEventListener('touchstart', handleTouch, { passive: false });
canvas.addEventListener('touchmove', handleTouch, { passive: false });
canvas.addEventListener('touchend', handleTouch, { passive: false });

function handleTouch(e) {
    e.preventDefault();
    initAudio();
    checkTitleInteraction(e.changedTouches[0].clientX, e.changedTouches[0].clientY);

    // Reset touch inputs
    touchInput.left = false;
    touchInput.right = false;
    touchInput.jump = false;
    touchInput.activeTouches = [];

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        const tx = (t.clientX - rect.left) * scaleX;
        const ty = (t.clientY - rect.top) * scaleY;

        touchInput.activeTouches.push({ x: tx, y: ty });

        // Improved Virtual Controls: Split screen approach
        // Left 45% = Move (Left half = Left, Right half = Right)
        // Right 55% = Jump
        if (tx < CANVAS_WIDTH * 0.45) {
            // Movement Zone
            if (tx < CANVAS_WIDTH * 0.225) {
                touchInput.left = true;
            } else {
                touchInput.right = true;
            }
        } else {
            // Jump Zone (Right side)
            touchInput.jump = true;
        }
    }
}

// Mouse/Desktop Controls
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }
    if ((currentState === STATES.GAMEOVER || currentState === STATES.WIN) && e.code === 'Space') resetGame();
});

window.addEventListener('keyup', (e) => keys[e.code] = false);

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    mouse.x = (e.clientX - rect.left) * scaleX;
    mouse.y = (e.clientY - rect.top) * scaleY;
});

canvas.addEventListener('mousedown', () => {
    mouse.clicked = true;
    initAudio();
    checkTitleInteraction(mouse.x * (canvas.offsetWidth / CANVAS_WIDTH), mouse.y * (canvas.offsetHeight / CANVAS_HEIGHT));
});
canvas.addEventListener('mouseup', () => mouse.clicked = false);


// --- Game Entities ---

class Player {
    constructor() {
        this.reset();
    }

    reset() {
        this.w = 20;
        this.h = 20;
        this.x = spawnPoint.x;
        this.y = spawnPoint.y;
        this.vx = 0;
        this.vy = 0;
        this.grounded = false;
        this.wallSliding = false;
        this.wallDir = 0;
        this.dead = false;
        this.color = '#00ffcc';
    }

    update() {
        if (this.dead) return;

        // Input Mixing (Keyboard + Touch)
        const left = keys['ArrowLeft'] || touchInput.left;
        const right = keys['ArrowRight'] || touchInput.right;
        const jump = keys['Space'] || keys['KeyZ'] || keys['ArrowUp'] || touchInput.jump;

        // Movement
        if (left) {
            if (this.vx > -MAX_SPEED) this.vx -= ACCEL;
        } else if (right) {
            if (this.vx < MAX_SPEED) this.vx += ACCEL;
        } else {
            this.vx *= FRICTION;
        }

        // Jump
        if (jump && !this.jumpLocked) {
            if (this.grounded) {
                this.vy = -JUMP_FORCE;
                this.grounded = false;
                this.jumpLocked = true;
                playSound('jump');
            } else if (this.wallSliding) {
                this.vy = -WALL_JUMP_FORCE_Y;
                this.vx = -this.wallDir * WALL_JUMP_FORCE_X;
                this.wallSliding = false;
                this.jumpLocked = true;
                playSound('jump');
            }
        }

        if (!jump) {
            this.jumpLocked = false;
        }

        // Physics
        this.vy += GRAVITY;
        this.x += this.vx;
        this.y += this.vy;

        this.checkCollisions();

        // Bounds
        if (this.y > CANVAS_HEIGHT + 200) this.die("落下");
    }

    checkCollisions() {
        this.grounded = false;
        this.wallSliding = false;

        let onPlatform = false;

        for (let block of entities) {
            if (['block', 'ui_block', 'moving_block', 'invisible_block'].includes(block.type)) {
                if (block.fake) continue;
                // Invisible block logic: solid only if near or falling onto it? No, always solid but invisible.

                const colDir = this.getCollisionDir(block);

                if (colDir === 'b') {
                    this.y = block.y - this.h;
                    this.vy = 0;
                    this.grounded = true;
                    if (block.type === 'moving_block') {
                        this.x += block.vx;
                        onPlatform = true;
                    }
                    if (block.type === 'invisible_block') {
                        block.revealed = true;
                    }
                } else if (colDir === 't') {
                    this.y = block.y + block.h;
                    this.vy = 0;
                    if (block.falling || block.type === 'moving_block') this.die("圧死");
                } else if (colDir === 'l') {
                    this.x = block.x - this.w;
                    this.vx = 0;
                    this.wallSliding = true;
                    this.wallDir = 1;
                    if (block.type === 'invisible_block') block.revealed = true;
                } else if (colDir === 'r') {
                    this.x = block.x + block.w;
                    this.vx = 0;
                    this.wallSliding = true;
                    this.wallDir = -1;
                    if (block.type === 'invisible_block') block.revealed = true;
                }
            } else if (block.type === 'trap') {
                if (this.AABB(block)) this.die("串刺し");
            } else if (block.type === 'enemy') {
                if (this.AABB(block)) this.die("捕食");
            } else if (block.type === 'trigger') {
                if (this.AABB(block)) block.activate();
            } else if (block.type === 'goal') {
                if (this.AABB(block)) block.trigger(this);
            } else if (block.type === 'fake_save') {
                if (this.AABB(block)) block.trigger(this);
            } else if (block.type === 'checkpoint') {
                if (this.AABB(block)) block.trigger(this);
            } else if (block.type === 'launchpad') {
                // 吹っ飛ばし床
                const colDir = this.getCollisionDir(block);
                if (colDir === 'b') {
                    this.y = block.y - this.h;
                    block.trigger(this);
                }
            } else if (block.type === 'fake_spike') {
                if (this.AABB(block)) block.trigger(this);
            } else if (block.type === 'accel_zone') {
                if (this.AABB(block)) block.applyForce(this);
            } else if (block.type === 'trust_block') {
                if (block.destroyed) continue;
                const colDir = this.getCollisionDir(block);
                if (colDir === 'b') {
                    this.y = block.y - this.h;
                    this.vy = 0;
                    this.grounded = true;
                    block.trigger();
                } else if (colDir === 't') {
                    this.y = block.y + block.h;
                    this.vy = 0;
                } else if (colDir === 'l') {
                    this.x = block.x - this.w;
                    this.vx = 0;
                } else if (colDir === 'r') {
                    this.x = block.x + block.w;
                    this.vx = 0;
                }
            }
        }
    }

    getCollisionDir(block) {
        const dx = (this.x + this.w / 2) - (block.x + block.w / 2);
        const dy = (this.y + this.h / 2) - (block.y + block.h / 2);
        const w = (this.w + block.w) / 2;
        const h = (this.h + block.h) / 2;
        const crossWidth = w * dy;
        const crossHeight = h * dx;

        if (Math.abs(dx) <= w && Math.abs(dy) <= h) {
            const overlapX = w - Math.abs(dx);
            const overlapY = h - Math.abs(dy);
            if (overlapX < overlapY) {
                return dx > 0 ? 'r' : 'l';
            } else {
                return dy > 0 ? 't' : 'b';
            }
        }
        return null;
    }

    AABB(other) {
        return this.x < other.x + other.w &&
            this.x + this.w > other.x &&
            this.y < other.y + other.h &&
            this.y + this.h > other.y;
    }

    die(reason) {
        if (this.dead) return;
        this.dead = true;
        saveDeath(this.x, this.y);
        shakeIntensity = 20;
        glitchIntensity = 10;
        playSound('die');

        lastMockery = MOCKERY[Math.floor(Math.random() * MOCKERY.length)] + `\n(死因: ${reason})`;

        for (let i = 0; i < 20; i++) {
            particles.push(new Particle(this.x + this.w / 2, this.y + this.h / 2, '#ff0000'));
        }

        currentState = STATES.GAMEOVER;
    }
}

class Block {
    constructor(x, y, w, h, fake = false) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.type = 'block';
        this.fake = fake;
        this.color = '#aaa';
        if (fake) this.color = '#a0a0a0';
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.strokeStyle = '#555';
        ctx.strokeRect(this.x, this.y, this.w, this.h);
    }
}

class InvisibleBlock extends Block {
    constructor(x, y, w, h) {
        super(x, y, w, h);
        this.type = 'invisible_block';
        this.revealed = false;
    }
    draw() {
        if (this.revealed) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(this.x, this.y, this.w, this.h);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(this.x, this.y, this.w, this.h);
        } else {
            // Hint for mobile users: faint shimmer occasionally?
            if (Math.random() > 0.99) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.fillRect(this.x, this.y, this.w, this.h);
            }
        }
    }
}

class MovingBlock extends Block {
    constructor(x, y, w, h, range, speed) {
        super(x, y, w, h);
        this.type = 'moving_block';
        this.startX = x;
        this.range = range;
        this.speed = speed;
        this.vx = speed;
        this.color = '#88ccaa';
    }
    update() {
        this.x += this.vx;
        if (this.x > this.startX + this.range || this.x < this.startX) {
            this.vx *= -1;
        }
    }
}

class Enemy {
    constructor(x, y, w, h, range, speed) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.startX = x;
        this.range = range;
        this.speed = speed;
        this.vx = speed;
        this.type = 'enemy';
    }
    update() {
        this.x += this.vx;
        // Simple patrol
        if (this.x > this.startX + this.range || this.x < this.startX) {
            this.vx *= -1;
        }
        // Face player if triggered? nah simple patrol
    }
    draw() {
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        // Eyes
        ctx.fillStyle = 'white';
        if (this.vx > 0) {
            ctx.fillRect(this.x + 15, this.y + 5, 5, 5);
        } else {
            ctx.fillRect(this.x + 5, this.y + 5, 5, 5);
        }
    }
}

class Trap {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.type = 'trap';
    }
    draw() {
        ctx.fillStyle = '#ff3333';
        ctx.beginPath();
        for (let i = 0; i < this.w; i += 10) {
            ctx.moveTo(this.x + i, this.y + this.h);
            ctx.lineTo(this.x + i + 5, this.y);
            ctx.lineTo(this.x + i + 10, this.y + this.h);
        }
        ctx.fill();
    }
}

class FallingBlock extends Block {
    constructor(x, y, w, h, text) {
        super(x, y, w, h);
        this.type = 'ui_block';
        this.text = text;
        this.falling = false;
        this.vy = 0;
        this.landed = false;
    }

    update() {
        if (this.falling) {
            this.vy += GRAVITY * 1.5;
            this.y += this.vy;
            if (this.y > CANVAS_HEIGHT - 50 && !this.landed) {
                if (this.y > 600) this.landed = true;
            }
        }
    }

    draw() {
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.fillText(this.text, this.x + 10, this.y + 20);
        if (this.text.includes("LIFE")) {
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x + 60, this.y + 5, this.w - 70, this.h - 10);
        }
    }
}

class TriggerZone {
    constructor(x, y, w, h, targetId) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.type = 'trigger';
        this.targetId = targetId;
        this.active = true;
    }
    draw() { }
    activate() {
        if (!this.active) return;
        this.active = false;
        const target = entities.find(e => e.id === this.targetId);
        if (target) {
            target.falling = true;
            playSound('buzzer');
        }
    }
}

class FakeSave {
    constructor(x, y) {
        this.x = x; this.y = y; this.w = 40; this.h = 40;
        this.type = 'fake_save';
        this.triggered = false;
    }
    draw() {
        if (!this.triggered) {
            ctx.fillStyle = '#44ff44';
            ctx.fillRect(this.x, this.y, this.w, this.h);
            ctx.fillStyle = '#000';
            ctx.font = '10px monospace';
            ctx.fillText("SAVE", this.x + 8, this.y + 24);
        }
    }
    trigger(p) {
        if (!this.triggered) {
            this.triggered = true;
            playSound('explosion');
            shakeIntensity = 25;
            p.die("セーブポイント爆発");
        }
    }
}

class Checkpoint {
    constructor(x, y) {
        this.x = x; this.y = y; this.w = 40; this.h = 40;
        this.type = 'checkpoint';
        this.active = false;
    }
    draw() {
        ctx.fillStyle = this.active ? '#00ccff' : '#444';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.fillText("CHK", this.x + 10, this.y + 24);
    }
    trigger(p) {
        if (!this.active) {
            this.active = true;
            spawnPoint = { x: this.x, y: this.y };
            playSound('checkpoint');
            // Heal message?
            for (let i = 0; i < 10; i++) particles.push(new Particle(this.x + 20, this.y, '#00ccff'));
        }
    }
}

class Goal {
    constructor(x, y, isFake) {
        this.x = x; this.y = y; this.w = 30; this.h = 40;
        this.type = 'goal';
        this.isFake = isFake;
        this.revealed = false;
    }
    draw() {
        if (this.revealed && this.isFake) {
            ctx.fillStyle = 'purple';
            ctx.fillRect(this.x, this.y, this.w, this.h);
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(this.x + 10, this.y + 10, 5, 0, Math.PI * 2);
            ctx.arc(this.x + 20, this.y + 10, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x + 5, this.y + 25, 20, 5);
        } else {
            ctx.fillStyle = '#fff';
            ctx.fillRect(this.x, this.y, 2, 40);
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.moveTo(this.x + 2, this.y);
            ctx.lineTo(this.x + 25, this.y + 10);
            ctx.lineTo(this.x + 2, this.y + 20);
            ctx.fill();
        }
    }
    trigger(p) {
        if (this.isFake) {
            if (!this.revealed) {
                this.revealed = true;
                playSound('buzzer');
                p.die("孔明の罠");
            }
        } else {
            currentState = STATES.WIN;
            playSound('win');
        }
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.color = color;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.05;
    }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 3, 3);
        ctx.globalAlpha = 1.0;
    }
}

// --- Stage 2 New Entities ---

// 吹っ飛ばし床
class LaunchPad {
    constructor(x, y, w, h, forceX, forceY, looksSafe = true) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.forceX = forceX;
        this.forceY = forceY;
        this.looksSafe = looksSafe; // true = 安全に見える, false = 危険に見える
        this.type = 'launchpad';
        this.activated = false;
        this.cooldown = 0;
    }
    update() {
        if (this.cooldown > 0) this.cooldown--;
    }
    draw() {
        if (this.looksSafe) {
            // 普通のブロックに見せかける
            ctx.fillStyle = '#aaa';
            ctx.fillRect(this.x, this.y, this.w, this.h);
            ctx.strokeStyle = '#555';
            ctx.strokeRect(this.x, this.y, this.w, this.h);
        } else {
            // 危険そうに見えるが実は安全なルートへ飛ばす
            ctx.fillStyle = '#ff6600';
            ctx.fillRect(this.x, this.y, this.w, this.h);
            ctx.fillStyle = '#ffcc00';
            ctx.font = '12px monospace';
            ctx.fillText('⚡', this.x + this.w / 2 - 6, this.y + this.h / 2 + 4);
        }
    }
    trigger(p) {
        if (this.cooldown > 0) return;
        p.vx = this.forceX;
        p.vy = this.forceY;
        this.cooldown = 30;
        playSound('jump');
        for (let i = 0; i < 10; i++) {
            particles.push(new Particle(p.x + p.w / 2, p.y + p.h, '#ffcc00'));
        }
    }
}

// 偽の棘（見た目は危険、実は安全）
class FakeSpike {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.type = 'fake_spike';
        this.revealed = false;
    }
    draw() {
        if (this.revealed) {
            // 通過したら「？」マークで嘲笑
            ctx.fillStyle = 'rgba(100, 255, 100, 0.3)';
            ctx.fillRect(this.x, this.y, this.w, this.h);
            ctx.fillStyle = '#0f0';
            ctx.font = '16px monospace';
            ctx.fillText('?', this.x + this.w / 2 - 4, this.y + this.h / 2 + 5);
        } else {
            // 本物の棘に見せる
            ctx.fillStyle = '#ff3333';
            ctx.beginPath();
            for (let i = 0; i < this.w; i += 10) {
                ctx.moveTo(this.x + i, this.y + this.h);
                ctx.lineTo(this.x + i + 5, this.y);
                ctx.lineTo(this.x + i + 10, this.y + this.h);
            }
            ctx.fill();
        }
    }
    trigger(p) {
        this.revealed = true;
        // 安全！何も起こらない
    }
}

// 強制加速エリア
class AccelZone {
    constructor(x, y, w, h, accelX, visible = false) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.accelX = accelX;
        this.type = 'accel_zone';
        this.visible = visible;
    }
    draw() {
        if (this.visible) {
            ctx.fillStyle = 'rgba(0, 200, 255, 0.2)';
            ctx.fillRect(this.x, this.y, this.w, this.h);
            // 矢印表示
            ctx.fillStyle = 'rgba(0, 200, 255, 0.5)';
            const dir = this.accelX > 0 ? '→' : '←';
            ctx.font = '20px monospace';
            for (let i = 0; i < this.w; i += 40) {
                ctx.fillText(dir, this.x + i + 10, this.y + this.h / 2 + 7);
            }
        }
    }
    applyForce(p) {
        p.vx += this.accelX * 0.1;
    }
}

// 嘘つき看板
class SignPost {
    constructor(x, y, text, isLie = true) {
        this.x = x; this.y = y; this.w = 80; this.h = 60;
        this.text = text;
        this.isLie = isLie;
        this.type = 'signpost';
    }
    draw() {
        // 看板の柱
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(this.x + 35, this.y + 40, 10, 30);
        // 看板本体
        ctx.fillStyle = '#DEB887';
        ctx.fillRect(this.x, this.y, this.w, 40);
        ctx.strokeStyle = '#8B4513';
        ctx.strokeRect(this.x, this.y, this.w, 40);
        // テキスト
        ctx.fillStyle = this.isLie ? '#333' : '#060';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x + this.w / 2, this.y + 25);
        ctx.textAlign = 'left';
    }
}

// 信頼裏切りブロック（N回目で消える）
class TrustBlock extends Block {
    constructor(x, y, w, h, triggerCount) {
        super(x, y, w, h);
        this.type = 'trust_block';
        this.triggerCount = triggerCount; // この回数目で消える
        this.currentCount = 0;
        this.destroyed = false;
    }
    draw() {
        if (this.destroyed) return;
        ctx.fillStyle = '#88aa88';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.strokeStyle = '#446644';
        ctx.strokeRect(this.x, this.y, this.w, this.h);
    }
    trigger() {
        this.currentCount++;
        if (this.currentCount >= this.triggerCount) {
            this.destroyed = true;
            this.fake = true; // 当たり判定を無効化
            playSound('buzzer');
            for (let i = 0; i < 15; i++) {
                particles.push(new Particle(this.x + this.w / 2, this.y + this.h / 2, '#88aa88'));
            }
        }
    }
}

// --- Stage Unlock System ---
let stageUnlocks = { 1: true, 2: true }; // デフォルトで両方遊べる

function loadStageUnlocks() {
    const data = localStorage.getItem(STORAGE_KEY_STAGES);
    if (data) stageUnlocks = JSON.parse(data);
}

function saveStageUnlock(stage) {
    stageUnlocks[stage] = true;
    localStorage.setItem(STORAGE_KEY_STAGES, JSON.stringify(stageUnlocks));
}

// --- Globals ---
let player;
let entities = [];
let particles = [];
let titleTrapped = false;

// --- Level Generation ---
function initLevel() {
    // If resetting from gameover, keep spawn point if valid
    if (currentState === STATES.TITLE || currentState === STATES.STAGE_SELECT) {
        spawnPoint = { x: 50, y: 400 };
    }

    player = new Player();
    entities = [];
    particles = [];
    cameraX = 0;

    if (currentStage === 1) {
        initStage1();
    } else if (currentStage === 2) {
        initStage2();
    }
}

// --- STAGE 1: The Original ---
function initStage1() {
    // --- PART 1: The Basics ---
    entities.push(new Block(0, 500, 200, 100));
    // Pit hint
    entities.push(new Block(200, 500, 150, 100, true));
    entities.push(new Block(350, 500, 450, 100));
    entities.push(new Block(0, 0, 20, 600));

    entities.push(new Block(200, 350, 100, 20));
    entities.push(new Block(400, 250, 100, 20));

    // Trap 1: Falling Sign
    let tutorialSign = new FallingBlock(360, -100, 120, 40, "Tutorial");
    tutorialSign.id = 'tutSign';
    entities.push(tutorialSign);
    entities.push(new TriggerZone(360, 450, 50, 50, 'tutSign'));

    // Trap 2: Killer UI
    let killerUI = new FallingBlock(550, 20, 200, 30, "LIFE: 100%");
    killerUI.id = 'killUI';
    entities.push(killerUI);
    entities.push(new TriggerZone(580, 100, 140, 200, 'killUI'));

    // --- PART 2: Extension with Enemies ---
    entities.push(new Block(800, 400, 100, 20));

    // New Gimmick: Invisible Bridge
    // 950 - 1200 is empty, but has invisible blocks
    entities.push(new InvisibleBlock(950, 400, 50, 20));
    entities.push(new InvisibleBlock(1050, 350, 50, 20));
    entities.push(new InvisibleBlock(1150, 300, 50, 20));

    entities.push(new Block(1300, 400, 300, 200));

    // Enemy Patrol
    entities.push(new Enemy(1350, 370, 30, 30, 200, 2));

    // Fake Save Point
    entities.push(new FakeSave(1400, 360));

    // REAL Checkpoint (Looks suspicious, black/grey)
    // Placed after the fake one
    entities.push(new Checkpoint(1550, 360));

    // --- PART 3: The Hard Part ---
    entities.push(new Block(1700, 300, 50, 20));

    // Moving platforms over spikes
    entities.push(new Trap(1700, 580, 1000, 20));
    entities.push(new MovingBlock(1800, 300, 80, 20, 150, 3));
    entities.push(new MovingBlock(2050, 250, 80, 20, 150, -3));

    // Ceiling Trap
    entities.push(new Block(2300, 200, 400, 20)); // Floor
    let crusher = new FallingBlock(2450, -50, 100, 150, "PRESS");
    crusher.id = 'crush';
    entities.push(crusher);
    entities.push(new TriggerZone(2400, 150, 50, 50, 'crush'));

    // Fake Goal
    entities.push(new Block(2800, 400, 200, 50));
    entities.push(new Goal(2900, 360, true));

    // Invisible stairs to real goal
    entities.push(new InvisibleBlock(3000, 300, 50, 20));
    entities.push(new InvisibleBlock(3100, 200, 50, 20));

    // Real Goal
    entities.push(new Block(3200, 150, 100, 20));
    entities.push(new Goal(3250, 110, false));

    // Global Pit Spikes
    entities.push(new Trap(200, 580, 150, 20));
}

// --- STAGE 2: 裏切りと信頼 ---
function initStage2() {
    // 左端の壁
    entities.push(new Block(0, 0, 20, 600));

    // === PART 1: 嘘つきゾーン ===
    // スタート地点
    entities.push(new Block(0, 500, 250, 100));

    // 嘘つき看板その1: 「→安全」と書いてあるが右は罠
    entities.push(new SignPost(150, 440, "→安全", true));

    // 右に行くと落とし穴（看板の嘘）
    entities.push(new Block(250, 500, 50, 100, true)); // 偽の床
    entities.push(new Trap(250, 580, 100, 20));

    // 本当の正解は上に登る
    entities.push(new Block(100, 380, 80, 20));
    entities.push(new Block(200, 300, 80, 20));

    // 偽の棘エリア（見た目は危険だが実は安全）
    entities.push(new FakeSpike(350, 560, 100, 20));
    entities.push(new Block(350, 500, 150, 60)); // 偽棘の下の足場

    // === PART 2: 吹っ飛ばしゾーン ===
    entities.push(new Block(500, 400, 100, 20));

    // 安全そうに見える床が実は吹っ飛ばし床（落とし穴へ）
    entities.push(new LaunchPad(650, 400, 80, 20, 15, -5, true)); // 見た目普通、右に吹っ飛ぶ→穴へ
    entities.push(new Trap(800, 580, 150, 20)); // 吹っ飛び先の穴

    // 危険そうに見える床が実は正解ルートへ
    entities.push(new LaunchPad(700, 300, 80, 20, -8, -15, false)); // 見た目危険、左上に吹っ飛ぶ→安全
    entities.push(new Block(550, 150, 100, 20)); // 正解の着地点

    // === PART 3: 信頼裏切りゾーン ===
    // 3回乗っても大丈夫、4回目で消えるブロック
    entities.push(new TrustBlock(700, 150, 80, 20, 4));
    entities.push(new Block(850, 150, 100, 20));

    // チェックポイント（本物）
    entities.push(new Checkpoint(880, 110));

    // === PART 4: 加速トラップゾーン ===
    entities.push(new Block(1000, 300, 300, 20));

    // 見えない加速エリア→強制的に穴に落とされる
    entities.push(new AccelZone(1050, 200, 150, 100, 3, false)); // 見えない右加速
    entities.push(new Trap(1350, 580, 100, 20));

    // 看板で警告...だが嘘
    entities.push(new SignPost(1000, 240, "←危険", true)); // 左が危険と言うが、左が正解

    // 正解は左側を通る
    entities.push(new Block(950, 200, 50, 20));
    entities.push(new Block(900, 100, 80, 20));

    // === PART 5: 最終エリア ===
    entities.push(new Block(1000, 50, 200, 20));

    // 偽のチェックポイント（今回はステージ1で学んだはず...）
    // でも今回は偽が偽に見えて本物に見えるやつ
    entities.push(new FakeSave(1050, 10)); // ステージ1で学んだので避けるはず

    // 避けた先に本当の罠
    entities.push(new Block(1200, 100, 200, 20));
    // プレイヤーが偽セーブを避けて右に行くと...
    entities.push(new Trap(1200, 80, 50, 20)); // 棘

    // 実は偽セーブの上を通らないといけない
    entities.push(new InvisibleBlock(1100, -20, 80, 20)); // 偽セーブの真上に透明足場

    // ゴールへの道
    entities.push(new Block(1250, -50, 100, 20));
    entities.push(new MovingBlock(1400, 50, 80, 20, 100, 2));

    // 偽ゴール（これはさすがに見破れるはず）
    entities.push(new Block(1550, 100, 80, 20));
    entities.push(new Goal(1570, 60, true));

    // 本物のゴールは下にある
    entities.push(new Block(1600, 300, 100, 20));
    entities.push(new Goal(1630, 260, false));

    // ゴールへの足場
    entities.push(new InvisibleBlock(1500, 200, 60, 20));
    entities.push(new Block(1550, 350, 50, 20));

    // 奈落の棘
    entities.push(new Trap(0, 580, 1800, 20));
}

// --- Title Screen Logic ---
let realStartBtn = { x: 780, y: 580, w: 20, h: 20 };
let fakeStartBtn = { x: 300, y: 350, w: 200, h: 60 };

// Stage Select Buttons
let stageBtn1 = { x: 200, y: 280, w: 180, h: 80 };
let stageBtn2 = { x: 420, y: 280, w: 180, h: 80 };

function checkTitleInteraction(clickX, clickY) {
    let cx = mouse.x;
    let cy = mouse.y;
    if (clickX) {
        cx = clickX * (CANVAS_WIDTH / canvas.clientWidth);
        cy = clickY * (CANVAS_HEIGHT / canvas.clientHeight);
    }

    // タイトル画面
    if (currentState === STATES.TITLE) {
        if (mouse.clicked || (clickX && clickY)) {
            if (cx > fakeStartBtn.x && cx < fakeStartBtn.x + fakeStartBtn.w &&
                cy > fakeStartBtn.y && cy < fakeStartBtn.y + fakeStartBtn.h) {

                if (!titleTrapped) {
                    playSound('explosion');
                    shakeIntensity = 30;
                    titleTrapped = true;
                    for (let i = 0; i < 50; i++) particles.push(new Particle(cx, cy, '#fff'));
                }
                return;
            }

            if (cx > realStartBtn.x && cy > realStartBtn.y) {
                currentState = STATES.STAGE_SELECT;
            }
        }
    }

    // ステージ選択画面
    if (currentState === STATES.STAGE_SELECT) {
        if (mouse.clicked || (clickX && clickY)) {
            // Stage 1
            if (cx > stageBtn1.x && cx < stageBtn1.x + stageBtn1.w &&
                cy > stageBtn1.y && cy < stageBtn1.y + stageBtn1.h) {
                currentStage = 1;
                currentState = STATES.PLAYING;
                initLevel();
                startBGM();
            }
            // Stage 2
            if (cx > stageBtn2.x && cx < stageBtn2.x + stageBtn2.w &&
                cy > stageBtn2.y && cy < stageBtn2.y + stageBtn2.h) {
                currentStage = 2;
                currentState = STATES.PLAYING;
                initLevel();
                startBGM();
            }
        }
    }
}

function resetGame() {
    if (currentState === STATES.GAMEOVER) {
        currentState = STATES.PLAYING;
        // Re-init but keep checkpoint data
        const savedSpawn = { ...spawnPoint };
        initLevel();
        spawnPoint = savedSpawn;
        player.x = spawnPoint.x;
        player.y = spawnPoint.y;
    } else if (currentState === STATES.WIN) {
        // ステージクリア！
        if (currentStage === 1) {
            saveStageUnlock(2);
        }
        currentState = STATES.STAGE_SELECT;
        spawnPoint = { x: 50, y: 400 }; // スポーンリセット
    }
}

// --- Main Loop ---

function update() {
    frameCount++;

    if (shakeIntensity > 0) shakeIntensity *= 0.9;
    if (shakeIntensity < 0.5) shakeIntensity = 0;

    if (currentState === STATES.PLAYING) {
        player.update();
        entities.forEach(e => { if (e.update) e.update(); });

        // Camera Follow - Look Ahead (Shift player to left third)
        let targetX = player.x - CANVAS_WIDTH * 0.25;
        if (targetX < 0) targetX = 0;
        cameraX += (targetX - cameraX) * 0.1;
    }

    if ((currentState === STATES.GAMEOVER || currentState === STATES.WIN) && (touchInput.left || touchInput.right || touchInput.jump)) {
        resetGame();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
    if (glitchIntensity > 0) glitchIntensity *= 0.9;
}

function draw() {
    ctx.save();

    let dx = (Math.random() - 0.5) * shakeIntensity;
    let dy = (Math.random() - 0.5) * shakeIntensity;
    ctx.translate(dx, dy);

    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (currentState === STATES.TITLE) {
        ctx.fillStyle = '#fff';
        ctx.font = '40px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText("THE UNFAIR", CANVAS_WIDTH / 2, 200);
        ctx.font = '20px Courier New';
        ctx.fillText("Mobile V3 + Checkpoints", CANVAS_WIDTH / 2, 230);
        ctx.fillText(`Deaths: ${deathCount}`, CANVAS_WIDTH / 2, 270);

        if (!titleTrapped) {
            ctx.fillStyle = '#444';
            ctx.fillRect(fakeStartBtn.x, fakeStartBtn.y, fakeStartBtn.w, fakeStartBtn.h);
            ctx.fillStyle = '#fff';
            ctx.fillText("TAP TO START", CANVAS_WIDTH / 2, 385);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillText("罠に決まってるでしょ。", CANVAS_WIDTH / 2, 385);
        }

        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(realStartBtn.x, realStartBtn.y, realStartBtn.w, realStartBtn.h);
        ctx.fillStyle = '#555';
        ctx.font = '10px sans-serif';
        ctx.fillText("start", realStartBtn.x, realStartBtn.y - 5);

    } else if (currentState === STATES.STAGE_SELECT) {
        ctx.fillStyle = '#fff';
        ctx.font = '30px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText("SELECT STAGE", CANVAS_WIDTH / 2, 150);
        ctx.fillText(`Total Deaths: ${deathCount}`, CANVAS_WIDTH / 2, 500);

        // Stage 1 Button
        ctx.fillStyle = stageUnlocks[1] ? '#444' : '#222';
        ctx.fillRect(stageBtn1.x, stageBtn1.y, stageBtn1.w, stageBtn1.h);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(stageBtn1.x, stageBtn1.y, stageBtn1.w, stageBtn1.h);
        ctx.fillStyle = '#fff';
        ctx.font = '24px Courier New';
        ctx.fillText("STAGE 1", stageBtn1.x + stageBtn1.w / 2, stageBtn1.y + 45);
        ctx.font = '14px Courier New';
        ctx.fillText("The Beginning", stageBtn1.x + stageBtn1.w / 2, stageBtn1.y + 70);

        // Stage 2 Button
        ctx.fillStyle = stageUnlocks[2] ? '#444' : '#222';
        ctx.fillRect(stageBtn2.x, stageBtn2.y, stageBtn2.w, stageBtn2.h);
        ctx.strokeStyle = stageUnlocks[2] ? '#fff' : '#555';
        ctx.strokeRect(stageBtn2.x, stageBtn2.y, stageBtn2.w, stageBtn2.h);
        ctx.fillStyle = stageUnlocks[2] ? '#fff' : '#555';
        ctx.font = '24px Courier New';
        ctx.fillText("STAGE 2", stageBtn2.x + stageBtn2.w / 2, stageBtn2.y + 45);
        ctx.font = '14px Courier New';
        ctx.fillText("Betrayal", stageBtn2.x + stageBtn2.w / 2, stageBtn2.y + 70);

    } else {
        ctx.save();
        ctx.translate(-Math.floor(cameraX), 0);

        // 背景を描画しないと前のフレームが残る可能性があるため、クリア済みだが一応
        // (既に行頭で黒塗りされているのでOK)

        ctx.fillStyle = '#880000';
        deathHistory.forEach(pos => {
            ctx.font = '20px sans-serif';
            ctx.fillText('✕', pos.x, pos.y);
        });

        entities.forEach(e => e.draw());

        if (!player.dead) {
            ctx.fillStyle = player.color;
            ctx.fillRect(player.x, player.y, player.w, player.h);
            ctx.fillStyle = 'black';
            ctx.fillRect(player.x + 4, player.y + 4, 4, 4);
            ctx.fillRect(player.x + 12, player.y + 4, 4, 4);
        }

        particles.forEach(p => p.draw());

        ctx.restore();

        // UI Layer
        if (currentState === STATES.GAMEOVER) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.fillStyle = 'white';
            ctx.font = '30px Courier New';
            ctx.textAlign = 'center';
            const lines = lastMockery.split('\n');
            lines.forEach((line, i) => {
                ctx.fillText(line, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + i * 40);
            });
            ctx.font = '20px Courier New';
            ctx.fillText("Tap / Space to Retry", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100);
        }

        if (currentState === STATES.WIN) {
            ctx.fillStyle = 'yellow';
            ctx.font = '40px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText("YOU ESCAPED!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        }

        // --- Mobile Controls Visualizer (Updated) ---
        // Left Zone
        ctx.fillStyle = touchInput.left ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(0, CANVAS_HEIGHT - 120, CANVAS_WIDTH * 0.225, 120);
        ctx.fillStyle = touchInput.right ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(CANVAS_WIDTH * 0.225, CANVAS_HEIGHT - 120, CANVAS_WIDTH * 0.225, 120);

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '30px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("←", CANVAS_WIDTH * 0.1125, CANVAS_HEIGHT - 50);
        ctx.fillText("→", CANVAS_WIDTH * 0.3375, CANVAS_HEIGHT - 50);

        // Center separator (Neutral zone hint)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.moveTo(CANVAS_WIDTH * 0.225, CANVAS_HEIGHT - 120);
        ctx.lineTo(CANVAS_WIDTH * 0.225, CANVAS_HEIGHT);
        ctx.stroke();

        // Right Zone (Jump)
        ctx.fillStyle = touchInput.jump ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(CANVAS_WIDTH * 0.45, CANVAS_HEIGHT - 120, CANVAS_WIDTH * 0.55, 120);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText("JUMP", CANVAS_WIDTH * 0.725, CANVAS_HEIGHT - 50);

        // Touch Indicators
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        touchInput.activeTouches.forEach(t => {
            ctx.beginPath();
            ctx.arc(t.x, t.y, 20, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    ctx.restore();

    if (glitchIntensity > 1 || currentState === STATES.GAMEOVER && Math.random() > 0.9) {
        const sliceHeight = Math.random() * 50;
        const sliceY = Math.random() * CANVAS_HEIGHT;
        const sliceOffset = (Math.random() - 0.5) * 20;
        try {
            const imageData = ctx.getImageData(0, sliceY, CANVAS_WIDTH, sliceHeight);
            ctx.putImageData(imageData, sliceOffset, sliceY);
        } catch (e) { }
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

loadPersistence();
gameLoop();
