// static/js/threejs-visualizer.js
// VISUALIZADOR 3D PARA O AIMPOINTER - SEM ROTAÇÃO AUTOMÁTICA (ANIMAÇÃO REMOVIDA)

// Fallback mínimo para evitar erros se outros scripts acessarem antes da inicialização
if (typeof window !== 'undefined' && !window.threeJSVisualizer) {
    window.threeJSVisualizer = {
        updateOrientation: function() {},
        setCalibrationMode: function() {},
        onWindowResize: function() {},
        dispose: function() {},
        hasRecentUpdate: false
    };
}

let scene, camera, renderer, phoneGroup, screenMaterial;

function initializeThreeJS() {
    console.log('🚀 Inicializando Three.js...');

    const container = document.getElementById('threejs-container');
    if (!container) {
        console.error('❌ Container do Three.js não encontrado!');
        return;
    }

    try {
        // Limpar container existente
        while (container.firstChild) container.removeChild(container.firstChild);

        // Cena e câmera
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });

        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        container.appendChild(renderer.domElement);

        // Iluminação
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7);
        scene.add(directionalLight);

        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(-5, 5, 5);
        scene.add(pointLight);

        // Smartphone estilizado
        phoneGroup = new THREE.Group();

        const bodyGeometry = new THREE.BoxGeometry(3, 6, 0.5);
        const bodyMaterial = new THREE.MeshPhongMaterial({
            color: 0x1a1a1a,
            shininess: 100,
            specular: 0x222222
        });
        const phoneBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
        phoneGroup.add(phoneBody);

        const screenGeometry = new THREE.BoxGeometry(2.8, 5.6, 0.1);
        screenMaterial = new THREE.MeshPhongMaterial({
            color: 0x000011,
            emissive: 0x001133,
            transparent: true,
            opacity: 0.9,
            shininess: 90
        });
        const screen = new THREE.Mesh(screenGeometry, screenMaterial);
        screen.position.z = 0.21;
        phoneGroup.add(screen);

        const buttonGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
        const buttonMaterial = new THREE.MeshPhongMaterial({
            color: 0x333333,
            shininess: 50
        });
        const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
        button.position.y = -2.8;
        button.position.z = 0.26;
        button.rotation.x = Math.PI / 2;
        phoneGroup.add(button);

        const cameraGeometry = new THREE.CircleGeometry(0.1, 8);
        const cameraMaterial = new THREE.MeshPhongMaterial({
            color: 0x000000,
            emissive: 0x111111
        });
        const cameraDot = new THREE.Mesh(cameraGeometry, cameraMaterial);
        cameraDot.position.y = 2.5;
        cameraDot.position.z = 0.26;
        phoneGroup.add(cameraDot);

        scene.add(phoneGroup);

        // Posição da câmera
        camera.position.z = 12;
        camera.position.y = 2;

        // Grid opcional
        const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
        gridHelper.position.y = -5;
        scene.add(gridHelper);

        // Animação: somente render loop (sem rotação automática)
        function animate() {
            requestAnimationFrame(animate);

            // NÃO executar rotação automática aqui.
            // O objeto phoneGroup será rotacionado apenas por updateOrientation()
            // quando houver dados do sensor (evita interferir na calibração).

            renderer.render(scene, camera);
        }
        animate();

        // onWindowResize
        function onWindowResize() {
            if (!container || !camera || !renderer) return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
        window.addEventListener('resize', onWindowResize);

        // API pública
        window.threeJSVisualizer = {
            updateOrientation: function(alpha, beta, gamma) {
                if (!phoneGroup) return;

                // Converter para radianos
                const targetX = (beta * Math.PI) / 180;
                const targetY = (gamma * Math.PI) / 180;
                const targetZ = (alpha * Math.PI) / 180;

                // Aplicar suavização nas rotações (interpolação)
                phoneGroup.rotation.x += (targetX - phoneGroup.rotation.x) * 0.1;
                phoneGroup.rotation.y += (targetY - phoneGroup.rotation.y) * 0.1;
                phoneGroup.rotation.z += (targetZ - phoneGroup.rotation.z) * 0.1;

                this.hasRecentUpdate = true;
            },

            setCalibrationMode: function(active, step) {
                if (!screenMaterial) return;
                if (active) {
                    const intensity = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
                    screenMaterial.emissive.setHex(0xff0000);
                    screenMaterial.color.setHex(0x330000);
                    screenMaterial.emissiveIntensity = intensity;
                } else {
                    screenMaterial.emissive.setHex(0x001133);
                    screenMaterial.color.setHex(0x000011);
                    screenMaterial.emissiveIntensity = 1;
                }
            },

            onWindowResize: onWindowResize,

            dispose: function() {
                try {
                    if (renderer) renderer.dispose();
                    if (container) container.innerHTML = '';
                    window.removeEventListener('resize', onWindowResize);
                } catch (err) {
                    console.warn('Erro ao destruir visualizador Three.js:', err);
                }
            },

            hasRecentUpdate: false
        };

        // Remover estado de loading e marcar sucesso
        const visualizer = document.getElementById('deviceVisualizer');
        if (visualizer) {
            visualizer.classList.remove('loading', 'error');
            visualizer.classList.add('status-connected');
        }

        console.log('✅ Three.js inicializado (sem rotação automática).');

    } catch (error) {
        console.error('❌ Erro na inicialização do Three.js:', error);
        const visualizer = document.getElementById('deviceVisualizer');
        if (visualizer) {
            visualizer.classList.remove('loading');
            visualizer.classList.add('error');
        }
    }
}

// Inicialização segura
function safeInitializeThreeJS() {
    if (typeof THREE === 'undefined') {
        console.error('❌ Three.js não foi carregado!');
        const visualizer = document.getElementById('deviceVisualizer');
        if (visualizer) {
            visualizer.classList.remove('loading');
            visualizer.classList.add('error');
        }
        return;
    }
    setTimeout(initializeThreeJS, 100);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInitializeThreeJS);
} else {
    safeInitializeThreeJS();
}

window.initializeThreeJS = initializeThreeJS;
window.safeInitializeThreeJS = safeInitializeThreeJS;