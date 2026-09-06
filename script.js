// ============================================================
// MEDIAPIPE IMPORT
// ============================================================
import { GestureRecognizer, FilesetResolver } from "@mediapipe/tasks-vision";

// ============================================================
// GAME VARIABLES
// ============================================================
let username = "Player";
let won = 0, lost = 0, draw = 0;
let currentMode = "manual";
let gameHistory = [];

// ============================================================
// CAMERA VARIABLES
// ============================================================
let cameraStream = null;
let gestureRecognizer = null;
let cameraRunning = false;
let detectedMove = null;
let animationFrameId = null;
let lastVideoTime = -1;
let battleRunning = false;
let countdownTimer = null;
let isDetectionPhase = false;
let playerFinalMove = null;

// Best of 3
let roundNumber = 1;
let playerRoundsWon = 0;
let computerRoundsWon = 0;

// ============================================================
// DOM ELEMENTS
// ============================================================
const startScreen = document.getElementById("startScreen");
const gameScreen = document.getElementById("gameScreen");
const modeScreen = document.getElementById("modeScreen");
const manualScreen = document.getElementById("manualScreen");
const cameraScreen = document.getElementById("cameraScreen");
const resultScreen = document.getElementById("resultScreen");

// ============================================================
// START GAME
// ============================================================
document.getElementById("startButton").addEventListener("click", startGame);

function startGame() {
    const input = document.getElementById("username").value.trim();
    if (input !== "") username = input;
    document.getElementById("welcomeName").innerHTML = "👋 Welcome " + username + "!";
    document.getElementById("playerName").innerHTML = "👤 " + username;
    document.getElementById("cameraPlayerName").innerHTML = "👤 " + username;
    startScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    updateScore();
    updateHistory();
}

function hideAllScreens() {
    modeScreen.classList.add("hidden");
    manualScreen.classList.add("hidden");
    cameraScreen.classList.add("hidden");
    resultScreen.classList.add("hidden");
}

// ============================================================
// MANUAL MODE
// ============================================================
document.getElementById("manualModeButton").addEventListener("click", () => {
    currentMode = "manual";
    stopCamera();
    hideAllScreens();
    manualScreen.classList.remove("hidden");
});

// ============================================================
// CAMERA MODE
// ============================================================
document.getElementById("cameraModeButton").addEventListener("click", openCameraMode);

async function openCameraMode() {
    currentMode = "camera";
    detectedMove = null;
    battleRunning = false;
    isDetectionPhase = false;
    playerFinalMove = null;
    roundNumber = 1;
    playerRoundsWon = 0;
    computerRoundsWon = 0;

    hideAllScreens();
    cameraScreen.classList.remove("hidden");

    document.getElementById("cameraStatus").innerHTML = '<span class="status-dot yellow"></span> Loading AI...';
    document.getElementById("detectedText").innerHTML = "👋 Show your hand...";
    document.getElementById("detectedEmoji").innerHTML = "✊";
    document.getElementById("cameraCountdown").innerHTML = "🎮 READY!";
    document.getElementById("cameraComputerHand").innerHTML = "✊";
    document.getElementById("computerCameraText").innerHTML = "🟢 Ready!";
    document.getElementById("cameraPlayButton").disabled = true;
    document.getElementById("roundInfo").innerHTML = "🎯 Round 1 of 3";
    document.getElementById("scoreInfo").innerHTML = "🏆 You: 0 | 🤖 Computer: 0";

    const computerHand = document.getElementById("cameraComputerHand");
    computerHand.className = "";
    computerHand.style.transform = "translateY(0px) rotate(0deg)";

    document.getElementById('playerBox').className = 'camera-box';
    document.getElementById('computerBox').className = 'computer-hand-box';

    await loadGestureRecognizer();
    await startCamera();
}

// ============================================================
// LOAD AI
// ============================================================
async function loadGestureRecognizer() {
    if (gestureRecognizer !== null) return;
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task"
            },
            runningMode: "VIDEO",
            numHands: 1
        });
        console.log("✅ AI Loaded");
    } catch (error) {
        console.error("❌ AI Error:", error);
        document.getElementById("cameraStatus").innerHTML = '<span class="status-dot red"></span> AI could not load.';
    }
}

// ============================================================
// START CAMERA
// ============================================================
async function startCamera() {
    try {
        stopCamera();
        const video = document.getElementById("webcam");
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: 640, height: 480 },
            audio: false
        });
        video.srcObject = cameraStream;
        await video.play();
        cameraRunning = true;
        lastVideoTime = -1;
        document.getElementById("cameraStatus").innerHTML = '<span class="status-dot green"></span> Camera ready! Show your hand ✊ ✋ ✌️';
        document.getElementById("cameraPlayButton").disabled = false;
        detectHandLoop();
    } catch (error) {
        console.error("❌ Camera Error:", error);
        document.getElementById("cameraStatus").innerHTML = '<span class="status-dot red"></span> Camera permission denied.';
    }
}

// ============================================================
// HAND DETECTION
// ============================================================
function detectHandLoop() {
    if (!cameraRunning) return;
    const video = document.getElementById("webcam");
    if (gestureRecognizer !== null && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        try {
            const results = gestureRecognizer.recognizeForVideo(video, performance.now());
            lastVideoTime = video.currentTime;
            if (isDetectionPhase) {
                processGestureForDetection(results);
            } else if (!battleRunning) {
                updateHandStatus(results);
            }
        } catch (error) {
            console.error("❌ Detection Error:", error);
        }
    }
    animationFrameId = requestAnimationFrame(detectHandLoop);
}

function updateHandStatus(results) {
    const playerBox = document.getElementById('playerBox');
    if (!results.gestures || results.gestures.length === 0 || results.gestures[0].length === 0) {
        detectedMove = null;
        document.getElementById("detectedText").innerHTML = "👋 Show your hand...";
        document.getElementById("detectedEmoji").innerHTML = "❓";
        playerBox.classList.remove('detecting');
        return;
    }
    const gesture = results.gestures[0][0].categoryName;
    let newMove = null;
    if (gesture === "Closed_Fist") newMove = "rock";
    else if (gesture === "Open_Palm") newMove = "paper";
    else if (gesture === "Victory") newMove = "scissors";
    detectedMove = newMove;
    if (detectedMove !== null) {
        document.getElementById("detectedText").innerHTML = "✅ Detected: " + capitalize(detectedMove);
        document.getElementById("detectedEmoji").innerHTML = getEmoji(detectedMove);
        playerBox.classList.add('detecting');
    }
}

function processGestureForDetection(results) {
    if (!results.gestures || results.gestures.length === 0 || results.gestures[0].length === 0) return;
    const gesture = results.gestures[0][0].categoryName;
    let newMove = null;
    if (gesture === "Closed_Fist") newMove = "rock";
    else if (gesture === "Open_Palm") newMove = "paper";
    else if (gesture === "Victory") newMove = "scissors";
    if (newMove !== null) {
        playerFinalMove = newMove;
        document.getElementById("detectedText").innerHTML = "🎯 Detected: " + capitalize(playerFinalMove) + "!";
        document.getElementById("detectedEmoji").innerHTML = getEmoji(playerFinalMove);
        document.getElementById('playerBox').classList.add('detecting');
    }
}

// ============================================================
// START BATTLE - UPDATED (Only Computer Shakes)
// ============================================================
document.getElementById("cameraPlayButton").addEventListener("click", startCameraBattle);

function startCameraBattle() {
    if (battleRunning) return;
    if (playerRoundsWon >= 2 || computerRoundsWon >= 2) {
        showFinalResult();
        return;
    }
    if (countdownTimer) {
        clearTimeout(countdownTimer);
        countdownTimer = null;
    }

    battleRunning = true;
    isDetectionPhase = false;
    playerFinalMove = null;

    const computerHand = document.getElementById("cameraComputerHand");
    const computerText = document.getElementById("computerCameraText");
    const countdown = document.getElementById("cameraCountdown");
    const playButton = document.getElementById("cameraPlayButton");
    const playerEmoji = document.getElementById("detectedEmoji");
    const playerText = document.getElementById("detectedText");
    const playerBox = document.getElementById('playerBox');
    const computerBox = document.getElementById('computerBox');

    playButton.disabled = true;
    playButton.innerHTML = "⏳ Round " + roundNumber + "...";

    // Reset classes
    playerBox.classList.remove('detecting', 'winner', 'loser');
    computerBox.classList.remove('shaking', 'winner', 'loser');

    computerHand.className = "";
    computerHand.style.transform = "translateY(0px) rotate(0deg)";
    computerHand.innerHTML = "✊";
    countdown.innerHTML = "🎮 GET READY!";
    computerText.innerHTML = "🟡 GET READY!";
    playerText.innerHTML = "🎮 GET READY!";
    playerEmoji.innerHTML = "✊"; // Player emoji stays still (no shake)

    // ONLY COMPUTER HAND SHAKES - NOT THE PLAYER EMOJI
    computerHand.className = "camera-shake";
    computerBox.classList.add('shaking');
    // Player emoji does NOT get shake class

    document.getElementById("roundInfo").innerHTML = "🎯 Round " + roundNumber + " of 3";

    const choices = ["rock", "paper", "scissors"];
    const computerMove = choices[Math.floor(Math.random() * choices.length)];

    // ===== ROCK! PAPER! SCISSORS! SHOOT! - COMMON COUNTDOWN =====
    setTimeout(() => {
        countdown.innerHTML = "ROCK! ✊";
        computerText.innerHTML = "🔴 SHAKE!";
        playerText.innerHTML = "ROCK! ✊";
    }, 500);

    setTimeout(() => {
        countdown.innerHTML = "PAPER! ✋";
        computerText.innerHTML = "🟡 SHAKE!";
        playerText.innerHTML = "PAPER! ✋";
    }, 1000);

    setTimeout(() => {
        countdown.innerHTML = "SCISSORS! ✌️";
        computerText.innerHTML = "🟢 GET READY!";
        playerText.innerHTML = "SCISSORS! ✌️";
    }, 1500);

    setTimeout(() => {
        countdown.innerHTML = "SHOOT! 🎯";
        computerText.innerHTML = "🔵 DETECTING...";
        playerText.innerHTML = "🔍 DETECTING...";
        
        isDetectionPhase = true;

        setTimeout(() => {
            isDetectionPhase = false;
            let finalPlayerMove = playerFinalMove || detectedMove || "rock";

            // Stop ONLY computer shake
            computerHand.className = "";
            computerHand.style.transform = "translateY(0px) rotate(0deg)";
            computerBox.classList.remove('shaking');
            // Player emoji never had shake class, so nothing to remove

            playerBox.classList.remove('detecting');

            // Reveal both hands
            playerEmoji.innerHTML = getEmoji(finalPlayerMove);
            playerText.innerHTML = "👤 You chose: " + capitalize(finalPlayerMove);
            computerHand.innerHTML = getEmoji(computerMove);
            computerText.innerHTML = "🤖 Computer chose: " + capitalize(computerMove);

            setTimeout(() => {
                let roundResult = determineWinner(finalPlayerMove, computerMove);
                if (roundResult === "player") playerRoundsWon++;
                else if (roundResult === "computer") computerRoundsWon++;

                document.getElementById("scoreInfo").innerHTML = "🏆 You: " + playerRoundsWon + " | 🤖 Computer: " + computerRoundsWon;

                let resultText = "";
                if (roundResult === "player") {
                    resultText = "🏆 You won this round! 🎉";
                    playerBox.classList.add('winner');
                    computerBox.classList.add('loser');
                    createConfetti();
                } else if (roundResult === "computer") {
                    resultText = "🤖 Computer won this round! 💪";
                    playerBox.classList.add('loser');
                    computerBox.classList.add('winner');
                } else {
                    resultText = "🤝 Draw!";
                }
                countdown.innerHTML = resultText;

                countdownTimer = setTimeout(() => {
                    battleRunning = false;
                    isDetectionPhase = false;
                    playButton.disabled = false;

                    if (playerRoundsWon >= 2 || computerRoundsWon >= 2) {
                        playButton.innerHTML = "🏆 See Final Result";
                        showFinalResult();
                    } else {
                        roundNumber++;
                        playButton.innerHTML = "⚡ Next Round " + roundNumber;
                        document.getElementById("roundInfo").innerHTML = "🎯 Round " + roundNumber + " of 3";
                        computerHand.innerHTML = "✊";
                        computerText.innerHTML = "🟢 Ready for round " + roundNumber;
                        countdown.innerHTML = "🎮 Round " + roundNumber + "!";
                        playerText.innerHTML = "👋 Show your hand...";
                        playerEmoji.innerHTML = "✊";
                        detectedMove = null;
                        playerFinalMove = null;
                        playerBox.classList.remove('winner', 'loser', 'detecting');
                        computerBox.classList.remove('winner', 'loser', 'shaking');
                    }
                }, 1500);
            }, 400);
        }, 700);
    }, 2000);
}

// ============================================================
// DETERMINE WINNER
// ============================================================
function determineWinner(player, computer) {
    if (player === computer) return "draw";
    if ((player === "rock" && computer === "scissors") ||
        (player === "paper" && computer === "rock") ||
        (player === "scissors" && computer === "paper")) {
        return "player";
    }
    return "computer";
}

// ============================================================
// CONFETTI CELEBRATION
// ============================================================
function createConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    const colors = ['#f093fb', '#f5576c', '#4facfe', '#43e97b', '#fbbf24', '#f87171', '#a78bfa', '#34d399'];
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = '-10%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.width = (Math.random() * 8 + 4) + 'px';
        confetti.style.height = (Math.random() * 8 + 4) + 'px';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        confetti.style.animationDelay = (Math.random() * 0.8) + 's';
        confetti.style.animationDuration = (Math.random() * 1.5 + 1.5) + 's';
        confetti.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
        container.appendChild(confetti);
    }
    setTimeout(() => { container.remove(); }, 3500);
}

// ============================================================
// SHOW FINAL RESULT
// ============================================================
function showFinalResult() {
    stopCamera();
    isDetectionPhase = false;
    battleRunning = false;
    hideAllScreens();
    resultScreen.classList.remove("hidden");

    let finalResult = "";
    let emoji = "";
    const playerCard = document.getElementById('playerCard');
    const computerCard = document.getElementById('computerCard');

    playerCard.classList.remove('winner-card', 'loser-card');
    computerCard.classList.remove('winner-card', 'loser-card');

    if (playerRoundsWon > computerRoundsWon) {
        finalResult = username + " WINS THE SERIES! 🏆🎉";
        emoji = "🏆";
        won++;
        playerCard.classList.add('winner-card');
        computerCard.classList.add('loser-card');
        createConfetti();
    } else if (computerRoundsWon > playerRoundsWon) {
        finalResult = "COMPUTER WINS THE SERIES! 🤖💪";
        emoji = "🤖";
        lost++;
        playerCard.classList.add('loser-card');
        computerCard.classList.add('winner-card');
    } else {
        finalResult = "SERIES DRAW! 🤝";
        emoji = "🤝";
        draw++;
    }

    document.getElementById("battleTitle").innerHTML = "🏆 BEST OF 3 RESULT! 🏆";
    document.getElementById("playerChoice").innerHTML = "👤";
    document.getElementById("computerChoice").innerHTML = "💻";
    document.getElementById("playerChoiceText").innerHTML = "You: <strong>" + playerRoundsWon + "</strong>";
    document.getElementById("computerChoiceText").innerHTML = "Computer: <strong>" + computerRoundsWon + "</strong>";
    document.getElementById("resultText").innerHTML = emoji + " " + finalResult;

    updateScore();
    addHistory("Best of 3", playerRoundsWon + "-" + computerRoundsWon, finalResult);
}

// ============================================================
// MANUAL GAME
// ============================================================
let manualRoundNumber = 1;
let manualPlayerWins = 0;
let manualComputerWins = 0;

document.querySelectorAll(".choice-button").forEach(btn => {
    btn.addEventListener("click", function() {
        const choice = this.dataset.choice;
        playManualGame(choice);
    });
});

function playManualGame(playerChoice) {
    if (manualRoundNumber === 1) {
        manualPlayerWins = 0;
        manualComputerWins = 0;
    }

    currentMode = "manual";
    hideAllScreens();
    resultScreen.classList.remove("hidden");

    const playerHand = document.getElementById("playerChoice");
    const computerHand = document.getElementById("computerChoice");
    const title = document.getElementById("battleTitle");
    const playerCard = document.getElementById('playerCard');
    const computerCard = document.getElementById('computerCard');

    playerCard.classList.remove('winner-card', 'loser-card');
    computerCard.classList.remove('winner-card', 'loser-card');

    playerHand.innerHTML = "✊";
    computerHand.innerHTML = "✊";
    title.innerHTML = "🎮 GET READY!";
    document.getElementById("resultText").innerHTML = "🎮 GET READY!";

    playerHand.className = "battle-hand shake-player";
    computerHand.className = "battle-hand shake-computer";

    const choices = ["rock", "paper", "scissors"];
    const computerChoice = choices[Math.floor(Math.random() * choices.length)];

    setTimeout(() => { title.innerHTML = "ROCK! ✊"; }, 500);
    setTimeout(() => { title.innerHTML = "PAPER! ✋"; }, 1000);
    setTimeout(() => { title.innerHTML = "SCISSORS! ✌️"; }, 1500);

    setTimeout(() => {
        playerHand.className = "battle-hand";
        computerHand.className = "battle-hand";
        playerHand.innerHTML = getEmoji(playerChoice);
        computerHand.innerHTML = getEmoji(computerChoice);
        document.getElementById("playerChoiceText").innerHTML = "👤 " + capitalize(playerChoice);
        document.getElementById("computerChoiceText").innerHTML = "🤖 " + capitalize(computerChoice);

        let roundResult = determineWinner(playerChoice, computerChoice);
        if (roundResult === "player") manualPlayerWins++;
        else if (roundResult === "computer") manualComputerWins++;

        if (manualPlayerWins >= 2 || manualComputerWins >= 2) {
            let finalResult = "";
            let emoji = "";
            if (manualPlayerWins > manualComputerWins) {
                finalResult = username + " WINS THE SERIES! 🏆🎉";
                emoji = "🏆";
                won++;
                playerCard.classList.add('winner-card');
                computerCard.classList.add('loser-card');
                createConfetti();
            } else {
                finalResult = "COMPUTER WINS THE SERIES! 🤖💪";
                emoji = "🤖";
                lost++;
                playerCard.classList.add('loser-card');
                computerCard.classList.add('winner-card');
            }
            title.innerHTML = "🏆 SERIES COMPLETE! 🏆";
            document.getElementById("resultText").innerHTML = emoji + " " + finalResult + "<br><br>📊 Score: " + manualPlayerWins + " - " + manualComputerWins;
            manualRoundNumber = 1;
            manualPlayerWins = 0;
            manualComputerWins = 0;
        } else {
            let resultText = "";
            let emoji = "";
            if (roundResult === "player") {
                resultText = "🏆 You won this round!";
                emoji = "🎉";
            } else if (roundResult === "computer") {
                resultText = "🤖 Computer won this round!";
                emoji = "💪";
            } else {
                resultText = "🤝 Draw!";
                emoji = "😐";
            }
            title.innerHTML = "⚔️ ROUND " + manualRoundNumber + " COMPLETE!";
            document.getElementById("resultText").innerHTML = emoji + " " + resultText + "<br><br>📊 Score: " + manualPlayerWins + " - " + manualComputerWins;
            manualRoundNumber++;
        }
        updateScore();
        addHistory("Manual", manualPlayerWins + "-" + manualComputerWins, "Series played");
    }, 2000);
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function getEmoji(choice) {
    if (choice === "rock") return "✊";
    if (choice === "paper") return "✋";
    if (choice === "scissors") return "✌️";
    return "❓";
}

function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function updateScore() {
    document.getElementById("won").innerHTML = won;
    document.getElementById("lost").innerHTML = lost;
    document.getElementById("draw").innerHTML = draw;
}

function addHistory(player, computer, result) {
    gameHistory.unshift({ player, computer, result });
    updateHistory();
}

function updateHistory() {
    const historyList = document.getElementById("historyList");
    historyList.innerHTML = "";
    if (gameHistory.length === 0) {
        historyList.innerHTML = "<p style='opacity:0.5;'>⚔️ No battles fought yet</p>";
        return;
    }
    gameHistory.forEach(game => {
        const item = document.createElement("div");
        item.className = "history-item";
        let badge = '';
        if (game.result.includes("WINS")) {
            badge = '<span class="result-badge win">🏆 WIN</span>';
        } else if (game.result.includes("COMPUTER WINS")) {
            badge = '<span class="result-badge lose">💀 LOSS</span>';
        } else {
            badge = '<span class="result-badge draw">🤝 DRAW</span>';
        }
        item.innerHTML = `
            <span>⚔️ ${game.player} VS ${game.computer}</span>
            <span>${badge}</span>
        `;
        historyList.appendChild(item);
    });
}

// ============================================================
// PLAY AGAIN
// ============================================================
document.getElementById("playAgainButton").addEventListener("click", () => {
    document.querySelectorAll('.battle-card').forEach(card => {
        card.classList.remove('winner-card', 'loser-card');
    });
    if (currentMode === "manual") {
        manualRoundNumber = 1;
        manualPlayerWins = 0;
        manualComputerWins = 0;
        hideAllScreens();
        manualScreen.classList.remove("hidden");
    } else {
        openCameraMode();
    }
});

// ============================================================
// BACK BUTTONS
// ============================================================
document.getElementById("manualBackButton").addEventListener("click", backToModes);
document.getElementById("cameraBackButton").addEventListener("click", backToModes);

function backToModes() {
    stopCamera();
    battleRunning = false;
    isDetectionPhase = false;
    if (countdownTimer) {
        clearTimeout(countdownTimer);
        countdownTimer = null;
    }
    roundNumber = 1;
    playerRoundsWon = 0;
    computerRoundsWon = 0;
    document.getElementById("cameraPlayButton").disabled = false;
    document.getElementById("cameraPlayButton").innerHTML = "⚡ Start Battle ⚡";
    document.getElementById('playerBox').className = 'camera-box';
    document.getElementById('computerBox').className = 'computer-hand-box';
    hideAllScreens();
    modeScreen.classList.remove("hidden");
}

// ============================================================
// STOP CAMERA
// ============================================================
function stopCamera() {
    cameraRunning = false;
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (cameraStream !== null) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    lastVideoTime = -1;
}

// ============================================================
// CLEAR HISTORY & RESET SCORE
// ============================================================
document.getElementById("clearHistoryButton").addEventListener("click", () => {
    gameHistory = [];
    updateHistory();
});

document.getElementById("resetButton").addEventListener("click", () => {
    won = 0;
    lost = 0;
    draw = 0;
    gameHistory = [];
    updateScore();
    updateHistory();
});
