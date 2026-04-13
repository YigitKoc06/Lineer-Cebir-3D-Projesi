/* ═══════════════════════════════════════════════════════════
   LİNEER CEBİR VE ANTİ-YERÇEKİMİ GÖRSELLEŞTİRMESİ
   Three.js 3D Interactive Visualization
   — Mobile-Optimized Edition —
   ═══════════════════════════════════════════════════════════ */

// ─── Mobile Detection ───
const isMobile = (() => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const smallScreen = window.innerWidth <= 900;
    const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    return (mobileUA || (touchDevice && smallScreen));
})();

// Performance tiers
const PERF = {
    particleCount:   isMobile ? 300  : 500,
    starfieldCount:  isMobile ? 1200 : 2000,
    maxPixelRatio:   isMobile ? 1.5  : 2,
    shadowsEnabled:  !isMobile,
    gridDivisions:   isMobile ? 18   : 24,
    energySegments:  isMobile ? 80   : 120,
    projGridDiv:     isMobile ? 10   : 16,
    floatingShapeCount: isMobile ? 4  : 6,
    hudUpdateInterval:  isMobile ? 2  : 1,  // update HUD every N frames
};

// ─── Globals ───
let scene, camera, renderer, controls;
let clock, time = 0;
let dodecahedron, transformedDodec, wireframeOriginal, wireframeTransformed;
let gridGroup, projectionPlane, projectionMesh;
let particles, energyLines = [];
let vectorArrows = [];
let autoRotate = true;
let floatingShapes = [];
let frameCount = 0;

// ─── Colors ───
const COLORS = {
    blue: new THREE.Color(0x00b4ff),
    blueDim: new THREE.Color(0x003366),
    orange: new THREE.Color(0xff8c00),
    orangeBright: new THREE.Color(0xffaa33),
    green: new THREE.Color(0x00ff88),
    purple: new THREE.Color(0xaa44ff),
    white: new THREE.Color(0xe0eaff),
    dark: new THREE.Color(0x050510),
};

// ─── Init ───
function init() {
    clock = new THREE.Clock();

    // Scene
    scene = new THREE.Scene();
    scene.background = COLORS.dark;
    scene.fog = new THREE.FogExp2(0x050510, isMobile ? 0.02 : 0.015);

    // Camera
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(8, 6, 12);

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('scene'),
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, PERF.maxPixelRatio));

    if (PERF.shadowsEnabled) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } else {
        renderer.shadowMap.enabled = false;
    }

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // Controls — optimized for touch
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = isMobile ? 0.08 : 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.minDistance = 5;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.target.set(0, 1.5, 0);

    // Touch-specific: one finger rotate, two-finger pinch zoom
    controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controls.rotateSpeed = isMobile ? 0.6 : 1.0;
    controls.zoomSpeed   = isMobile ? 0.8 : 1.0;
    controls.panSpeed    = isMobile ? 0.6 : 1.0;

    // Build scene
    createStarfield();
    createLights();
    createGrid();
    createDodecahedron();
    createTransformedShape();
    createProjectionPlane();
    createEnergyFields();
    createTransformationArrows();
    createFloatingPolyhedra();
    createParticles();

    // Events
    window.addEventListener('resize', onResize);

    // Mobile panel drawer setup
    if (isMobile) {
        setupMobilePanels();
    }

    // Hide loader
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 2200);

    // Start loop
    animate();
}

// ═══════════════════════════════════════════════════════════
// MOBILE PANEL DRAWER LOGIC
// ═══════════════════════════════════════════════════════════
function setupMobilePanels() {
    const drawer = document.getElementById('mobile-panel-drawer');
    const toggleBtn = document.getElementById('mobile-panel-toggle');
    const matrixPanel = document.getElementById('matrix-panel');
    const transformPanel = document.getElementById('transform-panel');
    const floatingMatrices = document.getElementById('floating-matrices');
    const bottomBar = document.getElementById('bottom-bar');

    // Move panels into the drawer
    if (drawer) {
        if (matrixPanel) drawer.appendChild(matrixPanel);
        if (transformPanel) drawer.appendChild(transformPanel);

        // Move floating matrix chips into the drawer as a group
        if (floatingMatrices) {
            floatingMatrices.classList.add('in-drawer');
            drawer.appendChild(floatingMatrices);
        }
    }

    // Move toggle button inside bottom-bar (after the 3 chips)
    if (toggleBtn && bottomBar) {
        bottomBar.appendChild(toggleBtn);
    }

    // Toggle button behaviour
    let isOpen = false;
    toggleBtn.addEventListener('click', () => {
        isOpen = !isOpen;
        drawer.classList.toggle('open', isOpen);
        toggleBtn.classList.toggle('panels-open', isOpen);
        toggleBtn.querySelector('.toggle-icon').textContent = isOpen ? '✕' : '☰';
    });

    // Close drawer on canvas tap (so user can go back to interacting)
    document.getElementById('scene').addEventListener('touchstart', () => {
        if (isOpen) {
            isOpen = false;
            drawer.classList.remove('open');
            toggleBtn.classList.remove('panels-open');
            toggleBtn.querySelector('.toggle-icon').textContent = '☰';
        }
    }, { passive: true });
}

// ─── Starfield ───
function createStarfield() {
    const count = PERF.starfieldCount;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        const r = 50 + Math.random() * 100;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        sizes[i] = 0.5 + Math.random() * 1.5;

        const c = Math.random() > 0.7 ? COLORS.blue : (Math.random() > 0.5 ? COLORS.orangeBright : COLORS.white);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
        size: isMobile ? 0.2 : 0.15,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
    });

    scene.add(new THREE.Points(geo, mat));
}

// ─── Lights ───
function createLights() {
    // Ambient
    scene.add(new THREE.AmbientLight(0x1a2040, 0.6));

    // Blue directional
    const blueLight = new THREE.DirectionalLight(0x00b4ff, 0.8);
    blueLight.position.set(-5, 8, 3);
    if (PERF.shadowsEnabled) {
        blueLight.castShadow = true;
    }
    scene.add(blueLight);

    // Orange directional
    const orangeLight = new THREE.DirectionalLight(0xff8c00, 0.6);
    orangeLight.position.set(5, 6, -3);
    scene.add(orangeLight);

    // Point lights — fewer on mobile
    const pBlue = new THREE.PointLight(0x00b4ff, 1.5, 20);
    pBlue.position.set(-3, 4, 2);
    scene.add(pBlue);

    const pOrange = new THREE.PointLight(0xff8c00, 1.5, 20);
    pOrange.position.set(3, 5, -2);
    scene.add(pOrange);

    if (!isMobile) {
        // Under-glow only on desktop (saves a light on mobile)
        const pGreen = new THREE.PointLight(0x00ff88, 0.6, 15);
        pGreen.position.set(0, -2, 0);
        scene.add(pGreen);
    }
}

// ─── Grid ───
function createGrid() {
    gridGroup = new THREE.Group();
    const gridSize = 16;
    const divisions = PERF.gridDivisions;
    const step = gridSize / divisions;
    const half = gridSize / 2;

    const gridMat = new THREE.LineBasicMaterial({
        color: 0x00b4ff,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
    });

    // X-axis lines (curved down at edges)
    for (let i = 0; i <= divisions; i++) {
        const points = [];
        const z = -half + i * step;
        for (let j = 0; j <= divisions; j++) {
            const x = -half + j * step;
            const dist = Math.sqrt(x * x + z * z) / half;
            const y = -dist * dist * 1.5;
            points.push(new THREE.Vector3(x, y, z));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        gridGroup.add(new THREE.Line(geo, gridMat));
    }

    // Z-axis lines (curved down at edges)
    for (let i = 0; i <= divisions; i++) {
        const points = [];
        const x = -half + i * step;
        for (let j = 0; j <= divisions; j++) {
            const z = -half + j * step;
            const dist = Math.sqrt(x * x + z * z) / half;
            const y = -dist * dist * 1.5;
            points.push(new THREE.Vector3(x, y, z));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        gridGroup.add(new THREE.Line(geo, gridMat));
    }

    // Axis beams (X, Y, Z)
    const axisLength = 6;
    const xAxisMat = new THREE.LineBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.6 });
    const yAxisMat = new THREE.LineBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.6 });
    const zAxisMat = new THREE.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.6 });

    const xGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(axisLength, 0, 0)
    ]);
    const yGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, axisLength, 0)
    ]);
    const zGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, axisLength)
    ]);

    gridGroup.add(new THREE.Line(xGeo, xAxisMat));
    gridGroup.add(new THREE.Line(yGeo, yAxisMat));
    gridGroup.add(new THREE.Line(zGeo, zAxisMat));

    // Glowing center cross
    const centerGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x00ff88 })
    );
    gridGroup.add(centerGlow);

    scene.add(gridGroup);
}

// ─── Original Dodecahedron ───
function createDodecahedron() {
    const geo = new THREE.DodecahedronGeometry(1.2, 0);

    let mat;
    {
        mat = new THREE.MeshPhongMaterial({
            color: 0x003366,
            emissive: 0x001a44,
            specular: 0x00b4ff,
            shininess: 80,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
        });
    }

    dodecahedron = new THREE.Mesh(geo, mat);
    dodecahedron.position.set(-2.5, 2.0, 0);
    if (PERF.shadowsEnabled) dodecahedron.castShadow = true;
    scene.add(dodecahedron);

    // Wireframe overlay
    const wireMat = new THREE.MeshBasicMaterial({
        color: 0x00b4ff,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
    });
    wireframeOriginal = new THREE.Mesh(geo.clone(), wireMat);
    wireframeOriginal.position.copy(dodecahedron.position);
    scene.add(wireframeOriginal);

    // Glow sprite
    addGlowSprite(dodecahedron.position, 0x00b4ff, isMobile ? 3.0 : 3.5);
}

// ─── Transformed Shape ───
function createTransformedShape() {
    const geo = new THREE.DodecahedronGeometry(1.4, 0);

    let mat;
    {
        mat = new THREE.MeshPhongMaterial({
            color: 0x663300,
            emissive: 0x331a00,
            specular: 0xff8c00,
            shininess: 100,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
        });
    }

    transformedDodec = new THREE.Mesh(geo, mat);
    transformedDodec.position.set(2.5, 4.0, 0);
    if (PERF.shadowsEnabled) transformedDodec.castShadow = true;
    scene.add(transformedDodec);

    // Wireframe
    const wireMat = new THREE.MeshBasicMaterial({
        color: 0xff8c00,
        wireframe: true,
        transparent: true,
        opacity: 0.7,
    });
    wireframeTransformed = new THREE.Mesh(geo.clone(), wireMat);
    wireframeTransformed.position.copy(transformedDodec.position);
    scene.add(wireframeTransformed);

    addGlowSprite(transformedDodec.position, 0xff8c00, isMobile ? 3.5 : 4.0);
}

// ─── Glow Sprite ───
function addGlowSprite(position, color, size) {
    const canvas = document.createElement('canvas');
    const texSize = 128;
    canvas.width = texSize;
    canvas.height = texSize;
    const ctx = canvas.getContext('2d');
    const half = texSize / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    const c = new THREE.Color(color);
    gradient.addColorStop(0, `rgba(${Math.floor(c.r*255)},${Math.floor(c.g*255)},${Math.floor(c.b*255)},0.4)`);
    gradient.addColorStop(0.4, `rgba(${Math.floor(c.r*255)},${Math.floor(c.g*255)},${Math.floor(c.b*255)},0.1)`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, texSize, texSize);

    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
        map: tex,
        blending: THREE.AdditiveBlending,
        transparent: true,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(position);
    sprite.scale.set(size, size, 1);
    scene.add(sprite);
    return sprite;
}

// ─── Projection Plane ───
function createProjectionPlane() {
    const planeGeo = new THREE.PlaneGeometry(8, 8, isMobile ? 12 : 32, isMobile ? 12 : 32);
    const planeMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
    });

    projectionPlane = new THREE.Mesh(planeGeo, planeMat);
    projectionPlane.rotation.x = -Math.PI / 2;
    projectionPlane.position.y = -3;
    scene.add(projectionPlane);

    // Grid lines on projection plane
    const projGridMat = new THREE.LineBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
    });

    const projGridGroup = new THREE.Group();
    const pSize = 8;
    const pDiv = PERF.projGridDiv;
    const pStep = pSize / pDiv;
    const pHalf = pSize / 2;

    for (let i = 0; i <= pDiv; i++) {
        const v = -pHalf + i * pStep;
        const g1 = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(v, 0, -pHalf),
            new THREE.Vector3(v, 0, pHalf),
        ]);
        const g2 = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-pHalf, 0, v),
            new THREE.Vector3(pHalf, 0, v),
        ]);
        projGridGroup.add(new THREE.Line(g1, projGridMat));
        projGridGroup.add(new THREE.Line(g2, projGridMat));
    }
    projGridGroup.position.y = -2.99;
    scene.add(projGridGroup);

    // 2D projected shadow shape
    const projGeo = new THREE.DodecahedronGeometry(0.8, 0);
    const projMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        wireframe: true,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
    });
    projectionMesh = new THREE.Mesh(projGeo, projMat);
    projectionMesh.position.set(0, -2.95, 0);
    projectionMesh.scale.set(1, 0.01, 1);
    scene.add(projectionMesh);
}

// ─── Energy Fields ───
function createEnergyFields() {
    createEnergySpiral(-2.5, 2.0, 0, 0x00b4ff, 1);
    createEnergySpiral(2.5, 4.0, 0, 0xff8c00, -1);
    createConnectionBeam();
}

function createEnergySpiral(cx, cy, cz, color, direction) {
    const points = [];
    const spiralTurns = isMobile ? 2 : 3;
    const segments = PERF.energySegments;
    const height = 3;
    const radius = 1.8;

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const angle = t * Math.PI * 2 * spiralTurns * direction;
        const r = radius * (1 - t * 0.3);
        const x = cx + Math.cos(angle) * r;
        const y = cy - height / 2 + t * height;
        const z = cz + Math.sin(angle) * r;
        points.push(new THREE.Vector3(x, y, z));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    energyLines.push({ mesh: line, basePoints: points.map(p => p.clone()), color });
    scene.add(line);
}

function createConnectionBeam() {
    const segments = isMobile ? 30 : 60;
    const points = [];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = THREE.MathUtils.lerp(-2.5, 2.5, t);
        const y = THREE.MathUtils.lerp(2.0, 4.0, t) + Math.sin(t * Math.PI) * 1.5;
        const z = Math.sin(t * Math.PI * 3) * 0.5;
        points.push(new THREE.Vector3(x, y, z));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
        color: 0xaa44ff,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    energyLines.push({ mesh: line, basePoints: points.map(p => p.clone()), color: 0xaa44ff });
    scene.add(line);
}

// ─── Transformation Arrows ───
function createTransformationArrows() {
    createCurvedArrow(-2.5, 3.5, 0, 0x00b4ff, 'rotation');
    createStraightArrow(2.5, 4.0, 0, 0xff8c00, 'scale');
    createLiftArrow(0, -1, 0, 0x00ff88);
}

function createCurvedArrow(cx, cy, cz, color, type) {
    const points = [];
    const segments = isMobile ? 20 : 40;
    const radius = 1.6;
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const angle = -Math.PI * 0.3 + t * Math.PI * 1.2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * 0.3;
        const z = cz + Math.sin(angle) * radius;
        points.push(new THREE.Vector3(x, y, z));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);

    const tipDir = new THREE.Vector3().subVectors(
        points[points.length - 1],
        points[points.length - 3]
    ).normalize();
    const arrowHelper = new THREE.ArrowHelper(tipDir, points[points.length - 1], 0.3, color, 0.2, 0.1);
    scene.add(arrowHelper);
}

function createStraightArrow(cx, cy, cz, color, type) {
    const directions = [
        new THREE.Vector3(1, 0.3, 0),
        new THREE.Vector3(-1, 0.3, 0),
        new THREE.Vector3(0, 0.3, 1),
        new THREE.Vector3(0, 0.3, -1),
    ];

    directions.forEach(dir => {
        dir.normalize();
        const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(cx, cy, cz), 1.8, color, 0.2, 0.1);
        arrow.line.material.transparent = true;
        arrow.line.material.opacity = 0.4;
        arrow.line.material.blending = THREE.AdditiveBlending;
        scene.add(arrow);
        vectorArrows.push(arrow);
    });
}

function createLiftArrow(cx, cy, cz, color) {
    const count = isMobile ? 3 : 5;
    for (let i = 0; i < count; i++) {
        const x = cx + (Math.random() - 0.5) * 4;
        const z = cz + (Math.random() - 0.5) * 4;
        const arrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(x, cy, z),
            2 + Math.random(),
            color,
            0.25,
            0.12
        );
        arrow.line.material.transparent = true;
        arrow.line.material.opacity = 0.3;
        arrow.line.material.blending = THREE.AdditiveBlending;
        scene.add(arrow);
        vectorArrows.push(arrow);
    }
}

// ─── Floating Polyhedra ───
function createFloatingPolyhedra() {
    const allGeometries = [
        new THREE.IcosahedronGeometry(0.3, 0),
        new THREE.OctahedronGeometry(0.25, 0),
        new THREE.TetrahedronGeometry(0.3, 0),
        new THREE.IcosahedronGeometry(0.2, 1),
        new THREE.OctahedronGeometry(0.35, 0),
        new THREE.DodecahedronGeometry(0.2, 0),
    ];

    const allPositions = [
        new THREE.Vector3(-5, 3, -3),
        new THREE.Vector3(5, 2, -4),
        new THREE.Vector3(-4, 5, 2),
        new THREE.Vector3(4, 1, 3),
        new THREE.Vector3(0, 6, -3),
        new THREE.Vector3(-3, 1, 4),
    ];

    const count = PERF.floatingShapeCount;
    const geometries = allGeometries.slice(0, count);
    const positions = allPositions.slice(0, count);

    geometries.forEach((geo, i) => {
        const isBlue = i % 2 === 0;
        const mat = new THREE.MeshBasicMaterial({
            color: isBlue ? 0x00b4ff : 0xff8c00,
            wireframe: true,
            transparent: true,
            opacity: 0.2 + Math.random() * 0.2,
            blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(positions[i]);
        scene.add(mesh);
        floatingShapes.push({
            mesh,
            basePos: positions[i].clone(),
            speed: 0.3 + Math.random() * 0.5,
            offset: Math.random() * Math.PI * 2,
        });
    });
}

// ─── Particles ───
function createParticles() {
    const count = PERF.particleCount;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 20;
        positions[i * 3 + 1] = Math.random() * 10 - 2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 20;

        const isBlue = Math.random() > 0.4;
        const c = isBlue ? COLORS.blue : COLORS.orange;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
        size: isMobile ? 0.06 : 0.04,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
    });

    particles = new THREE.Points(geo, mat);
    scene.add(particles);
}

// ─── HUD Update ───
function updateHUD(t) {
    // Dynamic rotation angles
    const theta = (Math.sin(t * 0.3) * 45 + 30);
    const phi = (Math.cos(t * 0.25) * 30);
    const thetaRad = theta * Math.PI / 180;
    const phiRad = phi * Math.PI / 180;

    const cosT = Math.cos(thetaRad);
    const sinT = Math.sin(thetaRad);
    const cosP = Math.cos(phiRad);
    const sinP = Math.sin(phiRad);

    // Update matrix display
    document.getElementById('m00').textContent = (cosT * cosP).toFixed(3);
    document.getElementById('m01').textContent = (-sinT).toFixed(3);
    document.getElementById('m02').textContent = (cosT * sinP).toFixed(3);
    document.getElementById('m10').textContent = (sinT * cosP).toFixed(3);
    document.getElementById('m11').textContent = (cosT).toFixed(3);
    document.getElementById('m12').textContent = (sinT * sinP).toFixed(3);
    document.getElementById('m20').textContent = (-sinP).toFixed(3);
    document.getElementById('m21').textContent = '0.000';
    document.getElementById('m22').textContent = (cosP).toFixed(3);

    // Highlight changing values
    document.querySelectorAll('.matrix-row span').forEach(span => {
        const val = parseFloat(span.textContent);
        if (Math.abs(val) > 0.5) {
            span.className = 'highlight-blue';
        } else if (Math.abs(val) > 0.001) {
            span.className = 'highlight-orange';
        } else {
            span.className = '';
        }
    });

    document.getElementById('theta-val').textContent = theta.toFixed(1);
    document.getElementById('phi-val').textContent = phi.toFixed(1);

    // Position vector
    const py = 2.5 + Math.sin(t * 0.5) * 1.5;
    document.getElementById('pos-vec').textContent = `[0.0, ${py.toFixed(1)}, 0.0]`;

    // Scale vector
    const sc = 1.0 + Math.sin(t * 0.7) * 0.2;
    document.getElementById('scale-vec').textContent = `[${sc.toFixed(2)}, ${sc.toFixed(2)}, ${sc.toFixed(2)}]`;

    // Lift vector
    const lift = Math.abs(Math.sin(t * 0.5));
    document.getElementById('lift-vec').textContent = `[0.0, ${lift.toFixed(2)}, 0.0]`;

    // Force bar
    const force = 5 + Math.sin(t * 0.3) * 4;
    const forcePct = (force / 15) * 100;
    document.getElementById('force-fill').style.width = forcePct + '%';
    document.getElementById('force-val').textContent = `F = ${force.toFixed(2)} m/s²`;

    // Floating matrix values
    const det = cosT * cosP;
    document.getElementById('det-val').textContent = Math.abs(det).toFixed(3);
    document.getElementById('trace-val').textContent = (cosT * cosP + cosT + cosP).toFixed(3);
    document.getElementById('norm-val').textContent = (Math.sqrt(cosT*cosT + sinT*sinT)).toFixed(3);

    const eigenReal = cosT.toFixed(3);
    const eigenImag = Math.abs(sinT).toFixed(3);
    document.getElementById('eigen-val').textContent = `${eigenReal}+${eigenImag}i`;
}

// ─── Animation Loop ───
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    time += delta;
    frameCount++;

    // Update controls
    controls.update();

    // ── Animate Original Dodecahedron ──
    dodecahedron.rotation.x = time * 0.2;
    dodecahedron.rotation.y = time * 0.35;
    dodecahedron.position.y = 2.0 + Math.sin(time * 0.8) * 0.3;
    wireframeOriginal.rotation.copy(dodecahedron.rotation);
    wireframeOriginal.position.copy(dodecahedron.position);

    // ── Animate Transformed Dodecahedron ──
    transformedDodec.rotation.x = time * 0.4;
    transformedDodec.rotation.y = -time * 0.3;
    transformedDodec.rotation.z = time * 0.15;
    const liftY = 4.0 + Math.sin(time * 0.5) * 1.5;
    transformedDodec.position.y = liftY;
    wireframeTransformed.rotation.copy(transformedDodec.rotation);
    wireframeTransformed.position.copy(transformedDodec.position);

    // Morphing scale effect
    const scaleOsc = 1.0 + Math.sin(time * 0.7) * 0.15;
    transformedDodec.scale.setScalar(scaleOsc);
    wireframeTransformed.scale.setScalar(scaleOsc);

    // ── Projection shadow ──
    projectionMesh.rotation.y = dodecahedron.rotation.y;
    projectionMesh.scale.x = 0.8 + Math.sin(time * 0.5) * 0.2;
    projectionMesh.scale.z = 0.8 + Math.cos(time * 0.5) * 0.2;
    projectionMesh.material.opacity = 0.15 + Math.sin(time) * 0.1;

    // ── Projection plane pulse ──
    projectionPlane.material.opacity = 0.04 + Math.sin(time * 1.5) * 0.02;

    // ── Animate energy lines (skip every other frame on mobile) ──
    if (!isMobile || frameCount % 2 === 0) {
        energyLines.forEach((el, idx) => {
            const positions = el.mesh.geometry.attributes.position;
            if (!positions) return;
            const arr = positions.array;
            for (let i = 0; i < el.basePoints.length; i++) {
                const bp = el.basePoints[i];
                arr[i * 3] = bp.x + Math.sin(time * 2 + i * 0.3) * 0.1;
                arr[i * 3 + 1] = bp.y + Math.cos(time * 1.5 + i * 0.2) * 0.08;
                arr[i * 3 + 2] = bp.z + Math.sin(time * 1.8 + i * 0.25) * 0.1;
            }
            positions.needsUpdate = true;
            el.mesh.material.opacity = 0.2 + Math.sin(time * 2 + idx) * 0.15;
        });
    }

    // ── Floating Polyhedra ──
    floatingShapes.forEach(s => {
        s.mesh.rotation.x += 0.005 * s.speed;
        s.mesh.rotation.y += 0.008 * s.speed;
        s.mesh.position.y = s.basePos.y + Math.sin(time * s.speed + s.offset) * 0.8;
        s.mesh.position.x = s.basePos.x + Math.cos(time * s.speed * 0.5 + s.offset) * 0.3;
    });

    // ── Particles drift upward ──
    if (particles) {
        const pos = particles.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            let y = pos.getY(i);
            y += 0.003 + Math.sin(time + i) * 0.001;
            if (y > 8) y = -2;
            pos.setY(i, y);
        }
        pos.needsUpdate = true;
        particles.rotation.y += 0.0003;
    }

    // ── Grid warping (throttle on mobile) ──
    if (!isMobile || frameCount % 3 === 0) {
        gridGroup.children.forEach((child, i) => {
            if (child.material) {
                child.material.opacity = 0.12 + Math.sin(time * 0.5 + i * 0.1) * 0.04;
            }
        });
    }

    // ── Update HUD (throttled on mobile) ──
    if (frameCount % PERF.hudUpdateInterval === 0) {
        updateHUD(time);
    }

    // ── Render ──
    renderer.render(scene, camera);
}

// ─── Resize ───
function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, PERF.maxPixelRatio));
}

// ─── Auto Rotate Toggle ───
function toggleAutoRotate() {
    autoRotate = !autoRotate;
    controls.autoRotate = autoRotate;
    const chip = document.getElementById('auto-rotate-chip');
    chip.innerHTML = `<span class="chip-icon">↻</span><span>Otomatik Döndür: ${autoRotate ? 'AÇIK' : 'KAPALI'}</span>`;
    chip.classList.toggle('active', autoRotate);
}

// ─── Start ───
window.addEventListener('DOMContentLoaded', init);
