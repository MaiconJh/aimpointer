// static/js/app.js
// SISTEMA PRINCIPAL DO AIMPOINTER - VERSÃO COMPLETA COM VISUALIZADOR 3D CORRIGIDO

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
            // Inicializar o visualizador Three.js
            if (typeof safeInitializeThreeJS === 'function') {
                safeInitializeThreeJS();
            } else if (window.threeJSVisualizer) {
                // Já está inicializado
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
    
    // Verificar elementos DOM
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
    
    // Verificar Three.js e dependências
    console.log('Three.js disponível:', typeof THREE !== 'undefined');
    console.log('Visualizador global:', window.threeJSVisualizer);
    console.log('Função initializeThreeJS:', typeof initializeThreeJS);
    console.log('Função safeInitializeThreeJS:', typeof safeInitializeThreeJS);
}

// ===== SISTEMA DE CALIBRAÇÃO BASEADO NA POSIÇÃO INICIAL =====
class PositionBasedCalibrationSystem {
    constructor() {
        this.initialPosition = null;
        this.calibrationSteps = [
            {
                id: 1,
                title: "Posição Inicial",
                description: "Defina a posição inicial de referência",
                isInitialStep: true,
                completed: false
            },
            {
                id: 2,
                title: "Giro 90° Esquerda", 
                description: "Gire 90° para a esquerda em relação à posição inicial",
                targetOffset: { gamma: -90, beta: 0, alpha: 0 },
                tolerance: 25,
                completed: false
            },
            {
                id: 3,
                title: "Giro 90° Direita",
                description: "Gire 90° para a direita em relação à posição inicial", 
                targetOffset: { gamma: 90, beta: 0, alpha: 0 },
                tolerance: 25,
                completed: false
            },
            {
                id: 4,
                title: "Posição Final",
                description: "Volte para a posição inicial de referência",
                targetOffset: { gamma: 0, beta: 0, alpha: 0 },
                tolerance: 15,
                completed: false
            }
        ];
        
        this.currentStep = 0;
        this.isCalibrating = false;
        this.calibrationSamples = [];
        this.finalCalibration = { x: 0, y: 0, z: 0 };
    }

    startCalibration() {
        this.isCalibrating = true;
        this.currentStep = 0;
        this.initialPosition = null;
        this.calibrationSamples = [];
        this.updateUI();
        
        // Ativar modo de calibração no visualizador
        if (window.threeJSVisualizer) {
            window.threeJSVisualizer.setCalibrationMode(true, 0);
        }
    }

    confirmCurrentStep() {
        if (!this.isCalibrating || this.currentStep >= this.calibrationSteps.length) return;
        
        const currentStepData = this.calibrationSteps[this.currentStep];
        
        // Para o passo inicial, define a posição de referência
        if (currentStepData.isInitialStep && !this.initialPosition) {
            const recentSamples = this.getRecentSamples();
            if (recentSamples.length > 0) {
                this.initialPosition = this.calculateAverage(recentSamples);
                currentStepData.completed = true;
                this.currentStep++;
                
                // Define calibração instantaneamente
                this.finalCalibration = {
                    x: this.initialPosition.gamma,
                    y: this.initialPosition.beta,
                    z: this.initialPosition.alpha
                };
                
                // Aplica calibração imediatamente no sistema principal
                pointerSystem.calibration = this.finalCalibration;
                
                // Reseta o filtro para o centro
                pointerSystem.resetFilter();
                
                // Envia calibração para servidor
                if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({
                        type: 'calibrate',
                        orientation: this.finalCalibration
                    }));
                }
                
                this.updateUI();
                
                // Feedback visual
                showNotification('✅ Posição inicial definida! O sistema foi recalibrado.');
            }
            return;
        }
        
        // Para passos subsequentes, coleta amostras
        currentStepData.completed = true;
        const stepSamples = this.calibrationSamples.filter(sample => 
            sample.step === this.currentStep + 1
        );
        
        if (stepSamples.length > 0) {
            const avg = this.calculateAverage(stepSamples);
            
            // Calcula offset relativo à posição inicial
            if (this.initialPosition) {
                this.finalCalibration.x += (avg.gamma - this.initialPosition.gamma);
                this.finalCalibration.y += (avg.beta - this.initialPosition.beta); 
                this.finalCalibration.z += (avg.alpha - this.initialPosition.alpha);
            }
        }
        
        // Avança para próximo passo
        this.currentStep++;
        
        if (this.currentStep >= this.calibrationSteps.length) {
            this.finishCalibration();
        } else {
            this.updateUI();
        }
    }

    addCalibrationSample(gamma, beta, alpha) {
        if (!this.isCalibrating) return;
        
        this.calibrationSamples.push({
            step: this.currentStep + 1,
            gamma,
            beta, 
            alpha,
            timestamp: Date.now()
        });
        
        // Mantém apenas amostras recentes
        const twoSecondsAgo = Date.now() - 2000;
        this.calibrationSamples = this.calibrationSamples.filter(
            sample => sample.timestamp > twoSecondsAgo
        );
    }

    getRecentSamples() {
        const oneSecondAgo = Date.now() - 1000;
        return this.calibrationSamples.filter(
            sample => sample.timestamp > oneSecondAgo && sample.step === 1
        );
    }

    calculateAverage(samples) {
        const sum = samples.reduce((acc, sample) => {
            acc.gamma += sample.gamma;
            acc.beta += sample.beta;
            acc.alpha += sample.alpha;
            return acc;
        }, { gamma: 0, beta: 0, alpha: 0 });
        
        const count = samples.length;
        return {
            gamma: sum.gamma / count,
            beta: sum.beta / count,
            alpha: sum.alpha / count
        };
    }

    finishCalibration() {
        // Calcula calibração final baseada nos offsets
        const stepCount = this.calibrationSteps.length - 1; // Exclui passo inicial
        if (stepCount > 0) {
            this.finalCalibration.x /= stepCount;
            this.finalCalibration.y /= stepCount;
            this.finalCalibration.z /= stepCount;
        }
        
        this.isCalibrating = false;
        
        // Aplica calibração final
        pointerSystem.calibration = this.finalCalibration;
        
        // Desativa modo de calibração no visualizador
        if (window.threeJSVisualizer) {
            window.threeJSVisualizer.setCalibrationMode(false);
        }
        
        // Envia calibração para servidor
        if (window.socket && window.socket.readyState === WebSocket.OPEN) {
            window.socket.send(JSON.stringify({
                type: 'calibrate',
                orientation: this.finalCalibration
            }));
        }
        
        this.updateUI();
        showNotification('🎉 Calibração concluída com sucesso!');
    }

    getCurrentStep() {
        if (!this.isCalibrating || this.currentStep >= this.calibrationSteps.length) {
            return null;
        }
        return this.calibrationSteps[this.currentStep];
    }

    getTargetOrientation(currentGamma, currentBeta, currentAlpha) {
        const currentStep = this.getCurrentStep();
        if (!currentStep || !this.initialPosition || currentStep.isInitialStep) {
            return null;
        }
        
        return {
            gamma: this.initialPosition.gamma + (currentStep.targetOffset?.gamma || 0),
            beta: this.initialPosition.beta + (currentStep.targetOffset?.beta || 0),
            alpha: this.initialPosition.alpha + (currentStep.targetOffset?.alpha || 0)
        };
    }

    isAlignedWithTarget(gamma, beta, alpha) {
        const target = this.getTargetOrientation(gamma, beta, alpha);
        if (!target) return false;
        
        const currentStep = this.getCurrentStep();
        const diffGamma = Math.abs(gamma - target.gamma);
        const diffBeta = Math.abs(beta - target.beta);
        const diffAlpha = Math.abs(alpha - target.alpha);
        
        return diffGamma <= currentStep.tolerance && 
               diffBeta <= currentStep.tolerance && 
               diffAlpha <= currentStep.tolerance;
    }

    getProgress() {
        if (!this.isCalibrating) return 0;
        return (this.currentStep / this.calibrationSteps.length) * 100;
    }

    updateUI() {
        // Atualiza passos
        this.calibrationSteps.forEach((step, index) => {
            const element = document.getElementById(`step${step.id}`);
            if (element) {
                element.className = 'calibration-step';
                if (index === this.currentStep) {
                    element.classList.add('active');
                } else if (index < this.currentStep) {
                    element.classList.add('completed');
                }
            }
        });
        
        // Atualiza progresso
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        if (progressFill && progressText) {
            const progress = this.getProgress();
            progressFill.style.width = `${progress}%`;
            
            if (this.isCalibrating) {
                const currentStep = this.getCurrentStep();
                progressText.textContent = currentStep ? 
                    `Passo ${this.currentStep + 1} de ${this.calibrationSteps.length}: ${currentStep.description}` :
                    'Calibração em andamento...';
            } else {
                progressText.textContent = 'Pronto para começar';
            }
        }
        
        // Atualiza botão iniciar
        const startBtn = document.getElementById('startCalibrationBtn');
        if (startBtn) {
            startBtn.disabled = this.isCalibrating;
            startBtn.textContent = this.isCalibrating ? 'Calibrando...' : 'Iniciar Calibração';
        }
        
        // Atualiza informação da posição inicial
        const initialPositionInfo = document.getElementById('initialPositionInfo');
        if (initialPositionInfo) {
            if (this.initialPosition) {
                initialPositionInfo.innerHTML = '✅ Posição inicial definida: ' +
                    `${this.initialPosition.gamma.toFixed(1)}°, ` +
                    `${this.initialPosition.beta.toFixed(1)}°, ` +
                    `${this.initialPosition.alpha.toFixed(1)}°`;
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
        const deviceVisualizer = document.querySelector('.device-visualizer-3d');
        
        if (deviceVisualizer) {
            // Remove todas as classes de estado
            deviceVisualizer.classList.remove(
                'calibration-active', 
                'calibration-aligned', 
                'calibration-pulse',
                'loading',
                'error',
                'status-connected',
                'status-disconnected',
                'status-active'
            );
            
            // Atualizar visualizador Three.js se disponível
            if (window.threeJSVisualizer) {
                window.threeJSVisualizer.updateOrientation(alpha, beta, gamma);
                
                // Atualizar modo de calibração
                const currentStep = this.getCurrentStep();
                if (currentStep && this.isCalibrating) {
                    window.threeJSVisualizer.setCalibrationMode(true, this.currentStep);
                    deviceVisualizer.classList.add('calibration-active', 'calibration-pulse');
                    
                    const isAligned = this.isAlignedWithTarget(gamma, beta, alpha);
                    if (isAligned) {
                        deviceVisualizer.classList.add('calibration-aligned');
                    }
                    deviceVisualizer.classList.add('status-active');
                } else {
                    window.threeJSVisualizer.setCalibrationMode(false);
                    
                    // Adicionar classe de status baseado na conexão
                    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                        deviceVisualizer.classList.add('status-connected');
                    } else {
                        deviceVisualizer.classList.add('status-disconnected');
                    }
                }
            }
        }
        
        const orientationIndicator = document.getElementById('orientationIndicator');
        if (orientationIndicator) {
            orientationIndicator.textContent = 
                `X:${Math.round(gamma)}° Y:${Math.round(beta)}° Z:${Math.round(alpha)}°`;
        }
    }
}

// ===== SISTEMA DE CONTROLE PRINCIPAL =====
class AdvancedPointerSystem {
    constructor() {
        // Configurações locais - cada dispositivo tem suas próprias
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
        
        // Sistema de calibração baseado na posição inicial
        this.calibrationSystem = new PositionBasedCalibrationSystem();
        
        // Carregar configurações salvas
        this.loadSettings();
    }

    // Carregar configurações do localStorage
    loadSettings() {
        const saved = localStorage.getItem('aimpointer_settings');
        if (saved) {
            const settings = JSON.parse(saved);
            this.pointerSensitivity = settings.sensitivity || 60;
            this.smoothingFactor = (settings.smoothing || 75) / 100;
            this.compensation = settings.compensation || 2;
            this.sensorFusion = settings.sensor_fusion !== false;
            
            // Atualizar UI
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
        }
    }

    // Salvar configurações no localStorage
    saveSettings() {
        const settings = {
            sensitivity: this.pointerSensitivity,
            smoothing: Math.round(this.smoothingFactor * 100),
            compensation: this.compensation,
            sensor_fusion: this.sensorFusion
        };
        localStorage.setItem('aimpointer_settings', JSON.stringify(settings));
    }

    calculateAbsolutePosition(gamma, beta, alpha) {
        // Aplica calibração atual
        const calibratedGamma = gamma - this.calibration.x;
        const calibratedBeta = beta - this.calibration.y;
        const calibratedAlpha = alpha - this.calibration.z;
        
        // Atualiza visualização da calibração
        this.calibrationSystem.updateDeviceVisualization(gamma, beta, alpha);
        
        // Adiciona amostra se estiver calibrando
        if (this.calibrationSystem.isCalibrating) {
            this.calibrationSystem.addCalibrationSample(gamma, beta, alpha);
        }
        
        if (this.sensorFusion) {
            return this.calculateWithSensorFusion(calibratedGamma, calibratedBeta, calibratedAlpha);
        } else {
            return this.calculateSimple(calibratedGamma, calibratedBeta);
        }
    }

    calculateSimple(calibratedGamma, calibratedBeta) {
        const relX = calibratedGamma / (this.pointerSensitivity / 2);
        const relY = -calibratedBeta / (this.pointerSensitivity / 2);
        
        let absX = (relX * (this.screenWidth / 2)) + (this.screenWidth / 2);
        let absY = (relY * (this.screenHeight / 2)) + (this.screenHeight / 2);
        
        absX = Math.max(0, Math.min(this.screenWidth - 1, absX));
        absY = Math.max(0, Math.min(this.screenHeight - 1, absY));
        
        this.filteredPosition.x = this.smoothingFactor * this.filteredPosition.x + (1 - this.smoothingFactor) * absX;
        this.filteredPosition.y = this.smoothingFactor * this.filteredPosition.y + (1 - this.smoothingFactor) * absY;
        
        return { x: this.filteredPosition.x, y: this.filteredPosition.y };
    }

    calculateWithSensorFusion(calibratedGamma, calibratedBeta, calibratedAlpha) {
        const radAlpha = calibratedAlpha * Math.PI / 180;
        const cosA = Math.cos(radAlpha);
        const sinA = Math.sin(radAlpha);
        
        const compensatedGamma = calibratedGamma * cosA - calibratedBeta * sinA;
        const compensatedBeta = calibratedGamma * sinA + calibratedBeta * cosA;
        
        const compensationFactor = 1 + (this.compensation * 0.1);
        const adjGamma = compensatedGamma * compensationFactor;
        const adjBeta = compensatedBeta * compensationFactor;
        
        const relX = adjGamma / (this.pointerSensitivity / 2);
        const relY = -adjBeta / (this.pointerSensitivity / 2);
        
        let absX = (relX * (this.screenWidth / 2)) + (this.screenWidth / 2);
        let absY = (relY * (this.screenHeight / 2)) + (this.screenHeight / 2);
        
        absX = Math.max(0, Math.min(this.screenWidth - 1, absX));
        absY = Math.max(0, Math.min(this.screenHeight - 1, absY));
        
        this.filteredPosition.x = this.smoothingFactor * this.filteredPosition.x + (1 - this.smoothingFactor) * absX;
        this.filteredPosition.y = this.smoothingFactor * this.filteredPosition.y + (1 - this.smoothingFactor) * absY;
        
        return { x: this.filteredPosition.x, y: this.filteredPosition.y };
    }

    startAdvancedCalibration() {
        this.calibrationSystem.startCalibration();
    }

    confirmStep(stepNumber) {
        if (this.calibrationSystem.isCalibrating && 
            this.calibrationSystem.currentStep === stepNumber - 1) {
            this.calibrationSystem.confirmCurrentStep();
        }
    }

    setScreenResolution(width, height) {
        this.screenWidth = width;
        this.screenHeight = height;
        this.filteredPosition = { x: width / 2, y: height / 2 };
    }

    setSensitivity(value) {
        this.pointerSensitivity = value;
        this.saveSettings();
    }

    setSmoothingFactor(value) {
        this.smoothingFactor = value / 100;
        this.saveSettings();
    }

    setCompensation(value) {
        this.compensation = value;
        this.saveSettings();
    }

    resetFilter() {
        this.filteredPosition = { x: this.screenWidth / 2, y: this.screenHeight / 2 };
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
    
    // Atualiza dispositivo atual
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
    
    // Fechar conexão existente se houver
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
            
            // Apenas processa informações essenciais
            if (data.calibration) {
                pointerSystem.calibration = data.calibration;
            }
            
            if (data.screen_width && data.screen_height) {
                pointerSystem.setScreenResolution(data.screen_width, data.screen_height);
                const resolutionInfo = document.getElementById('resolutionInfo');
                if (resolutionInfo) {
                    resolutionInfo.textContent = `${data.screen_width}x${data.screen_height}`;
                }
            }
            
            updateUI();
            
        } catch(err) {
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
    if (!sensorsActive) {
        startSensors();
    } else {
        stopSensors();
    }
}

function startSensors() {
    if (typeof DeviceOrientationEvent === 'undefined') {
        alert('Seu navegador não suporta a API de orientação do dispositivo.');
        return;
    }
    
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ precisa de permissão
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
        // Navegadores que não precisam de permissão
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
    const gamma = event.gamma;  // Inclinação esquerda-direita (-90 a 90)
    const beta = event.beta;    // Inclinação frente-trás (-180 a 180)
    const alpha = event.alpha;  // Orientação (0 a 360)
    
    // Atualizar dados dos sensores na UI
    updateSensorData(gamma, beta, alpha);
    
    // Calcular posição do cursor
    const position = pointerSystem.calculateAbsolutePosition(gamma, beta, alpha);
    
    // Atualizar crosshair visual
    updateCrosshair(position.x, position.y);
    
    // Enviar para servidor (com throttling)
    const now = Date.now();
    if (now - lastSendTime >= SEND_INTERVAL) {
        sendPositionToServer(position.x, position.y);
        lastSendTime = now;
    }
    
    // Atualizar FPS
    const fps = pointerSystem.updateFPS();
    if (fps !== null) {
        const fpsCounter = document.getElementById('fpsCounter');
        if (fpsCounter) {
            fpsCounter.textContent = fps;
        }
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
        socket.send(JSON.stringify({
            type: 'click',
            button: 'left'
        }));
    }
}

function rightClick() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'click',
            button: 'right'
        }));
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
        socket.send(JSON.stringify({
            type: 'reset_calibration'
        }));
    }
    
    pointerSystem.calibration = { x: 0, y: 0, z: 0 };
    pointerSystem.calibrationSystem.initialPosition = null;
    pointerSystem.calibrationSystem.isCalibrating = false;
    pointerSystem.calibrationSystem.currentStep = 0;
    pointerSystem.calibrationSystem.calibrationSteps.forEach(step => step.completed = false);
    pointerSystem.calibrationSystem.updateUI();
    
    // Resetar visualizador
    if (window.threeJSVisualizer) {
        window.threeJSVisualizer.setCalibrationMode(false);
    }
    
    showNotification('🔃 Calibração resetada!');
}

// ===== CONFIGURAÇÕES DE CONTROLE =====
function setupEventListeners() {
    // Sensibilidade
    const sensitivitySlider = document.getElementById('sensitivity');
    if (sensitivitySlider) {
        sensitivitySlider.addEventListener('input', function() {
            const value = parseInt(this.value);
            const sensitivityValue = document.getElementById('sensitivityValue');
            if (sensitivityValue) sensitivityValue.textContent = value;
            pointerSystem.setSensitivity(value);
        });
    }
    
    // Suavização
    const smoothingSlider = document.getElementById('smoothingFactor');
    if (smoothingSlider) {
        smoothingSlider.addEventListener('input', function() {
            const value = parseInt(this.value);
            const smoothingValue = document.getElementById('smoothingValue');
            if (smoothingValue) smoothingValue.textContent = value;
            pointerSystem.setSmoothingFactor(value);
        });
    }
    
    // Compensação
    const compensationSlider = document.getElementById('compensation');
    if (compensationSlider) {
        compensationSlider.addEventListener('input', function() {
            const value = parseInt(this.value);
            const compensationValue = document.getElementById('compensationValue');
            if (compensationValue) compensationValue.textContent = value;
            pointerSystem.setCompensation(value);
        });
    }
    
    // Fusão de sensores
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
    // Implementação simples de notificação - pode ser melhorada com um sistema de toasts
    console.log('💬 ' + message);
    
    // Criar um elemento de notificação temporário
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
    
    // Remover após 3 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// ===== INICIALIZAÇÃO PRINCIPAL =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 DOM carregado, inicializando AimPointer...');
    
    // Configurar event listeners
    setupEventListeners();
    
    // Pequeno delay para garantir que tudo esteja carregado
    setTimeout(() => {
        initialize3DVisualizer();
        
        // Re-inicializar quando abrir o painel de configurações
        const configButton = document.querySelector('.config-header-btn');
        if (configButton) {
            configButton.addEventListener('click', function() {
                console.log('⚙️ Painel de configurações aberto - reinicializando visualizador 3D');
                setTimeout(initialize3DVisualizer, 300);
                
                // Executar diagnóstico se segurar Shift
                setTimeout(() => {
                    if (window.event && window.event.shiftKey) {
                        diagnose3DProblem();
                    }
                }, 500);
            });
        }
        
        // Também inicializar quando a janela for redimensionada
        window.addEventListener('resize', function() {
            if (window.threeJSVisualizer && typeof window.threeJSVisualizer.onWindowResize === 'function') {
                window.threeJSVisualizer.onWindowResize();
            }
        });
        
    }, 1000);
});

// Tornar funções globais para acesso via HTML
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