// static/js/app.js
// SISTEMA PRINCIPAL DO AIMPOINTER - VERSÃO COM CALIBRAÇÃO REESCRITA E MAIS ROBUSTA

// ===== UTILITÁRIAS PARA ÂNGULOS =====
function normalizeAngle(angle) {
    // Normaliza qualquer ângulo para [0, 360)
    let a = angle % 360;
    if (a < 0) a += 360;
    return a;
}

function angleDiff(a, b) {
    // Retorna a menor diferença assinada entre a e b em graus no intervalo (-180, 180]
    // funciona para ângulos em 0..360 ou -180..180
    const na = normalizeAngle(a);
    const nb = normalizeAngle(b);
    let diff = na - nb;
    if (diff > 180) diff -= 360;
    if (diff <= -180) diff += 360;
    return diff;
}

// ===== INICIALIZAÇÃO DO VISUALIZADOR 3D =====
function initialize3DVisualizer() {
    console.log('🎯 Inicializando visualizador 3D...');

    const visualizerContainer = document.getElementById('deviceVisualizer');
    const threejsContainer = document.getElementById('threejs-container');

    if (!visualizerContainer || !threejsContainer) {
        console.error('❌ Containers do visualizador 3D não encontrados!');
        return;
    }

    // Adicionar classe de loading
    visualizerContainer.classList.add('loading');

    // Verificar se Three.js está disponível
    if (typeof THREE === 'undefined') {
        console.error('❌ Three.js não foi carregado!');
        visualizerContainer.classList.remove('loading');
        visualizerContainer.classList.add('error');
        return;
    }

    // Pequeno delay para garantir que o DOM esteja pronto
    setTimeout(() => {
        try {
            if (typeof safeInitializeThreeJS === 'function') {
                safeInitializeThreeJS();
            } else if (window.threeJSVisualizer) {
                visualizerContainer.classList.remove('loading');
                console.log('✅ Visualizador 3D já inicializado');
            } else {
                console.error('❌ Função safeInitializeThreeJS não encontrada!');
                visualizerContainer.classList.remove('loading');
                visualizerContainer.classList.add('error');
            }
        } catch (error) {
            console.error('❌ Erro ao inicializar visualizador 3D:', error);
            visualizerContainer.classList.remove('loading');
            visualizerContainer.classList.add('error');
        }
    }, 500);
}

// ===== DIAGNÓSTICO DO VISUALIZADOR 3D =====
function diagnose3DProblem() {
    console.log('=== 🔍 DIAGNÓSTICO DO VISUALIZADOR 3D ===');

    const elements = {
        'deviceVisualizer': document.getElementById('deviceVisualizer'),
        'threejs-container': document.getElementById('threejs-container'),
        'orientationIndicator': document.getElementById('orientationIndicator')
    };

    for (const [name, element] of Object.entries(elements)) {
        if (element) {
            console.log(`✅ ${name}: encontrado`, element);
            console.log(`   - Display: ${window.getComputedStyle(element).display}`);
            console.log(`   - Visibility: ${window.getComputedStyle(element).visibility}`);
            console.log(`   - Opacity: ${window.getComputedStyle(element).opacity}`);
            console.log(`   - Width: ${element.offsetWidth}px, Height: ${element.offsetHeight}px`);
        } else {
            console.error(`❌ ${name}: NÃO encontrado`);
        }
    }

    console.log('Three.js disponível:', typeof THREE !== 'undefined');
    console.log('Visualizador global:', window.threeJSVisualizer);
    console.log('Função initializeThreeJS:', typeof initializeThreeJS);
    console.log('Função safeInitializeThreeJS:', typeof safeInitializeThreeJS);
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
        // baseline guarda a orientação de referência (gamma,beta,alpha)
        this.baseline = null;
        this.samplesWindowMs = 1000; // janela para média de amostras na definição
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
        // mantém a janela temporal
        const cutoff = Date.now() - this.samplesWindowMs;
        this.initialSamples = this.initialSamples.filter(s => s.t >= cutoff);
    }

    getAverageRecentSamples(stepId=1) {
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

        // Passo inicial: definimos baseline como média das amostras recentes
        if (step.isInitialStep) {
            const avg = this.getAverageRecentSamples(1);
            if (avg) {
                this.baseline = { gamma: avg.gamma, beta: avg.beta, alpha: avg.alpha };
                this.calibrationSteps[this.currentStep].completed = true;
                // aplicar baseline no sistema principal
                pointerSystem.calibration = { x: this.baseline.gamma, y: this.baseline.beta, z: this.baseline.alpha };
                pointerSystem.resetFilter();
                // enviar ao servidor
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

        // Para passos seguintes apenas validamos alinhamento com target (feedback)
        const recent = this.getAverageRecentSamples(this.currentStep + 1);
        if (!recent) {
            showNotification('⚠️ Não há amostras suficientes para este passo. Mova até o alvo e confirme.');
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
        // já definimos baseline no passo 1; aqui apenas damos feedback
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
                // verificar alinhamento para feedback visual
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
        this.smoothingFactor = 0.75; // como 0..1 (quanto maior, mais suave)
        this.compensation = 2;
        this.sensorFusion = true;
        // calibration agora guarda baseline: { x: gamma, y: beta, z: alpha }
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

    // Função central: converte orientação direta do dispositivo para posição absoluta
    calculateAbsolutePosition(gamma, beta, alpha) {
        // Se não houver baseline definida, usar current como baseline (ou manter zero)
        const baselineGamma = (this.calibration && typeof this.calibration.x === 'number') ? this.calibration.x : 0;
        const baselineBeta = (this.calibration && typeof this.calibration.y === 'number') ? this.calibration.y : 0;
        const baselineAlpha = (this.calibration && typeof this.calibration.z === 'number') ? this.calibration.z : 0;

        // Atualiza visualizador e coleta amostras de calibração se necessário
        this.calibrationSystem.updateDeviceVisualization(gamma, beta, alpha);
        if (this.calibrationSystem.isCalibrating) {
            this.calibrationSystem.addCalibrationSample(gamma, beta, alpha);
        }

        // Delta angular (diferença mínima assinada)
        const deltaGamma = angleDiff(gamma, baselineGamma); // left-right
        const deltaBeta = angleDiff(beta, baselineBeta);    // front-back
        const deltaAlpha = angleDiff(alpha, baselineAlpha); // rotation

        // Limitar os deltas para evitar números extremos
        // Assumimos que gamma normalmente está dentro de [-90, 90] e beta [-180,180]
        const maxGamma = 90;
        const maxBeta = 180;
        const clampedGamma = Math.max(-maxGamma, Math.min(maxGamma, deltaGamma));
        const clampedBeta = Math.max(-maxBeta, Math.min(maxBeta, deltaBeta));

        // Mapear ângulos para posições relativas:
        // pointerSensitivity define quantos graus cobrem a tela inteira.
        // Portanto metade da sensibilidade corresponde a deslocamento até a borda.
        const halfSens = this.pointerSensitivity / 2;
        let relX = clampedGamma / halfSens; // -1 .. 1 (aprox)
        let relY = -clampedBeta / halfSens; // invertido para que inclinar pra frente diminua Y, por exemplo

        // Se sensor fusion ativo, aplicar rotação por alpha (compensação)
        if (this.sensorFusion) {
            const radA = (deltaAlpha) * Math.PI / 180;
            const cosA = Math.cos(radA);
            const sinA = Math.sin(radA);
            const compFactor = 1 + (this.compensation * 0.05); // leve ajuste
            // rotaciona o vetor (relX, relY)
            const rx = relX * cosA - relY * sinA;
            const ry = relX * sinA + relY * cosA;
            relX = rx * compFactor;
            relY = ry * compFactor;
        }

        // Clamp final dos relativos para evitar extrapolação
        relX = Math.max(-1, Math.min(1, relX));
        relY = Math.max(-1, Math.min(1, relY));

        // Converte para absolute screen coords
        let absX = (relX * (this.screenWidth / 2)) + (this.screenWidth / 2);
        let absY = (relY * (this.screenHeight / 2)) + (this.screenHeight / 2);

        // Aplicar suavização (filtro exponencial simples)
        this.filteredPosition.x = this.smoothingFactor * this.filteredPosition.x + (1 - this.smoothingFactor) * absX;
        this.filteredPosition.y = this.smoothingFactor * this.filteredPosition.y + (1 - this.smoothingFactor) * absY;

        // Garantir dentro de tela
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

    startAdvancedCalibration() {
        this.calibrationSystem.startCalibration();
    }

    confirmStep(stepNumber) {
        this.calibrationSystem.confirmCurrentStep();
    }
}

// ===== VARIÁVEIS GLOBAIS =====
const pointerSystem = new AdvancedPointerSystem();
let socket = null;
let sensorsActive = false;
let lastSendTime = 0;
const SEND_INTERVAL = 16;

// Elementos da UI
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const crosshair = document.getElementById('crosshair');
const connectBtn = document.getElementById('connectBtn');
const sensorBtn = document.getElementById('sensorBtn');
const configPanel = document.getElementById('configPanel');
const overlay = document.getElementById('overlay');

// ===== FUNÇÕES DE CONTROLE DA UI =====
function updateUI() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        statusDot.className = sensorsActive ? 'status-dot sensors-active' : 'status-dot connected';
        statusText.textContent = sensorsActive ? 'Ativo' : 'Conectado';
        connectBtn.textContent = 'Desconectar WebSocket';
        connectBtn.classList.add('connected');
    } else {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Desconectado';
        connectBtn.textContent = 'Conectar WebSocket';
        connectBtn.classList.remove('connected');
    }

    sensorBtn.textContent = sensorsActive ?
        'Desativar Sensores' : 'Ativar Sensores';
    sensorBtn.classList.toggle('active', sensorsActive);

    const thisDeviceDot = document.getElementById('thisDeviceDot');
    if (thisDeviceDot) {
        thisDeviceDot.style.background =
            (socket && socket.readyState === WebSocket.OPEN) ? 'var(--success)' : 'var(--error)';
    }
}

function toggleConfig() {
    configPanel.classList.toggle('open');
    overlay.classList.toggle('active');
}

function toggleWebSocket() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
        sensorsActive = false;
        updateUI();
    } else {
        connectWebSocket();
    }
}

function connectWebSocket() {
    const ip = document.getElementById('serverIp').value.trim();
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
    };

    socket.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            if (data.calibration) {
                pointerSystem.calibration = data.calibration;
                // também atualizar baseline na sub-sistema de calibração
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
            console.error('Erro ao processar mensagem:', err);
        }
    };

    socket.onclose = () => {
        console.log('WebSocket desconectado');
        sensorsActive = false;
        updateUI();
    };

    socket.onerror = (error) => {
        console.error('Erro WebSocket:', error);
        alert('Erro ao conectar com o servidor. Verifique o IP e se o servidor está rodando.');
    };
}

function toggleSensors() {
    if (!sensorsActive) startSensors();
    else stopSensors();
}

function startSensors() {
    if (typeof DeviceOrientationEvent === 'undefined') {
        alert('Seu navegador não suporta a API de orientação do dispositivo.');
        return;
    }

    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    setupOrientationListener();
                    sensorsActive = true;
                    updateUI();
                } else {
                    alert('Permissão para sensores de movimento negada.');
                }
            })
            .catch(console.error);
    } else {
        setupOrientationListener();
        sensorsActive = true;
        updateUI();
    }
}

function stopSensors() {
    window.removeEventListener('deviceorientation', handleOrientation);
    sensorsActive = false;
    updateUI();
}

function setupOrientationListener() {
    window.addEventListener('deviceorientation', handleOrientation);
}

function handleOrientation(event) {
    const gamma = (typeof event.gamma === 'number') ? event.gamma : 0;
    const beta = (typeof event.beta === 'number') ? event.beta : 0;
    const alpha = (typeof event.alpha === 'number') ? event.alpha : 0;

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

// ===== CONFIGURAÇÕES DE CONTROLE =====
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
}

// ===== FUNÇÕES AUXILIARES =====
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

// ===== INICIALIZAÇÃO PRINCIPAL =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 DOM carregado, inicializando AimPointer...');

    setupEventListeners();

    setTimeout(() => {
        initialize3DVisualizer();

        const configButton = document.querySelector('.config-header-btn');
        if (configButton) {
            configButton.addEventListener('click', function() {
                console.log('⚙️ Painel de configurações aberto - reinicializando visualizador 3D');
                setTimeout(initialize3DVisualizer, 300);
                setTimeout(() => {
                    if (window.event && window.event.shiftKey) diagnose3DProblem();
                }, 500);
            });
        }

        window.addEventListener('resize', function() {
            if (window.threeJSVisualizer && typeof window.threeJSVisualizer.onWindowResize === 'function') {
                window.threeJSVisualizer.onWindowResize();
            }
        });
    }, 1000);
});

window.toggleConfig = toggleConfig;
window.toggleWebSocket = toggleWebSocket;
window.toggleSensors = toggleSensors;
window.leftClick = leftClick;
window.rightClick = rightClick;
window.startAdvancedCalibration = startAdvancedCalibration;
window.confirmStep = confirmStep;
window.resetCalibration = resetCalibration;
window.diagnose3DProblem = diagnose3DProblem;

console.log('✅ AimPointer carregado com sucesso!');