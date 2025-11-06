// static/js/threejs-visualizer.js

class ThreeJSVisualizer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.phone = null;
        this.screen = null;
        
        // Valores atuais de orientação
        this.alpha = 0;
        this.beta = 0;
        this.gamma = 0;
        
        // Valores suavizados
        this.smoothAlpha = 0;
        this.smoothBeta = 0;
        this.smoothGamma = 0;
        
        this.isCalibrating = false;
        this.calibrationStep = 0;
        
        this.init();
    }

    init() {
        const container = document.getElementById('threejs-container');
        if (!container) return;

        // Limpar container existente
        container.innerHTML = '';

        // Cena
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1e293b);

        // Câmera
        this.camera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 1000);
        this.camera.position.set(0, 0, 8);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(300, 200);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        // Luzes
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight);

        // Chão para sombra
        const groundGeometry = new THREE.PlaneGeometry(10, 10);
        const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.1 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Criar celular
        this.createPhone();

        // Iniciar animação
        this.animate();

        // Ajustar redimensionamento
        window.addEventListener('resize', () => this.onWindowResize());
    }

    createPhone() {
        // Corpo principal do celular
        const phoneGeometry = new THREE.BoxGeometry(1.2, 2.4, 0.12);
        const phoneMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d3748,
            metalness: 0.4,
            roughness: 0.3
        });
        
        this.phone = new THREE.Mesh(phoneGeometry, phoneMaterial);
        this.phone.castShadow = true;
        this.phone.receiveShadow = true;
        this.scene.add(this.phone);

        // Tela
        const screenGeometry = new THREE.PlaneGeometry(1.05, 2.1);
        const screenMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            emissive: 0x111111,
            metalness: 0.1,
            roughness: 0.8
        });
        
        this.screen = new THREE.Mesh(screenGeometry, screenMaterial);
        this.screen.position.z = 0.061;
        this.phone.add(this.screen);

        // Moldura da tela
        const bezelGeometry = new THREE.PlaneGeometry(1.1, 2.15);
        const bezelMaterial = new THREE.MeshBasicMaterial({
            color: 0x4a5568,
            side: THREE.DoubleSide
        });
        
        const bezel = new THREE.Mesh(bezelGeometry, bezelMaterial);
        bezel.position.z = 0.06;
        this.phone.add(bezel);

        // Câmera frontal
        const cameraGeometry = new THREE.CircleGeometry(0.03, 8);
        const cameraMaterial = new THREE.MeshBasicMaterial({ color: 0x1a202c });
        const frontCamera = new THREE.Mesh(cameraGeometry, cameraMaterial);
        frontCamera.position.set(0, 1.0, 0.062);
        this.phone.add(frontCamera);

        // Alto-falante
        const speakerGeometry = new THREE.PlaneGeometry(0.3, 0.02);
        const speakerMaterial = new THREE.MeshBasicMaterial({ color: 0x4a5568 });
        const speaker = new THREE.Mesh(speakerGeometry, speakerMaterial);
        speaker.position.set(0, 1.1, 0.062);
        this.phone.add(speaker);

        // Botão
        const buttonGeometry = new THREE.CircleGeometry(0.05, 12);
        const buttonMaterial = new THREE.MeshBasicMaterial({ color: 0x4a5568 });
        const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
        button.position.set(0, -1.0, 0.062);
        this.phone.add(button);
    }

    updateOrientation(alpha, beta, gamma) {
        // Salvar valores brutos
        this.alpha = alpha || 0;
        this.beta = beta || 0;
        this.gamma = gamma || 0;

        // Suavizar valores para movimento mais natural
        const smoothing = 0.3;
        this.smoothAlpha = this.lerp(this.smoothAlpha, this.alpha, smoothing);
        this.smoothBeta = this.lerp(this.smoothBeta, this.beta, smoothing);
        this.smoothGamma = this.lerp(this.smoothGamma, this.gamma, smoothing);

        // Converter graus para radianos
        const a = THREE.MathUtils.degToRad(this.smoothAlpha);
        const b = THREE.MathUtils.degToRad(this.smoothBeta);
        const g = THREE.MathUtils.degToRad(this.smoothGamma);

        // Aplicar rotação usando ordem Z-X-Y (mais natural para dispositivos móveis)
        if (this.phone) {
            this.phone.rotation.set(b, g, a, 'ZYX');
        }

        // Atualizar indicador de orientação
        this.updateOrientationIndicator();
    }

    lerp(start, end, factor) {
        return start * (1 - factor) + end * factor;
    }

    updateOrientationIndicator() {
        const indicator = document.getElementById('orientationIndicator');
        if (indicator) {
            indicator.textContent = 
                `X:${Math.round(this.gamma)}° Y:${Math.round(this.beta)}° Z:${Math.round(this.alpha)}°`;
        }
    }

    setCalibrationMode(isCalibrating, step = 0) {
        this.isCalibrating = isCalibrating;
        this.calibrationStep = step;
        
        if (this.screen) {
            if (isCalibrating) {
                // Diferentes cores para diferentes passos de calibração
                const colors = {
                    0: 0x6366f1, // Azul - passo inicial
                    1: 0xf59e0b, // Laranja - giro esquerda
                    2: 0x10b981, // Verde - giro direita
                    3: 0x8b5cf6  // Roxo - volta inicial
                };
                
                this.screen.material.emissive.setHex(colors[step] || 0x6366f1);
                this.screen.material.emissiveIntensity = 0.3;
            } else {
                // Modo normal - tela preta
                this.screen.material.emissive.setHex(0x111111);
                this.screen.material.emissiveIntensity = 0.1;
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Pequena animação de flutuação quando não está calibrando
        if (!this.isCalibrating && this.phone) {
            const time = Date.now() * 0.001;
            this.phone.position.y = Math.sin(time * 0.5) * 0.1;
        }

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        if (this.camera && this.renderer) {
            const container = document.getElementById('threejs-container');
            if (container) {
                const width = container.clientWidth;
                const height = container.clientHeight;
                
                this.camera.aspect = width / height;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(width, height);
            }
        }
    }

    // Método para limpar recursos
    dispose() {
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

// Instância global do visualizador
let threeJSVisualizer = null;

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        threeJSVisualizer = new ThreeJSVisualizer();
    }, 1000);
});