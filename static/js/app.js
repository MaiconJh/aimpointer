﻿// static/js/app.js
// AIMPOINTER - Arquivo completo com calibração reescrita, fusão com acelerômetro e visualizador 3D
// Substitua o arquivo existente por este conteúdo.

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

// ===== toggleConfig robusto (função global usada pelo HTML) =====
function toggleConfig() {
    const panel = document.getElementById('configPanel');
    const ov = document.getElementById('overlay');

    if (!panel || !ov) {
        console.warn('toggleConfig: elementos configPanel/overlay não encontrados', { panel, ov });
        return;
    }

    // Forçar reflow antes da troca de classe (ajuda em alguns navegadores)
    panel.getBoundingClientRect();

    panel.classList.toggle('open');
    ov.classList.toggle('active');

    console.log(`toggleConfig: painel agora ${panel.classList.contains('open') ? 'aberto' : 'fechado'}`);

    // Acessibilidade: foco
    if (panel.classList.contains('open')) {
        const closeBtn = panel.querySelector('.close-config');
        if (closeBtn) closeBtn.focus();
    } else {
        const cfgBtn = document.querySelector('.config-header-btn');
        if (cfgBtn) cfgBtn.focus();
    }
}

// ===== VISUALIZADOR 3D - invocado da threejs-visualizer.js =====
function initialize3DVisualizer() {
    if (typeof safeInitializeThreeJS === 'function') {
        safeInitializeThreeJS();
    } else {
        console.warn('safeInitializeThreeJS não disponível - verifique threejs-visualizer.js');
    }
}

// ===== SISTEMA DE CALIBRAÇÃO (REESCRITO) =====
class PositionBasedCalibrationSystem {
    constructor() {
        this.initialSamples = [];
        this.isCalibrating = false;
        this.currentStep = 0;
        this.calibrationSteps = [
            { id: 1, title: "Posição Inicial", isInitialStep: true, completed: false, description: "Defina a posição inicial de referência" },
            { id: 2, title: "Giro 90° Esquerda", targetOffset: { gamma: -90, beta: 0, alpha: 0 }, tolerance: 25, completed: false },
            { id: 3, title: "Giro 90° Direita", targetOffset: { gamma: 90, beta: 0, alpha: 0 }, tolerance: 25, completed: false },
            { id: 4, title: "Voltar para Inicial", targetOffset: { gamma: 0, beta: 0, alpha: 0 }, tolerance: 15, completed: false }
        ];
        this.baseline = null; // { gamma, beta, alpha }
        this.samplesWindowMs = 1000;
    }

    startCalibration() {
        this.isCalibrating = true;
        this.currentStep = 0;
        this.initialSamples = [];
        this.calibrationSteps.forEach(s => s.completed = false);
        this.updateUI();
        if (window.threeJSVisualizer) window.threeJSVisualizer.setCalibrationMode(true, 0);
    }

    addCalibrationSample(gamma, beta, alpha) {
        if (!this.isCalibrating) return;
        this.initialSamples.push({ gamma, beta, alpha, t: Date.now(), step: this.currentStep + 1 });
        const cutoff = Date.now() - this.samplesWindowMs;
        this.initialSamples = this.initialSamples.filter(s => s.t >= cutoff);
    }

    getAverageRecentSamples(stepId = 1) {
        const cutoff = Date.now() - this.samplesWindowMs;
        const samples = this.initialSamples.filter(s => s.t >= cutoff && s.step === stepId);
        if (!samples.length) return null;
        const sum = samples.reduce((acc, s) => {
            acc.gamma += s.gamma; acc.beta += s.beta; acc.alpha += s.alpha; return acc;
        }, { gamma: 0, beta: 0, alpha: 0 });
        const n = samples.length;
        return { gamma: sum.gamma / n, beta: sum.beta / n, alpha: sum.alpha / n };
    }

    confirmCurrentStep() {
        if (!this.isCalibrating) return;

        const step = this.calibrationSteps[this.currentStep];
        if (!step) return;

        if (step.isInitialStep) {
            const avg = this.getAverageRecentSamples(1);
            if (avg) {
                this.baseline = { gamma: avg.gamma, beta: avg.beta, alpha: avg.alpha };
                this.calibrationSteps[this.currentStep].completed = true;
                pointerSystem.calibration = { x: this.baseline.gamma, y: this.baseline.beta, z: this.baseline.alpha };
                pointerSystem.resetFilter();
                if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({ type: 'calibrate', orientation: pointerSystem.calibration }));
                }
                this.currentStep++;
                this.updateUI();
                showNotification('✅ Posição inicial definida e aplicada como baseline.');
            } else {
                showNotification('⚠️ Não há amostras suficientes. Mantenha o dispositivo estável e confirme novamente.');
            }
            return;
        }

        const recent = this.getAverageRecentSamples(this.currentStep + 1);
        if (!recent) {
            showNotification('⚠️ Não há amostras suficientes para este passo. Mova até o alvo e confirme.');
            return;
        }

        if (!this.baseline) {
            showNotification('⚠️ Baseline não definida. Confirme o passo 1 primeiro.');
            return;
        }

        const target = {
            gamma: this.baseline.gamma + (step.targetOffset?.gamma || 0),
            beta: this.baseline.beta + (step.targetOffset?.beta || 0),
            alpha: normalizeAngle(this.baseline.alpha + (step.targetOffset?.alpha || 0))
        };

        const diffGamma = Math.abs(angleDiff(recent.gamma, target.gamma));
        const diffBeta = Math.abs(angleDiff(recent.beta, target.beta));
        const diffAlpha = Math.abs(angleDiff(recent.alpha, target.alpha));

        if (diffGamma <= step.tolerance && diffBeta <= step.tolerance && diffAlpha <= step.tolerance) {
            this.calibrationSteps[this.currentStep].completed = true;
            this.currentStep++;
            this.updateUI();
            showNotification(`✅ Passo ${step.id} confirmado.`);
            if (this.currentStep >= this.calibrationSteps.length) {
                this.finishCalibration();
            }
        } else {
            showNotification(`⚠️ Alinhamento insuficiente. Diferenças: G:${diffGamma.toFixed(1)}°, B:${diffBeta.toFixed(1)}°, A:${diffAlpha.toFixed(1)}°. Ajuste e confirme novamente.`);
        }
    }

    finishCalibration() {
        this.isCalibrating = false;
        if (window.threeJSVisualizer) window.threeJSVisualizer.setCalibrationMode(false);
        this.updateUI();
        showNotification('🎉 Calibração concluída. Baseline aplicada.');
    }

    getCurrentStep() {
        if (!this.isCalibrating) return null;
        return this.calibrationSteps[this.currentStep] || null;
    }

    getProgress() {
        if (!this.isCalibrating) return 0;
        return (this.currentStep / this.calibrationSteps.length) * 100;
    }

    updateUI() {
        this.calibrationSteps.forEach((step, index) => {
            const el = document.getElementById(`step${step.id}`);
            if (!el) return;
            el.className = 'calibration-step';
            if (index === this.currentStep && this.isCalibrating) el.classList.add('active');
            if (step.completed) el.classList.add('completed');
        });

        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        if (progressFill && progressText) {
            const progress = this.getProgress();
            progressFill.style.width = `${progress}%`;
            if (this.isCalibrating) {
                const cs = this.getCurrentStep();
                progressText.textContent = cs ? `Passo ${this.currentStep + 1}: ${cs.description || cs.title}` : 'Calibrando...';
            } else {
                progressText.textContent = 'Pronto para começar';
            }
        }

        const initialPositionInfo = document.getElementById('initialPositionInfo');
        if (initialPositionInfo) {
            if (this.baseline) {
                initialPositionInfo.innerHTML = '✅ Posição inicial definida (baseline): ' +
                    `${this.baseline.gamma.toFixed(1)}°, ` +
                    `${this.baseline.beta.toFixed(1)}°, ` +
                    `${this.baseline.alpha.toFixed(1)}°`;
                initialPositionInfo.style.borderColor = 'var(--success)';
                initialPositionInfo.style.background = 'rgba(16, 185, 129, 0.1)';
            } else {
                initialPositionInfo.innerHTML = '⚠️ A posição inicial será usada como referência para toda a calibração';
                initialPositionInfo.style.borderColor = 'var(--border)';
                initialPositionInfo.style.background = 'var(--surface)';
            }
        }
    }

    updateDeviceVisualization(gamma, beta, alpha) {
        const dv = document.querySelector('.device-visualizer-3d');
        if (!dv) return;

        dv.classList.remove('calibration-active', 'calibration-aligned', 'calibration-pulse', 'loading', 'error', 'status-connected', 'status-disconnected', 'status-active');

        if (window.threeJSVisualizer) {
            window.threeJSVisualizer.updateOrientation(alpha, beta, gamma);

            const currentStep = this.getCurrentStep();
            if (currentStep && this.isCalibrating) {
                window.threeJSVisualizer.setCalibrationMode(true, this.currentStep);
                dv.classList.add('calibration-active', 'calibration-pulse');
                const target = currentStep.isInitialStep ? null : {
                    gamma: this.baseline ? this.baseline.gamma + (currentStep.targetOffset?.gamma || 0) : null,
                    beta: this.baseline ? this.baseline.beta + (currentStep.targetOffset?.beta || 0) : null,
                    alpha: this.baseline ? normalizeAngle(this.baseline.alpha + (currentStep.targetOffset?.alpha || 0)) : null
                };
                let isAligned = false;
                if (target && this.baseline) {
                    const dG = Math.abs(angleDiff(gamma, target.gamma));
                    const dB = Math.abs(angleDiff(beta, target.beta));
                    const dA = Math.abs(angleDiff(alpha, target.alpha));
                    isAligned = (dG <= currentStep.tolerance && dB <= currentStep.tolerance && dA <= currentStep.tolerance);
                }
                if (isAligned) dv.classList.add('calibration-aligned');
                dv.classList.add('status-active');
            } else {
                window.threeJSVisualizer.setCalibrationMode(false);
                if (window.socket && window.socket.readyState === WebSocket.OPEN) dv.classList.add('status-connected');
                else dv.classList.add('status-disconnected');
            }
        }

        const orientationIndicator = document.getElementById('orientationIndicator');
        if (orientationIndicator) {
            orientationIndicator.textContent =
                `X:${Math.round(gamma)}° Y:${Math.round(beta)}° Z:${Math.round(alpha)}°`;
        }
    }
}

// ===== SISTEMA DE CONTROLE PRINCIPAL (AJUSTADO) =====
class AdvancedPointerSystem {
    constructor() {
        this.pointerSensitivity = 60; // graus que cobrem a tela inteira
        this.smoothingFactor = 0.75; // 0..1 (quanto maior, mais suave)
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

    loadSettings() {
        const saved = localStorage.getItem('aimpointer_settings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                this.pointerSensitivity = settings.sensitivity || 60;
                this.smoothingFactor = ((settings.smoothing || 75) / 100);
                this.compensation = settings.compensation || 2;
                this.sensorFusion = settings.sensor_fusion !== false;

                if (document.getElementById('sensitivity')) {
                    document.getElementById('sensitivity').value = this.pointerSensitivity;
                    document.getElementById('sensitivityValue').textContent = this.pointerSensitivity;
                }
                if (document.getElementById('smoothingFactor')) {
                    document.getElementById('smoothingFactor').value = Math.round(this.smoothingFactor * 100);
                    document.getElementById('smoothingValue').textContent = Math.round(this.smoothingFactor * 100);
                }
                if (document.getElementById('compensation')) {
                    document.getElementById('compensation').value = this.compensation;
                    document.getElementById('compensationValue').textContent = this.compensation;
                }
                if (document.getElementById('sensorFusionToggle')) {
                    document.getElementById('sensorFusionToggle').checked = this.sensorFusion;
                }
            } catch (e) {
                console.warn('Falha ao carregar settings:', e);
            }
        }
    }

    saveSettings() {
        const settings = {
            sensitivity: this.pointerSensitivity,
            smoothing: Math.round(this.smoothingFactor * 100),
            compensation: this.compensation,
            sensor_fusion: this.sensorFusion
        };
        localStorage.setItem('aimpointer_settings', JSON.stringify(settings));
    }

    setScreenResolution(width, height) {
        this.screenWidth = width;
        this.screenHeight = height;
        this.filteredPosition = { x: width / 2, y: height / 2 };
    }

    resetFilter() {
        this.filteredPosition = { x: this.screenWidth / 2, y: this.screenHeight / 2 };
    }

    setSensitivity(v) {
        this.pointerSensitivity = v;
        this.saveSettings();
    }

    setSmoothingFactor(v) {
        this.smoothingFactor = v / 100;
        this.saveSettings();
    }

    setCompensation(v) {
        this.compensation = v;
        this.saveSettings();
    }

    startAdvancedCalibration() {
        this.calibrationSystem.startCalibration();
    }

    confirmStep(stepNumber) {
        this.calibrationSystem.confirmCurrentStep();
    }

    // Função central: converte orientação do dispositivo para posição absoluta
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

    updateFPS() {
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFpsUpdate >= 1000) {
            const fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;
            return fps;
        }
        return null;
    }

    calculateAccuracy(gamma, beta) {
        const stability = Math.abs(gamma) + Math.abs(beta);
        return Math.max(0, 100 - Math.min(stability, 50));
    }
}

// ===== VARIÁVEIS GLOBAIS =====
const pointerSystem = new AdvancedPointerSystem();
let socket = null;
let sensorsActive = false;
let lastSendTime = 0;
const SEND_INTERVAL = 16;

// ACELERÔMETRO / FUSÃO
let useAccelerometer = true;
let accelAvailable = false;
let lastAccel = { x: 0, y: 0, z: 0 };
let accelStable = false;
const GRAVITY = 9.81;
const ACCEL_STABLE_TOL = 1.6; // m/s^2
const ACCEL_TRUST_STABLE = 0.7;
const ACCEL_TRUST_MOVING = 0.2;

// Elementos da UI (serão buscados no DOMContentLoaded)
let statusDot, statusText, crosshair, connectBtnEl, sensorBtnEl, configPanelEl, overlayEl, accelerometerIndicator;

// ===== FUNÇÕES AUXILIARES E UI =====
function showNotification(message) {
    console.log('💬 ' + message);
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--primary);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentNode) notification.parentNode.removeChild(notification);
    }, 3000);
}

function updateUI() {
    if (!statusDot || !statusText || !connectBtnEl || !sensorBtnEl) return;

    if (socket && socket.readyState === WebSocket.OPEN) {
        statusDot.className = sensorsActive ? 'status-dot sensors-active' : 'status-dot connected';
        statusText.textContent = sensorsActive ? 'Ativo' : 'Conectado';
        connectBtnEl.textContent = 'Desconectar WebSocket';
        connectBtnEl.classList.add('connected');
    } else {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Desconectado';
        connectBtnEl.textContent = 'Conectar WebSocket';
        connectBtnEl.classList.remove('connected');
    }

    sensorBtnEl.textContent = sensorsActive ? 'Desativar Sensores' : 'Ativar Sensores';
    sensorBtnEl.classList.toggle('active', sensorsActive);

    const thisDeviceDot = document.getElementById('thisDeviceDot');
    if (thisDeviceDot) {
        thisDeviceDot.style.background =
            (socket && socket.readyState === WebSocket.OPEN) ? 'var(--success)' : 'var(--error)';
    }
}

// ===== WebSocket =====
function connectWebSocket() {
    const ipInput = document.getElementById('serverIp');
    if (!ipInput) return alert('Campo IP do servidor não encontrado');
    const ip = ipInput.value.trim();
    if (!ip) return alert('Digite o IP do servidor!');

    const wsUrl = `wss://${ip}:8765`;

    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }

    socket = new WebSocket(wsUrl);
    window.socket = socket;

    socket.onopen = () => {
        console.log('✅ WebSocket conectado com sucesso');
        updateUI();
        showNotification('🔗 Conectado ao servidor');
    };

    socket.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            if (data.calibration) {
                pointerSystem.calibration = data.calibration;
                if (pointerSystem.calibrationSystem) {
                    pointerSystem.calibrationSystem.baseline = {
                        gamma: data.calibration.x,
                        beta: data.calibration.y,
                        alpha: data.calibration.z
                    };
                }
            }

            if (data.screen_width && data.screen_height) {
                pointerSystem.setScreenResolution(data.screen_width, data.screen_height);
                const resolutionInfo = document.getElementById('resolutionInfo');
                if (resolutionInfo) resolutionInfo.textContent = `${data.screen_width}x${data.screen_height}`;
            }

            updateUI();
        } catch (err) {
            console.error('Erro ao processar mensagem WS:', err);
        }
    };

    socket.onclose = () => {
        console.log('WebSocket desconectado');
        sensorsActive = false;
        updateUI();
        showNotification('🔌 WebSocket desconectado');
    };

    socket.onerror = (error) => {
        console.error('Erro WebSocket:', error);
        showNotification('❌ Erro ao conectar com o servidor. Verifique o IP e se o servidor está rodando.');
    };
}

// ===== SENSORES: Orientation + Motion (Acelerômetro) =====
// Implementações robustas para permissões e listeners (evitam duplicação)
let _orientationListenerAdded = false;
let _motionListenerAdded = false;

function handleOrientationSafe(ev) {
    try {
        handleOrientation(ev);
    } catch (err) {
        console.error('Erro em handleOrientationSafe:', err);
    }
}

function setupOrientationListener() {
    if (_orientationListenerAdded) return;
    window.addEventListener('deviceorientation', handleOrientationSafe, { passive: true });
    _orientationListenerAdded = true;
    console.log('setupOrientationListener: adicionado');
}

function teardownOrientationListener() {
    if (!_orientationListenerAdded) return;
    window.removeEventListener('deviceorientation', handleOrientationSafe);
    _orientationListenerAdded = false;
    console.log('teardownOrientationListener: removido');
}

function handleMotionSafe(ev) {
    try {
        handleMotion(ev);
    } catch (err) {
        console.error('Erro em handleMotionSafe:', err);
    }
}

function setupMotionListener() {
    if (_motionListenerAdded) return;
    window.addEventListener('devicemotion', handleMotionSafe, { passive: true });
    _motionListenerAdded = true;
    console.log('setupMotionListener: adicionado');
}

function teardownMotionListener() {
    if (!_motionListenerAdded) return;
    window.removeEventListener('devicemotion', handleMotionSafe);
    _motionListenerAdded = false;
    console.log('teardownMotionListener: removido');
}

function handleMotion(ev) {
    const acc = ev.accelerationIncludingGravity || ev.acceleration || { x: 0, y: 0, z: 0 };
    const ax = acc.x || 0, ay = acc.y || 0, az = acc.z || 0;
    accelAvailable = true;
    lastAccel = { x: ax, y: ay, z: az };

    const mag = Math.sqrt(ax*ax + ay*ay + az*az);
    accelStable = Math.abs(mag - GRAVITY) < ACCEL_STABLE_TOL;

    if (accelerometerIndicator) {
        accelerometerIndicator.textContent = `Accel X:${ax.toFixed(2)} Y:${ay.toFixed(2)} Z:${az.toFixed(2)}`;
    }
}

function accelToAngles(ax, ay, az) {
    const roll = Math.atan2(ay, az) * 180 / Math.PI;
    const pitch = Math.atan2(-ax, Math.sqrt(ay*ay + az*az)) * 180 / Math.PI;
    return { gamma: roll, beta: pitch };
}

function handleOrientation(event) {
    let gamma = (typeof event.gamma === 'number') ? event.gamma : 0;
    let beta = (typeof event.beta === 'number') ? event.beta : 0;
    let alpha = (typeof event.alpha === 'number') ? event.alpha : 0;

    if (useAccelerometer && accelAvailable) {
        const a = accelToAngles(lastAccel.x, lastAccel.y, lastAccel.z);
        const trust = accelStable ? ACCEL_TRUST_STABLE : ACCEL_TRUST_MOVING;
        const fusedGamma = lerp(gamma, a.gamma, trust);
        const fusedBeta = lerp(beta, a.beta, trust);
        gamma = fusedGamma;
        beta = fusedBeta;
    }

    updateSensorData(gamma, beta, alpha);

    const position = pointerSystem.calculateAbsolutePosition(gamma, beta, alpha);

    updateCrosshair(position.x, position.y);

    const now = Date.now();
    if (now - lastSendTime >= SEND_INTERVAL) {
        sendPositionToServer(position.x, position.y);
        lastSendTime = now;
    }

    const fps = pointerSystem.updateFPS();
    if (fps !== null) {
        const fpsCounter = document.getElementById('fpsCounter');
        if (fpsCounter) fpsCounter.textContent = fps;
    }
}

// ===== Controles de sensores (assíncronos e robustos) =====
async function toggleSensorsAsync() {
    try {
        if (!sensorsActive) {
            await startSensorsAsync();
        } else {
            stopSensors();
        }
    } catch (err) {
        console.error('toggleSensorsAsync:', err);
    }
}

async function startSensorsAsync() {
    if (typeof DeviceOrientationEvent === 'undefined') {
        showNotification('⚠️ Seu navegador NÃO suporta DeviceOrientation.');
        throw new Error('DeviceOrientationEvent not supported');
    }

    try {
        // pedir permissão iOS para orientation
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const perm = await DeviceOrientationEvent.requestPermission();
                if (perm !== 'granted') {
                    showNotification('❌ Permissão para orientação negada.');
                    throw new Error('Permission denied for DeviceOrientationEvent');
                }
            } catch (errPerm) {
                console.warn('DeviceOrientationEvent.requestPermission error:', errPerm);
                throw errPerm;
            }
        }

        setupOrientationListener();

        if (useAccelerometer) {
            if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                try {
                    const mp = await DeviceMotionEvent.requestPermission();
                    if (mp === 'granted') {
                        setupMotionListener();
                    } else {
                        console.warn('Motion permission not granted:', mp);
                        showNotification('⚠️ Permissão para acelerômetro negada. A fusão ficará desativada.');
                        teardownMotionListener();
                    }
                } catch (errPermMotion) {
                    console.warn('DeviceMotionEvent.requestPermission error (trying fallback):', errPermMotion);
                    try { setupMotionListener(); } catch (e) { console.warn('setupMotionListener failed', e); }
                }
            } else {
                setupMotionListener();
            }
        } else {
            teardownMotionListener();
        }

        sensorsActive = true;
        updateUI();
        showNotification('📡 Sensores ativados');
        console.log('startSensorsAsync: sensores ativados (orientationListenerAdded=', _orientationListenerAdded, ', motionListenerAdded=', _motionListenerAdded, ')');
    } catch (err) {
        sensorsActive = false;
        updateUI();
        console.error('startSensorsAsync falhou:', err);
        throw err;
    }
}

function stopSensors() {
    teardownOrientationListener();
    teardownMotionListener();
    sensorsActive = false;
    updateUI();
    showNotification('🔕 Sensores desativados');
    console.log('stopSensors: sensores desativados');
}

// ===== UI Helpers =====
function updateSensorData(gamma, beta, alpha) {
    const directionX = document.getElementById('directionX');
    const directionY = document.getElementById('directionY');
    const directionZ = document.getElementById('directionZ');
    const accuracy = document.getElementById('accuracy');

    if (directionX) directionX.textContent = Math.round(gamma) + '°';
    if (directionY) directionY.textContent = Math.round(beta) + '°';
    if (directionZ) directionZ.textContent = Math.round(alpha) + '°';
    if (accuracy) accuracy.textContent = pointerSystem.calculateAccuracy(gamma, beta) + '%';
}

function updateCrosshair(x, y) {
    if (!crosshair) return;
    const pointerContainer = document.querySelector('.pointer-container');
    if (!pointerContainer) return;
    const containerRect = pointerContainer.getBoundingClientRect();
    const relativeX = (x / pointerSystem.screenWidth) * containerRect.width;
    const relativeY = (y / pointerSystem.screenHeight) * containerRect.height;
    crosshair.style.left = relativeX + 'px';
    crosshair.style.top = relativeY + 'px';
}

function sendPositionToServer(x, y) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'absolute_position',
            x: Math.round(x),
            y: Math.round(y)
        }));
    }
}

function leftClick() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'click', button: 'left' }));
    }
}

function rightClick() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'click', button: 'right' }));
    }
}

// ===== Calibração e reset =====
function startAdvancedCalibration() {
    pointerSystem.startAdvancedCalibration();
}

function confirmStep(stepNumber) {
    pointerSystem.confirmStep(stepNumber);
}

function resetCalibration() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'reset_calibration' }));
    }
    pointerSystem.calibration = { x: 0, y: 0, z: 0 };
    pointerSystem.calibrationSystem.baseline = null;
    pointerSystem.calibrationSystem.isCalibrating = false;
    pointerSystem.calibrationSystem.currentStep = 0;
    pointerSystem.calibrationSystem.calibrationSteps.forEach(step => step.completed = false);
    pointerSystem.calibrationSystem.updateUI();
    if (window.threeJSVisualizer) window.threeJSVisualizer.setCalibrationMode(false);
    showNotification('🔃 Calibração resetada!');
}

// ===== Event listeners de UI =====
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

// ===== Inicialização principal =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 DOM carregado, inicializando AimPointer...');

    // Capturar elementos da UI
    statusDot = document.getElementById('statusDot');
    statusText = document.getElementById('statusText');
    crosshair = document.getElementById('crosshair');
    connectBtnEl = document.getElementById('connectBtn');
    sensorBtnEl = document.getElementById('sensorBtn');
    configPanelEl = document.getElementById('configPanel');
    overlayEl = document.getElementById('overlay');
    accelerometerIndicator = document.getElementById('accelerometerIndicator');

    // Event handlers (garantir chamadas robustas)
    if (connectBtnEl) connectBtnEl.addEventListener('click', function(e){ e.preventDefault(); toggleWebSocket(); });
    if (sensorBtnEl) sensorBtnEl.addEventListener('click', function(e){ e.preventDefault(); window.toggleSensors(); });

    // overlay click handled by inline onclick in index.html as fallback; also attach here
    if (overlayEl) {
        overlayEl.removeEventListener('click', toggleConfig);
        overlayEl.addEventListener('click', toggleConfig);
    }

    // Botão config header: garantir listener por JS (não depender só do onclick inline)
    const cfgButtons = document.querySelectorAll('.config-header-btn');
    cfgButtons.forEach(btn => {
        btn.removeEventListener('click', toggleConfig);
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            toggleConfig();
            setTimeout(initialize3DVisualizer, 300);
        });
    });

    // close-config button
    const closeBtn = document.querySelector('.close-config');
    if (closeBtn) {
        closeBtn.removeEventListener('click', toggleConfig);
        closeBtn.addEventListener('click', toggleConfig);
    }

    setupEventListeners();

    // Inicializar visualizador 3D
    setTimeout(() => {
        initialize3DVisualizer();
        window.addEventListener('resize', function() {
            if (window.threeJSVisualizer && typeof window.threeJSVisualizer.onWindowResize === 'function') {
                window.threeJSVisualizer.onWindowResize();
            }
        });
    }, 500);

    updateUI();
    console.log('✅ AimPointer carregado com sucesso!');
});

// Tornar funções globais para acesso via HTML
window.toggleConfig = toggleConfig;
window.toggleWebSocket = function() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
        sensorsActive = false;
        updateUI();
    } else {
        connectWebSocket();
    }
};
// wrapper global chama a versão async segura
window.toggleSensors = function() {
    toggleSensorsAsync().catch(err => console.warn('toggleSensors global erro:', err));
};
window.leftClick = leftClick;
window.rightClick = rightClick;
window.startAdvancedCalibration = function() { pointerSystem.startAdvancedCalibration(); };
window.confirmStep = function(step) { pointerSystem.confirmStep(step); };
window.resetCalibration = resetCalibration;
window.diagnose3DProblem = function() {
    console.log('Diagnóstico: elementos e estado:');
    console.log('threeJSVisualizer:', window.threeJSVisualizer);
    console.log('accelAvailable:', accelAvailable, 'accelStable:', accelStable, 'lastAccel:', lastAccel);
    console.log('pointerSystem.calibrationSystem.baseline:', pointerSystem.calibrationSystem.baseline);
};