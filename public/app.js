// Google Analytics default capture for this template.
// Future LLM edits: do not remove this gtag setup unless replacing it with equivalent page analytics capture.
const googleAnalyticsId = "G-ZKTPLMMFDQ";
const playerNameKey = "dat-dolphin-player-name";
const gameConfig = {
    width: 480,
    height: 640,
    gravity: 0.42,
    jumpVelocity: -7.4,
    pipeWidth: 74,
    pipeGap: 170,
    pipeSpacing: 225,
    pipeSpeed: 2.7,
    dolphinX: 118,
    dolphinRadius: 23,
    floorHeight: 76,
};
export function sanitizePlayerName(value) {
    const clean = value.replace(/\s+/g, " ").trim();
    if (!clean)
        return "Dolphin";
    return clean.slice(0, 18).trim();
}
export function normalizeScore(value) {
    const score = Number(value);
    if (!Number.isFinite(score))
        return 0;
    return Math.max(0, Math.min(9999, Math.floor(score)));
}
function isScoreEntry(value) {
    if (!value || typeof value !== "object")
        return false;
    const entry = value;
    return (typeof entry.id === "string" &&
        typeof entry.name === "string" &&
        typeof entry.score === "number" &&
        typeof entry.createdAt === "string");
}
export function normalizeLeaderboard(value, limit = 10) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter(isScoreEntry)
        .map((entry) => ({
        ...entry,
        name: sanitizePlayerName(entry.name),
        score: normalizeScore(entry.score),
    }))
        .sort((left, right) => right.score - left.score || left.createdAt.localeCompare(right.createdAt))
        .slice(0, limit);
}
function initializeGoogleAnalytics() {
    const googleTagScript = document.createElement("script");
    googleTagScript.async = true;
    googleTagScript.src = `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`;
    document.head.append(googleTagScript);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
        window.dataLayer?.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", googleAnalyticsId);
}
function getElement(selector, type) {
    const element = document.querySelector(selector);
    if (!(element instanceof type)) {
        throw new Error(`Missing required element: ${selector}`);
    }
    return element;
}
function getElements() {
    const canvas = getElement("#game-canvas", HTMLCanvasElement);
    const context = canvas.getContext("2d");
    if (!context)
        throw new Error("Missing 2D canvas context.");
    return {
        canvas,
        context,
        form: getElement("#player-form", HTMLFormElement),
        nameInput: getElement("#player-name", HTMLInputElement),
        startButton: getElement("#start-game", HTMLButtonElement),
        statusText: getElement("#game-status", HTMLElement),
        score: getElement("#score", HTMLElement),
        bestScore: getElement("#best-score", HTMLElement),
        leaderboard: getElement("#leaderboard", HTMLOListElement),
        leaderboardStatus: getElement("#leaderboard-status", HTMLElement),
        navLinks: document.querySelectorAll(".nav a"),
    };
}
function createPipe(x, frame) {
    const wave = Math.sin(frame * 0.027) * 105;
    const gapY = Math.round(gameConfig.height * 0.43 + wave);
    return { x, gapY, scored: false };
}
function createGameState(bestScore = 0) {
    return {
        status: "ready",
        dolphinY: gameConfig.height * 0.46,
        velocity: 0,
        pipes: [
            createPipe(gameConfig.width + 120, 0),
            createPipe(gameConfig.width + 120 + gameConfig.pipeSpacing, 90),
            createPipe(gameConfig.width + 120 + gameConfig.pipeSpacing * 2, 180),
        ],
        score: 0,
        bestScore,
        frame: 0,
        lastRecordedScore: null,
    };
}
function drawBackground(context) {
    const sky = context.createLinearGradient(0, 0, 0, gameConfig.height);
    sky.addColorStop(0, "#87d6f4");
    sky.addColorStop(0.62, "#d7f4ff");
    sky.addColorStop(1, "#fbf6da");
    context.fillStyle = sky;
    context.fillRect(0, 0, gameConfig.width, gameConfig.height);
    context.fillStyle = "rgba(255, 255, 255, 0.72)";
    const clouds = [
        [72, 92, 30],
        [290, 76, 38],
        [408, 150, 24],
    ];
    for (const cloud of clouds) {
        context.beginPath();
        context.arc(cloud[0], cloud[1], cloud[2], 0, Math.PI * 2);
        context.arc(cloud[0] + cloud[2] * 0.9, cloud[1] + 7, cloud[2] * 0.78, 0, Math.PI * 2);
        context.arc(cloud[0] - cloud[2] * 0.9, cloud[1] + 9, cloud[2] * 0.66, 0, Math.PI * 2);
        context.fill();
    }
    context.fillStyle = "#1b8876";
    context.fillRect(0, gameConfig.height - gameConfig.floorHeight, gameConfig.width, gameConfig.floorHeight);
    context.fillStyle = "#f3d277";
    context.fillRect(0, gameConfig.height - gameConfig.floorHeight, gameConfig.width, 18);
}
function drawPipe(context, pipe) {
    const topHeight = pipe.gapY - gameConfig.pipeGap / 2;
    const bottomY = pipe.gapY + gameConfig.pipeGap / 2;
    const bottomHeight = gameConfig.height - gameConfig.floorHeight - bottomY;
    context.fillStyle = "#0e8f83";
    context.fillRect(pipe.x, 0, gameConfig.pipeWidth, topHeight);
    context.fillRect(pipe.x, bottomY, gameConfig.pipeWidth, bottomHeight);
    context.fillStyle = "#0a685f";
    context.fillRect(pipe.x - 6, topHeight - 22, gameConfig.pipeWidth + 12, 22);
    context.fillRect(pipe.x - 6, bottomY, gameConfig.pipeWidth + 12, 22);
}
function drawDolphin(context, state) {
    const x = gameConfig.dolphinX;
    const y = state.dolphinY;
    const tilt = Math.max(-0.45, Math.min(0.7, state.velocity / 10));
    context.save();
    context.translate(x, y);
    context.rotate(tilt);
    context.fillStyle = "#2f7fd2";
    context.beginPath();
    context.ellipse(0, 0, 31, 19, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#8cd6ff";
    context.beginPath();
    context.ellipse(7, 7, 17, 8, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#1d5ea0";
    context.beginPath();
    context.moveTo(-28, -2);
    context.lineTo(-51, -18);
    context.lineTo(-42, 2);
    context.lineTo(-52, 19);
    context.closePath();
    context.fill();
    context.fillStyle = "#19528d";
    context.beginPath();
    context.moveTo(0, -17);
    context.lineTo(-10, -38);
    context.lineTo(14, -18);
    context.closePath();
    context.fill();
    context.fillStyle = "#0b1720";
    context.beginPath();
    context.arc(18, -6, 3.2, 0, Math.PI * 2);
    context.fill();
    context.restore();
}
function drawGame(context, state) {
    context.clearRect(0, 0, gameConfig.width, gameConfig.height);
    drawBackground(context);
    state.pipes.forEach((pipe) => drawPipe(context, pipe));
    drawDolphin(context, state);
    if (state.status !== "playing") {
        context.fillStyle = "rgba(11, 23, 32, 0.54)";
        context.fillRect(0, 0, gameConfig.width, gameConfig.height);
        context.fillStyle = "#ffffff";
        context.textAlign = "center";
        context.font = "800 34px system-ui, sans-serif";
        context.fillText(state.status === "ready" ? "Tap to flap" : "Splash down", gameConfig.width / 2, 280);
        context.font = "700 17px system-ui, sans-serif";
        context.fillText("Space, click, or tap", gameConfig.width / 2, 316);
    }
}
function pipeHitsDolphin(pipe, dolphinY) {
    const radius = gameConfig.dolphinRadius;
    const dolphinLeft = gameConfig.dolphinX - radius;
    const dolphinRight = gameConfig.dolphinX + radius;
    const pipeLeft = pipe.x;
    const pipeRight = pipe.x + gameConfig.pipeWidth;
    if (dolphinRight < pipeLeft || dolphinLeft > pipeRight)
        return false;
    const gapTop = pipe.gapY - gameConfig.pipeGap / 2;
    const gapBottom = pipe.gapY + gameConfig.pipeGap / 2;
    return dolphinY - radius < gapTop || dolphinY + radius > gapBottom;
}
function updateGame(state) {
    if (state.status !== "playing")
        return state;
    const floorY = gameConfig.height - gameConfig.floorHeight;
    const nextFrame = state.frame + 1;
    const dolphinY = state.dolphinY + state.velocity;
    const velocity = state.velocity + gameConfig.gravity;
    let score = state.score;
    let pipes = state.pipes.map((pipe) => ({ ...pipe, x: pipe.x - gameConfig.pipeSpeed }));
    const firstPipe = pipes[0];
    if (firstPipe && firstPipe.x + gameConfig.pipeWidth < -12) {
        const lastX = pipes[pipes.length - 1]?.x ?? gameConfig.width;
        pipes = [...pipes.slice(1), createPipe(lastX + gameConfig.pipeSpacing, nextFrame)];
    }
    pipes = pipes.map((pipe) => {
        if (!pipe.scored && pipe.x + gameConfig.pipeWidth < gameConfig.dolphinX) {
            score += 1;
            return { ...pipe, scored: true };
        }
        return pipe;
    });
    const crashed = dolphinY - gameConfig.dolphinRadius < 0 ||
        dolphinY + gameConfig.dolphinRadius > floorY ||
        pipes.some((pipe) => pipeHitsDolphin(pipe, dolphinY));
    return {
        ...state,
        status: crashed ? "ended" : "playing",
        dolphinY,
        velocity,
        pipes,
        score,
        bestScore: Math.max(state.bestScore, score),
        frame: nextFrame,
    };
}
async function fetchLeaderboard() {
    const response = await fetch("/api/scores", { headers: { accept: "application/json" } });
    if (!response.ok)
        throw new Error("Scoreboard unavailable.");
    const body = (await response.json());
    return normalizeLeaderboard(body.scores);
}
async function postScore(name, score) {
    const response = await fetch("/api/scores", {
        method: "POST",
        headers: {
            accept: "application/json",
            "content-type": "application/json",
        },
        body: JSON.stringify({ name: sanitizePlayerName(name), score: normalizeScore(score) }),
    });
    if (!response.ok)
        throw new Error("Score save failed.");
    const body = (await response.json());
    return normalizeLeaderboard(body.scores);
}
function renderLeaderboard(elements, scores) {
    elements.leaderboard.replaceChildren();
    if (scores.length === 0) {
        const empty = document.createElement("li");
        empty.className = "empty-score";
        empty.textContent = "No scores yet";
        elements.leaderboard.append(empty);
        return;
    }
    scores.forEach((entry) => {
        const row = document.createElement("li");
        const name = document.createElement("span");
        const score = document.createElement("strong");
        const date = document.createElement("time");
        name.textContent = entry.name;
        score.textContent = String(entry.score);
        date.dateTime = entry.createdAt;
        date.textContent = new Date(entry.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
        });
        row.append(name, score, date);
        elements.leaderboard.append(row);
    });
}
function initializeApp() {
    initializeGoogleAnalytics();
    const elements = getElements();
    const storedName = localStorage.getItem(playerNameKey);
    if (storedName)
        elements.nameInput.value = sanitizePlayerName(storedName);
    let leaderboard = [];
    let state = createGameState();
    let animationId = 0;
    function render() {
        elements.score.textContent = String(state.score);
        elements.bestScore.textContent = String(state.bestScore);
        elements.statusText.textContent =
            state.status === "playing"
                ? "Keep swimming"
                : state.status === "ready"
                    ? "Ready"
                    : `Finished with ${state.score}`;
        elements.startButton.textContent = state.status === "playing" ? "Flap" : "Start";
        drawGame(elements.context, state);
    }
    async function refreshLeaderboard(message = "Loading scores") {
        elements.leaderboardStatus.textContent = message;
        try {
            leaderboard = await fetchLeaderboard();
            renderLeaderboard(elements, leaderboard);
            elements.leaderboardStatus.textContent = "Global scores";
        }
        catch {
            renderLeaderboard(elements, leaderboard);
            elements.leaderboardStatus.textContent = "Scores offline";
        }
    }
    async function recordFinishedScore() {
        if (state.status !== "ended" || state.lastRecordedScore === state.score)
            return;
        state = { ...state, lastRecordedScore: state.score };
        elements.leaderboardStatus.textContent = "Saving score";
        try {
            const scores = await postScore(elements.nameInput.value, state.score);
            leaderboard = scores;
            renderLeaderboard(elements, leaderboard);
            elements.leaderboardStatus.textContent = "Score saved";
        }
        catch {
            elements.leaderboardStatus.textContent = "Score not saved";
        }
    }
    function tick() {
        state = updateGame(state);
        render();
        if (state.status === "ended") {
            void recordFinishedScore();
        }
        animationId = window.requestAnimationFrame(tick);
    }
    function flap() {
        const cleanName = sanitizePlayerName(elements.nameInput.value);
        elements.nameInput.value = cleanName;
        localStorage.setItem(playerNameKey, cleanName);
        if (state.status === "ready" || state.status === "ended") {
            state = createGameState(state.bestScore);
            state.status = "playing";
        }
        state = { ...state, velocity: gameConfig.jumpVelocity };
        render();
    }
    function updateCurrentNavLink() {
        const currentHash = window.location.hash || "#play";
        elements.navLinks.forEach((link) => {
            link.setAttribute("aria-current", link.getAttribute("href") === currentHash ? "page" : "false");
        });
    }
    elements.form.addEventListener("submit", (event) => {
        event.preventDefault();
        flap();
    });
    elements.startButton.addEventListener("click", flap);
    elements.canvas.addEventListener("pointerdown", flap);
    window.addEventListener("keydown", (event) => {
        if (event.code === "Space" || event.code === "ArrowUp") {
            event.preventDefault();
            flap();
        }
    });
    window.addEventListener("hashchange", updateCurrentNavLink);
    window.addEventListener("pagehide", () => window.cancelAnimationFrame(animationId));
    renderLeaderboard(elements, leaderboard);
    render();
    updateCurrentNavLink();
    void refreshLeaderboard();
    animationId = window.requestAnimationFrame(tick);
}
if (typeof document !== "undefined") {
    initializeApp();
}
