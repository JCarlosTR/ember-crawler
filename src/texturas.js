import * as THREE from 'three';

// Texturas procedurales dibujadas en un canvas (sin archivos). Cada función devuelve una
// CanvasTexture lista para usar como 'map' de un material.

function lienzo(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
}

function aTextura(canvas, repeat) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    return tex;
}

// Césped: verde con motas y briznas cortas más claras/oscuras.
export function texturaCesped(repeat = 1) {
    const c = lienzo(256), g = c.getContext('2d');
    g.fillStyle = '#3f6e2a';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
        const x = Math.random() * 256, y = Math.random() * 256;
        g.strokeStyle = Math.random() < 0.5 ? 'rgba(38,78,24,0.6)' : 'rgba(112,162,62,0.6)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (Math.random() - 0.5) * 3, y - 2 - Math.random() * 4);   // brizna corta
        g.stroke();
    }
    return aTextura(c, repeat);
}

// Piedra: gris con manchas redondeadas y algunas vetas/grietas oscuras.
export function texturaPiedra(repeat = 1) {
    const c = lienzo(256), g = c.getContext('2d');
    g.fillStyle = '#7a7a7a';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 700; i++) {
        const x = Math.random() * 256, y = Math.random() * 256, r = 2 + Math.random() * 11;
        const t = 90 + Math.floor(Math.random() * 80);
        g.fillStyle = `rgba(${t},${t},${t},0.5)`;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 22; i++) {                 // vetas/grietas
        g.strokeStyle = 'rgba(45,45,45,0.5)';
        g.lineWidth = 1 + Math.random() * 1.5;
        let x = Math.random() * 256, y = Math.random() * 256;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
            x += (Math.random() - 0.5) * 55; y += (Math.random() - 0.5) * 55;
            g.lineTo(x, y);
        }
        g.stroke();
    }
    return aTextura(c, repeat);
}

// --- Texturas PBR en archivo (.jpg 1k) para troncos y rocas ---
// Cada set: _diff (color), _nor_gl (normales) y _arm (AO/rugosidad/metalicidad en R/G/B).
// El mapa arm vale a la vez de roughnessMap (canal G) y metalnessMap (canal B); el AO se
// omite porque pediría un segundo juego de UV. Se cargan en lineal, como el resto de la escena.
const _cargadorTex = new THREE.TextureLoader();

export function mapasPBR(carpeta, base, repX = 1, repY = 1) {
    const ruta = (sufijo) => `texturas/${carpeta}/${base}_${sufijo}_1k.jpg`;
    const map        = _cargadorTex.load(ruta('diff'));     // color
    const normalMap  = _cargadorTex.load(ruta('nor_gl'));   // relieve
    const arm        = _cargadorTex.load(ruta('arm'));      // AO/rugosidad/metalicidad

    for (const t of [map, normalMap, arm]) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repX, repY);
    }
    return { map, normalMap, roughnessMap: arm, metalnessMap: arm };
}

// Ruido claro que multiplica el color de vértice (árboles, rocas): da moteado sin
// oscurecer la geometría.
export function texturaRuido(repeat = 1) {
    const c = lienzo(128), g = c.getContext('2d');
    g.fillStyle = '#dedede';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 3200; i++) {
        const x = Math.random() * 128, y = Math.random() * 128;
        const t = 150 + Math.floor(Math.random() * 105);   // 150-255
        g.fillStyle = `rgba(${t},${t},${t},0.5)`;
        g.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    return aTextura(c, repeat);
}
