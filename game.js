// Biến toàn cục để lưu game
let game;
let audioContext = null; // Khởi tạo ngay từ đầu

// Khởi tạo canvas và ngữ cảnh
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const loadingScreen = document.getElementById('loadingScreen');
const selectionScreen = document.getElementById('selectionScreen');
let countdownElement = null;

// Khởi tạo AudioContext ngay từ đầu
try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log('AudioContext được khởi tạo, trạng thái ban đầu:', audioContext.state);
} catch (err) {
    console.error('Lỗi khởi tạo AudioContext:', err);
}

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
    if (game) game.scale = canvas.width / 480;
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

// Biến âm thanh
let flapSound = null, hitSound = null, scoreSound = null, bgMusic = null, powerupSound = null;

// Hàm tải hình ảnh
function loadImages(callback) {
    const images = [birdImgs.default, birdImgs.red, birdImgs.blue, baseImg, bgImg, shieldImg];
    let loaded = 0;

    images.forEach((img, index) => {
        img.onload = () => {
            loaded++;
            console.log(`Hình ảnh ${['bird.png', 'bird_red.png', 'bird_blue.png', 'base.png', 'background.png', 'shield.png'][index]} đã tải`);
            if (loaded === images.length) {
                console.log('Tất cả hình ảnh đã tải');
                callback();
            }
        };
        img.onerror = () => {
            console.error(`Lỗi tải hình ảnh ${['bird.png', 'bird_red.png', 'bird_blue.png', 'base.png', 'background.png', 'shield.png'][index]}`);
            loaded++;
            if (loaded === images.length) {
                console.log('Tất cả hình ảnh đã xử lý (có lỗi)');
                callback();
            }
        };
        if (img.complete && img.width > 0) {
            loaded++;
            console.log(`Hình ảnh ${['bird.png', 'bird_red.png', 'bird_blue.png', 'base.png', 'background.png', 'shield.png'][index]} đã sẵn có trong cache`);
            if (loaded === images.length) {
                console.log('Tất cả hình ảnh đã tải');
                callback();
            }
        }
    });
}

// Hàm tải âm thanh
function loadAudio(url, callback) {
    fetch(url)
        .then(response => {
            if (!response.ok) {
                console.warn(`${url} không tải được (404 hoặc lỗi khác), bỏ qua`);
                callback(null);
                return;
            }
            return response.arrayBuffer();
        })
        .then(buffer => {
            if (!buffer) {
                callback(null);
                return;
            }
            if (audioContext) {
                audioContext.decodeAudioData(buffer, decoded => {
                    console.log(`${url} đã giải mã thành công`);
                    callback(decoded);
                }, err => {
                    console.error(`Lỗi giải mã ${url}:`, err);
                    callback(null);
                });
            } else {
                console.error('AudioContext không tồn tại');
                callback(null);
            }
        })
        .catch(err => {
            console.error(`Lỗi tải ${url}:`, err);
            callback(null);
        });
}

function loadAllAssets(callback) {
    loadImages(() => {
        console.log('Bắt đầu tải âm thanh');
        let loadedAudios = 0;
        const audioFiles = ['flap.mp3', 'hit.mp3', 'score.mp3', 'bgMusic.mp3', 'powerup.mp3'];
        const audioBuffers = [];

        audioFiles.forEach((file, index) => {
            loadAudio(file, (buffer) => {
                audioBuffers[index] = buffer;
                loadedAudios++;
                if (loadedAudios === audioFiles.length) {
                    flapSound = audioBuffers[0];
                    hitSound = audioBuffers[1];
                    scoreSound = audioBuffers[2];
                    bgMusic = audioBuffers[3];
                    powerupSound = audioBuffers[4];
                    console.log('Tất cả âm thanh đã xử lý');
                    callback();
                }
            });
        });
    });
}

function playSound(buffer) {
    if (!buffer || !audioContext) {
        console.warn('Không thể phát âm thanh: buffer hoặc audioContext không tồn tại');
        return;
    }
    if (audioContext.state === 'suspended') {
        console.warn('AudioContext đang bị tạm dừng, âm thanh sẽ phát sau khi resume');
        return;
    }
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
}

function playBackgroundMusic() {
    if (!bgMusic || !audioContext) {
        console.warn('Không thể phát nhạc nền: bgMusic hoặc audioContext không tồn tại');
        return;
    }
    if (audioContext.state === 'suspended') {
        console.warn('AudioContext đang bị tạm dừng, nhạc nền sẽ phát sau khi resume');
        return;
    }
    const source = audioContext.createBufferSource();
    source.buffer = bgMusic;
    source.loop = true;
    source.connect(audioContext.destination);
    source.start(0);
}

// Kích hoạt AudioContext sau tương tác người dùng
canvas.addEventListener('click', () => {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('AudioContext đã được kích hoạt, trạng thái:', audioContext.state);
            playBackgroundMusic(); // Phát nhạc nền ngay sau khi kích hoạt
        }).catch(err => {
            console.error('Lỗi khi kích hoạt AudioContext:', err);
        });
    }
});

// Hàm chọn chim và bắt đầu game
function selectBird(skin) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('birdSkin', skin);
    }
    console.log(`Đã chọn chim: ${skin}`);
    selectionScreen.style.display = 'none';
    canvas.style.display = 'block';
    startGame(skin);
}

function startGame(skin) {
    if (!countdownElement) {
        console.error('Không tìm thấy countdownElement! Kiểm tra lại index.html');
        return;
    }
    console.log('Bắt đầu đếm ngược với chim:', skin);
    let count = 3;
    countdownElement.style.display = 'block';
    const countdownInterval = setInterval(() => {
        countdownElement.textContent = count;
        count--;
        if (count < 0) {
            clearInterval(countdownInterval);
            countdownElement.style.display = 'none';
            console.log('Đếm ngược hoàn tất, khởi động game');
            game = new Game(skin);
            game.start();
        }
    }, 1000);
}

// Lớp Bird
class Bird {
    constructor(skin) {
        this.scale = canvas.width / 480;
        this.x = 150 * this.scale;
        this.y = canvas.height / 2;
        this.width = 45 * this.scale;
        this.height = 45 * this.scale;
        this.velocity = 0;
        this.gravity = 0.5 * this.scale;
        this.lift = -12 * this.scale;
        this.skin = skin || 'default';
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
        const birdImg = birdImgs[this.skin] || birdImgs['default'];
        if (birdImg && birdImg.complete && birdImg.width > 0) {
            ctx.drawImage(birdImg, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = 'yellow';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        if (this.shielded && shieldImg && shieldImg.complete && shieldImg.width > 0) {
            ctx.drawImage(shieldImg, this.x, this.y, this.width, this.height);
        } else if (this.shielded) {
            ctx.fillStyle = 'blue';
            ctx.fillRect(this.x, this.y, this.width, this.height);
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
        if (shieldImg && shieldImg.complete && shieldImg.width > 0) {
            ctx.drawImage(shieldImg, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = 'blue';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    offscreen() {
        return this.x + this.width < 0;
    }
}

class Game {
    constructor(skin) {
        this.bird = new Bird(skin);
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
        console.log('Game đang khởi động');
        this.addPipe();
        this.addPowerUp();
        this.setupInput();
        this.loop();
    }

    setupInput() {
        canvas.addEventListener('click', () => {
            console.log('Nhấp chuột được phát hiện');
            if (!this.gameOver) {
                this.bird.flap();
            } else {
                this.reset();
            }
        });
        canvas.addEventListener('touchstart', (e) => {
            console.log('Chạm màn hình được phát hiện');
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
        if (bgImg && bgImg.complete && bgImg.width > 0) {
            ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = '#70C5CE';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        this.pipes.forEach(pipe => pipe.draw());
        this.powerUps.forEach(powerUp => powerUp.draw());
        this.bird.draw();
        if (baseImg && baseImg.complete && baseImg.width > 0) {
            ctx.drawImage(baseImg, 0, canvas.height - 75 * this.scale, canvas.width, 75 * this.scale);
        } else {
            ctx.fillStyle = 'brown';
            ctx.fillRect(0, canvas.height - 75 * this.scale, canvas.width, 75 * this.scale);
        }
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
        this.bird = new Bird(this.bird.skin);
        this.pipes = [];
        this.powerUps = [];
        this.score = 0;
        this.streak = 0;
        this.gameOver = false;
        this.lastPipeTime = Date.now();
        this.addPipe();
        this.addPowerUp();
        this.scale = canvas.width / 480;
        console.log('Khởi động lại game');
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

// Khởi chạy tải tài nguyên khi trang mở
window.onload = () => {
    console.log('Bắt đầu tải tài nguyên');
    countdownElement = document.getElementById('countdown');
    if (!countdownElement) {
        console.error('Không tìm thấy phần tử countdown! Kiểm tra lại index.html');
        return;
    }
    loadAllAssets(() => {
        console.log('Hoàn tất tải tài nguyên, chuyển sang bước tiếp theo');
        loadingScreen.style.display = 'none';
        let savedSkin = localStorage.getItem('birdSkin');
        if (savedSkin) {
            console.log(`Khởi động với chim đã chọn: ${savedSkin}`);
            selectionScreen.style.display = 'none';
            canvas.style.display = 'block';
            startGame(savedSkin);
        } else {
            console.log('Hiển thị màn hình chọn chim');
            selectionScreen.style.display = 'flex';
        }
    });
};
