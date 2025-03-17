// Biến toàn cục để lưu game
let game;

// Khởi tạo canvas và ngữ cảnh
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const selectionScreen = document.getElementById('selectionScreen');

function resizeCanvas() {
    const aspectRatio = 3 / 4;
    let width = window.innerWidth;
    let height = window.innerHeight;
    if (width / height > aspectRatio) {
        height = Math.min(height, 720);
        width = height * aspectRatio;
    } else {
        width = Math.min(width, 480);
        height = width / aspectRatio;
    }
    canvas.width = width;
    canvas.height = height;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Khởi tạo hình ảnh
const birdImgs = {
    default: new Image(),
    red: new Image(),
    blue: new Image()
};
birdImgs.default.src = 'bird.png';
birdImgs.red.src = 'bird_red.png';
birdImgs.blue.src = 'bird_blue.png';

const baseImg = new Image();
baseImg.src = 'base.png';
const bgImg = new Image();
bgImg.src = 'background.png';
const shieldImg = new Image();
shieldImg.src = 'shield.png';

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let flapSound, hitSound, scoreSound, bgMusic, powerupSound;

function loadAudio(url) {
    return fetch(url)
        .then(response => response.arrayBuffer())
        .then(buffer => audioContext.decodeAudioData(buffer))
        .catch(() => null);
}

function playSound(buffer) {
    if (!buffer) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
}

function playBackgroundMusic() {
    if (!bgMusic) return;
    const source = audioContext.createBufferSource();
    source.buffer = bgMusic;
    source.loop = true;
    source.connect(audioContext.destination);
    source.start(0);
}

function loadEssentialAssets() {
    return Promise.all([
        new Promise(resolve => birdImgs.default.onload = resolve),
        new Promise(resolve => birdImgs.red.onload = resolve),
        new Promise(resolve => birdImgs.blue.onload = resolve),
        new Promise(resolve => baseImg.onload = resolve),
        new Promise(resolve => bgImg.onload = resolve),
        new Promise(resolve => shieldImg.onload = resolve)
    ]);
}

function loadAudioAssets() {
    loadAudio('flap.mp3').then(buffer => flapSound = buffer);
    loadAudio('hit.mp3').then(buffer => hitSound = buffer);
    loadAudio('score.mp3').then(buffer => scoreSound = buffer);
    loadAudio('bgMusic.mp3').then(buffer => {
        bgMusic = buffer;
        playBackgroundMusic();
    });
    loadAudio('powerup.mp3').then(buffer => powerupSound = buffer);
}

// Hàm chọn chim
function selectBird(skin) {
    localStorage.setItem('birdSkin', skin); // Lưu loại chim vào localStorage
    console.log(`Đã chọn chim: ${skin}`);
}

// Hàm bắt đầu game
function startGame() {
    selectionScreen.style.display = 'none'; // Ẩn màn hình chọn
    canvas.style.display = 'block'; // Hiển thị canvas
    loadEssentialAssets().then(() => {
        console.log('Tài nguyên đã tải xong');
        game = new Game();
        console.log('Game đã khởi tạo');
        game.start();
        loadAudioAssets();
    }).catch(error => {
        console.error('Lỗi khi tải hình ảnh:', error);
    });
}

class Bird {
    constructor() {
        this.scale = canvas.width / 480;
        this.x = 150 * this.scale;
        this.y = canvas.height / 2;
        this.width = 45 * this.scale;
        this.height = 45 * this.scale;
        this.velocity = 0;
        this.gravity = 0.5 * this.scale;
        this.lift = -12 * this.scale;
        this.skin = localStorage.getItem('birdSkin') || 'default'; // Lấy loại chim từ localStorage
        this.shielded = false;
        this.shieldTimer = 0;
    }

    flap() {
        this.velocity = this.lift;
        playSound(flapSound);
    }

    update() {
        this.velocity += this.gravity;
        this.y += this.velocity;
        if (this.shielded) {
            this.shieldTimer--;
            if (this.shieldTimer <= 0) {
                this.shielded = false;
            }
        }
    }

    draw() {
        const birdImg = birdImgs[this.skin] || birdImgs['default']; // Sử dụng hình ảnh của loại chim được chọn
        ctx.drawImage(birdImg, this.x, this.y, this.width, this.height);
        if (this.shielded) {
            ctx.drawImage(shieldImg, this.x, this.y, this.width, this.height);
        }
    }

    activateShield() {
        this.shielded = true;
        this.shieldTimer = 300;
        playSound(powerupSound);
    }
}

class Pipe {
    constructor() {
        this.scale = canvas.width / 480;
        this.x = canvas.width;
        this.width = 75 * this.scale;
        this.gap = 225 * this.scale;
        this.topHeight = Math.random() * (canvas.height - this.gap - 150 * this.scale) + 75 * this.scale;
        this.bottomY = this.topHeight + this.gap;
        this.speed = 3 * this.scale;
        this.scored = false;
    }

    update() {
        this.x -= this.speed;
    }

    draw() {
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x, 0, this.width, this.topHeight);
        ctx.fillRect(this.x, this.bottomY, this.width, canvas.height - this.bottomY);
    }

    offscreen() {
        return this.x + this.width < 0;
    }
}

class PowerUp {
    constructor() {
        this.scale = canvas.width / 480;
        this.x = canvas.width + Math.random() * 200 * this.scale;
        this.y = Math.random() * (canvas.height - 100 * this.scale) + 50 * this.scale;
        this.width = 30 * this.scale;
        this.height = 30 * this.scale;
        this.type = 'shield';
    }

    update() {
        this.x -= 3 * this.scale;
    }

    draw() {
        ctx.drawImage(shieldImg, this.x, this.y, this.width, this.height);
    }

    offscreen() {
        return this.x + this.width < 0;
    }
}

class Game {
    constructor() {
        this.bird = new Bird();
        this.pipes = [];
        this.powerUps = [];
        this.score = 0;
        this.streak = 0;
        this.highScore = localStorage.getItem('highScore') ? parseInt(localStorage.getItem('highScore')) : 0;
        this.gameOver = false;
        this.pipeInterval = 2000;
        this.lastPipeTime = Date.now();
        this.scale = canvas.width / 480;
    }

    start() {
        this.addPipe();
        this.addPowerUp();
        this.setupInput();
        this.loop();
    }

    setupInput() {
        canvas.addEventListener('click', () => {
            if (!this.gameOver) {
                this.bird.flap();
            } else {
                this.reset();
            }
        });
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.gameOver) {
                this.bird.flap();
            } else {
                this.reset();
            }
        });
    }

    addPipe() {
        this.pipes.push(new Pipe());
    }

    addPowerUp() {
        if (Math.random() < 0.2) {
            this.powerUps.push(new PowerUp());
        }
    }

    update() {
        if (this.gameOver) return;
        this.bird.update();
        this.pipes.forEach(pipe => pipe.update());
        this.powerUps.forEach(powerUp => powerUp.update());
        this.pipes = this.pipes.filter(pipe => !pipe.offscreen());
        this.powerUps = this.powerUps.filter(powerUp => !powerUp.offscreen());
        const now = Date.now();
        if (now - this.lastPipeTime > this.pipeInterval) {
            this.addPipe();
            this.addPowerUp();
            this.lastPipeTime = now;
        }
        this.checkCollisions();
        this.updateScore();
    }

    draw() {
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        this.pipes.forEach(pipe => pipe.draw());
        this.powerUps.forEach(powerUp => powerUp.draw());
        this.bird.draw();
        ctx.drawImage(baseImg, 0, canvas.height - 75 * this.scale, canvas.width, 75 * this.scale);
        ctx.fillStyle = 'white';
        ctx.font = `${36 * this.scale}px Arial`;
        ctx.fillText(`Score: ${this.score}`, 15 * this.scale, 45 * this.scale);
        ctx.fillText(`Streak: ${this.streak}`, 15 * this.scale, 90 * this.scale);
        ctx.fillText(`High Score: ${this.highScore}`, 15 * this.scale, 135 * this.scale);
        if (this.gameOver) {
            ctx.fillStyle = 'red';
            ctx.font = `${72 * this.scale}px Arial`;
            ctx.fillText('Game Over', canvas.width / 2 - 180 * this.scale, canvas.height / 2);
        }
    }

    checkCollisions() {
        if (this.bird.y + this.bird.height > canvas.height - 75 * this.scale || this.bird.y < 0) {
            if (!this.bird.shielded) {
                this.endGame();
            } else {
                this.bird.velocity = 0;
            }
            return;
        }
        for (const pipe of this.pipes) {
            if (
                this.bird.x + this.bird.width > pipe.x &&
                this.bird.x < pipe.x + pipe.width &&
                (this.bird.y < pipe.topHeight || this.bird.y + this.bird.height > pipe.bottomY)
            ) {
                if (!this.bird.shielded) {
                    this.endGame();
                }
                break;
            }
        }
        for (let i = 0; i < this.powerUps.length; i++) {
            const powerUp = this.powerUps[i];
            if (
                this.bird.x < powerUp.x + powerUp.width &&
                this.bird.x + this.bird.width > powerUp.x &&
                this.bird.y < powerUp.y + powerUp.height &&
                this.bird.y + this.bird.height > powerUp.y
            ) {
                this.bird.activateShield();
                this.powerUps.splice(i, 1);
                break;
            }
        }
    }

    updateScore() {
        this.pipes.forEach(pipe => {
            if (!pipe.scored && this.bird.x > pipe.x + pipe.width) {
                this.streak++;
                this.score += this.streak > 3 ? 2 : 1;
                pipe.scored = true;
                playSound(scoreSound);
            }
        });
    }

    endGame() {
        this.gameOver = true;
        this.streak = 0;
        playSound(hitSound);
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('highScore', this.highScore);
        }
    }

    reset() {
        this.bird = new Bird();
        this.pipes = [];
        this.powerUps = [];
        this.score = 0;
        this.streak = 0;
        this.gameOver = false;
        this.lastPipeTime = Date.now();
        this.addPipe();
        this.addPowerUp();
        this.scale = canvas.width / 480;
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}
