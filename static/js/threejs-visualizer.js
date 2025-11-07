// static/js/app.js
// AIMPOINTER - Adicionado suporte a acelerômetro para estabilização e UI

// ===== UTILITÁRIAS =====
function normalizeAngle(angle) {
    let a = angle % 360;
    if (a < 0) a += 360;
    return a;
}
function angleDiff(a, b) {
    const na = normalizeAngle(a);
    const nb = normalizeAngle(b);
    let diff = na - nb;
    if (diff > 180) diff -= 360;
    if (diff <= -180) diff += 360;
    return diff;
}
function lerp(a, b, t) { return a + (b - a) * t; }

// ===== VISUAL / CALIBRAÇÃO (mantidos as versões anteriores, adaptadas para receber valores já fundidos) =====
// (Mantive o PositionBasedCalibrationSystem baseado na versão anterior; sem mudanças importantes aqui
//  exceto para chamar updateDeviceVisualization com os valores que a aplicação realmente usa.)

// ... (A mesma classe PositionBasedCalibrationSystem que você já tem, mantida conforme versão anterior)
// Para evitar repetição longa aqui, garanta que sua versão atualizada do arquivo contenha a classe
// PositionBasedCalibrationSystem igual à última versão que foi fornecida anteriormente (com baseline, métodos, updateUI, updateDeviceVisualization, etc.).
// Abaixo colocarei o código principal do sistema com a parte nova de fusão do acelerômetro integrada no handleOrientation.

// ===== SISTEMA DE CONTROLE PRINCIPAL (AJUSTADO PARA FUSÃO COM ACELERÔMETRO) =====
class AdvancedPointerSystem {
    constructor() {
        this.pointerSensitivity = 60;
        this.smoothingFactor = 0.75;
        this.compensation = 2;
        this.sensorFusion = true;
        this.calibration = { x: 0, y: 0, z: 0 };
        this.screenWidth = 1920;
        this.screenHeight = 1080;
        this.filteredPosition = { x: this.screenWidth / 2, y: this.screenHeight / 2 };
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.calibrationSystem = new PositionBasedCalibrationSystem();
        this.loadSettings();
    }

    // ... (outros métodos: loadSettings, saveSettings, setScreenResolution, resetFilter, setSensitivity, setSmoothingFactor, setCompensation)

    // Método central (recebe gamma,beta,alpha já POSSIVELMENTE fundidos)
    calculateAbsolutePosition(gamma, beta, alpha) {
        const baselineGamma = (this.calibration && typeof this.calibration.x === 'number') ? this.calibration.x : 0;
        const baselineBeta = (this.calibration && typeof this.calibration.y === 'number') ? this.calibration.y : 0;
        const baselineAlpha = (this.calibration && typeof this.calibration.z === 'number') ? this.calibration.z : 0;

        this.calibrationSystem.updateDeviceVisualization(gamma, beta, alpha);
        if (this.calibrationSystem.isCalibrating) {
            this.calibrationSystem.addCalibrationSample(gamma, beta, alpha);
        }

        const deltaGamma = angleDiff(gamma, baselineGamma);
        const deltaBeta = angleDiff(beta, baselineBeta);
        const deltaAlpha = angleDiff(alpha, baselineAlpha);

        const maxGamma = 90;
        const maxBeta = 180;
        const clampedGamma = Math.max(-maxGamma, Math.min(maxGamma, deltaGamma));
        const clampedBeta = Math.max(-maxBeta, Math.min(maxBeta, deltaBeta));

        const halfSens = this.pointerSensitivity / 2;
        let relX = clampedGamma / halfSens;
        let relY = -clampedBeta / halfSens;

        if (this.sensorFusion) {
            const radA = (deltaAlpha) * Math.PI / 180;
            const cosA = Math.cos(radA);
            const sinA = Math.sin(radA);
            const compFactor = 1 + (this.compensation * 0.05);
            const rx = relX * cosA - relY * sinA;
            const ry = relX * sinA + relY * cosA;
            relX = rx * compFactor;
            relY = ry * compFactor;
        }

        relX = Math.max(-1, Math.min(1, relX));
        relY = Math.max(-1, Math.min(1, relY));

        let absX = (relX * (this.screenWidth / 2)) + (this.screenWidth / 2);
        let absY = (relY * (this.screenHeight / 2)) + (this.screenHeight / 2);

        this.filteredPosition.x = this.smoothingFactor * this.filteredPosition.x + (1 - this.smoothingFactor) * absX;
        this.filteredPosition.y = this.smoothingFactor * this.filteredPosition.y + (1 - this.smoothingFactor) * absY;

        this.filteredPosition.x = Math.max(0, Math.min(this.screenWidth - 1, this.filteredPosition.x));
        this.filteredPosition.y = Math.max(0, Math.min(this.screenHeight - 1, this.filteredPosition.y));

        return { x: this.filteredPosition.x, y: this.filteredPosition.y };
    }

    // ... (updateFPS, calculateAccuracy, startAdvancedCalibration, confirmStep)
}

// ===== VARIÁVEIS GLOBAIS E NOVAS VARIÁVEIS PARA ACELERÔMETRO =====
const pointerSystem = new AdvancedPointerSystem();
let socket = null;
let sensorsActive = false;
let lastSendTime = 0;
const SEND_INTERVAL = 16;

// ACELERÔMETRO / FUSÃO
let useAccelerometer = true; // ligado por padrão (toggle na UI)
let accelAvailable = false;
let lastAccel = { x: 0, y: 0, z: 0 };
let accelStable = false;
const GRAVITY = 9.81;
const ACCEL_STABLE_TOL = 1.6; // tolerância da magnitude (m/s^2) para considerar "estável"
const ACCEL_TRUST_STABLE = 0.7; // peso dado ao ângulo derivado do accel quando estável
const ACCEL_TRUST_MOVING = 0.2; // peso quando em movimento

// Elementos da UI
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const crosshair = document.getElementById('crosshair');
const connectBtn = document.getElementById('connectBtn');
const sensorBtn = document.getElementById('sensorBtn');
const configPanel = document.getElementById('configPanel');
const overlay = document.getElementById('overlay');
const accelerometerIndicator = document.getElementById('accelerometerIndicator');

// ===== FUNÇÕES DO ACELERÔMETRO =====
function setupMotionListener() {
    // iOS pode requerer requestPermission separadamente
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        // Só pedir se não foi perguntado antes (pode causar pop-up repetido se chamado toda vez)
        DeviceMotionEvent.requestPermission().catch(() => {}).then(res => {
            // Se o browser não solicitar, ainda tentamos adicionar listener (alguns navegadores ignoram a promise)
            window.addEventListener('devicemotion', handleMotion);
        });
    } else {
        window.addEventListener('devicemotion', handleMotion);
    }
}

function teardownMotionListener() {
    window.removeEventListener('devicemotion', handleMotion);
}

function handleMotion(ev) {
    const acc = ev.accelerationIncludingGravity || ev.acceleration || { x: 0, y: 0, z: 0 };
    const ax = acc.x || 0, ay = acc.y || 0, az = acc.z || 0;
    accelAvailable = true;
    lastAccel = { x: ax, y: ay, z: az };

    // magnitude e estabilidade (próxima a 1g)
    const mag = Math.sqrt(ax*ax + ay*ay + az*az);
    accelStable = Math.abs(mag - GRAVITY) < ACCEL_STABLE_TOL;

    // Atualiza indicador UI
    if (accelerometerIndicator) {
        accelerometerIndicator.textContent = `Accel X:${ax.toFixed(2)} Y:${ay.toFixed(2)} Z:${az.toFixed(2)}`;
    }
}

// Calcula ângulos aproximados (roll/gamma, pitch/beta) a partir do accel
function accelToAngles(ax, ay, az) {
    // roll (gamma) = atan2(Y, Z)
    // pitch (beta) = atan2(-X, sqrt(Y^2 + Z^2))
    const roll = Math.atan2(ay, az) * 180 / Math.PI;
    const pitch = Math.atan2(-ax, Math.sqrt(ay*ay + az*az)) * 180 / Math.PI;
    // alpha não estimamos via accel
    return { gamma: roll, beta: pitch };
}

// ===== ORIENTAÇÃO E FUSÃO =====
function handleOrientation(event) {
    let gamma = (typeof event.gamma === 'number') ? event.gamma : 0;
    let beta = (typeof event.beta === 'number') ? event.beta : 0;
    let alpha = (typeof event.alpha === 'number') ? event.alpha : 0;

    // Se usar acelerômetro e estiver disponível, calcular ângulos por aceleração e fazer fusão
    if (useAccelerometer && accelAvailable) {
        const a = accelToAngles(lastAccel.x, lastAccel.y, lastAccel.z);
        const trust = accelStable ? ACCEL_TRUST_STABLE : ACCEL_TRUST_MOVING;
        // fusion: fused = (1-trust)*orientation + trust*accelAngle, mas com cuidado com wrap-around => usa angleDiff para alpha-like
        // Para gamma/beta (faixa limitada), usar lerp direto
        const fusedGamma = lerp(gamma, a.gamma, trust);
        const fusedBeta = lerp(beta, a.beta, trust);
        // alpha: não obrigado pelo accel (mantemos original)
        gamma = fusedGamma;
        beta = fusedBeta;
    }

    // Atualizar dados dos sensores na UI
    updateSensorData(gamma, beta, alpha);

    // Calcular posição do cursor com os valores (possivelmente fundidos)
    const position = pointerSystem.calculateAbsolutePosition(gamma, beta, alpha);

    // Atualizar crosshair visual
    updateCrosshair(position.x, position.y);

    // Enviar para servidor (throttled)
    const now = Date.now();
    if (now - lastSendTime >= SEND_INTERVAL) {
        sendPositionToServer(position.x, position.y);
        lastSendTime = now;
    }

    // FPS
    const fps = pointerSystem.updateFPS();
    if (fps !== null) {
        const fpsCounter = document.getElementById('fpsCounter');
        if (fpsCounter) fpsCounter.textContent = fps;
    }
}

// ===== Resto do UI / WebSocket (mantido) =====
// As funções connectWebSocket, toggleSensors, startSensors, stopSensors, setupOrientationListener, updateUI, toggleConfig, updateSensorData,
// updateCrosshair, sendPositionToServer, leftClick, rightClick, startAdvancedCalibration, confirmStep, resetCalibration, setupEventListeners,
// showNotification, etc., permanecem com a mesma lógica anterior, mas agora considerando o useAccelerometer e os listeners de motion.

// Exemplo: startSensors agora configura também o listener de devicemotion se useAccelerometer true.
function startSensors() {
    if (typeof DeviceOrientationEvent === 'undefined') {
        alert('Seu navegador não suporta a API de orientação do dispositivo.');
        return;
    }

    // Request permission para DeviceOrientation (iOS)
    const requestOrientationPermission = () => {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            return DeviceOrientationEvent.requestPermission().catch(() => {}).then(p => p);
        }
        return Promise.resolve('granted');
    };

    requestOrientationPermission().then(permissionState => {
        if (permissionState === 'granted' || permissionState === undefined) {
            setupOrientationListener();
            if (useAccelerometer) setupMotionListener();
            sensorsActive = true;
            updateUI();
        } else {
            alert('Permissão para sensores de movimento negada.');
        }
    }).catch(err => {
        console.warn('Erro pedindo permissão de orientação:', err);
        // tentar mesmo assim
        setupOrientationListener();
        if (useAccelerometer) setupMotionListener();
        sensorsActive = true;
        updateUI();
    });
}

function stopSensors() {
    window.removeEventListener('deviceorientation', handleOrientation);
    teardownMotionListener();
    sensorsActive = false;
    updateUI();
}

function setupOrientationListener() {
    window.addEventListener('deviceorientation', handleOrientation);
}

// Função de configuração dos event listeners (inclui toggle do acelerômetro)
function setupEventListeners() {
    const sensitivitySlider = document.getElementById('sensitivity');
    if (sensitivitySlider) {
        sensitivitySlider.addEventListener('input', function() {
            const value = parseInt(this.value);
            const sensitivityValue = document.getElementById('sensitivityValue');
            if (sensitivityValue) sensitivityValue.textContent = value;
            pointerSystem.setSensitivity(value);
        });
    }

    const smoothingSlider = document.getElementById('smoothingFactor');
    if (smoothingSlider) {
        smoothingSlider.addEventListener('input', function() {
            const value = parseInt(this.value);
            const smoothingValue = document.getElementById('smoothingValue');
            if (smoothingValue) smoothingValue.textContent = value;
            pointerSystem.setSmoothingFactor(value);
        });
    }

    const compensationSlider = document.getElementById('compensation');
    if (compensationSlider) {
        compensationSlider.addEventListener('input', function() {
            const value = parseInt(this.value);
            const compensationValue = document.getElementById('compensationValue');
            if (compensationValue) compensationValue.textContent = value;
            pointerSystem.setCompensation(value);
        });
    }

    const sensorFusionToggle = document.getElementById('sensorFusionToggle');
    if (sensorFusionToggle) {
        sensorFusionToggle.addEventListener('change', function() {
            pointerSystem.sensorFusion = this.checked;
            pointerSystem.saveSettings();
        });
    }

    const useAccelToggle = document.getElementById('useAccelerometerToggle');
    if (useAccelToggle) {
        useAccelToggle.checked = useAccelerometer;
        useAccelToggle.addEventListener('change', function() {
            useAccelerometer = this.checked;
            if (useAccelerometer && sensorsActive) setupMotionListener();
            if (!useAccelerometer) teardownMotionListener();
        });
    }
}

// Inicialização principal (DOMContentLoaded)
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();

    // Inicializar visualizador (a função já está no threejs-visualizer.js)
    setTimeout(() => {
        initialize3DVisualizer();
        window.addEventListener('resize', function() {
            if (window.threeJSVisualizer && typeof window.threeJSVisualizer.onWindowResize === 'function') {
                window.threeJSVisualizer.onWindowResize();
            }
        });
    }, 500);
});

// Exportar funções globais usadas pelo HTML
window.toggleConfig = function() { configPanel.classList.toggle('open'); overlay.classList.toggle('active'); };
window.toggleWebSocket = function() { /* implementação existente */ };
window.toggleSensors = function() { if (!sensorsActive) startSensors(); else stopSensors(); };
window.leftClick = function() { /* envio de clique */ };
window.rightClick = function() { /* envio de clique */ };
window.startAdvancedCalibration = function() { pointerSystem.startAdvancedCalibration(); };
window.confirmStep = function(step) { pointerSystem.confirmStep(step); };
window.resetCalibration = function() { /* reset conforme anterior */ };

console.log('✅ AimPointer (com acelerômetro opcional) carregado com sucesso!');