import * as THREE from 'three';
import { fundirGeometrias } from './geomUtils.js';
import { mapasPBR } from './texturas.js';

/**
 * Rock — cantos angulares (dodecaedros) agrupados compactos y fundidos en una malla.
 * La hitbox sale del bounding box real; por eso se mantienen compactas, una veta
 * diagonal dejaría esquinas vacías.
 * Interfaz de obstáculo (mesh, semiAncho, semiFondo): choca y tapa la visión.
 */

// Mármol: textura PBR compartida. El color por vértice (casi blanco, con variación) la
// multiplica para dar un tono distinto a cada roca. metalness/roughness a 1.
const matRoca = new THREE.MeshStandardMaterial({
    vertexColors: true,
    ...mapasPBR('marble', 'marble_rock_01', 1.5, 1.5),
    metalness: 1,
    roughness: 1,
});

export class Rock {
    constructor(x = 0, z = 0) {
        this.mesh = new THREE.Object3D();

        const apilada = Math.random() < 0.4;                 // 40% pila, 60% grupo bajo
        const numBloques = 3 + Math.floor(Math.random() * 3); // 3-5 cantos
        const partes = [];
        let apiladoY = 0;

        for (let i = 0; i < numBloques; i++) {
            const r = 45 + Math.random() * 55;               // 45-100
            const g = new THREE.DodecahedronGeometry(r, 0);  // canto angular low-poly
            // Escala NO uniforme + rotación para que no parezcan bolas.
            g.scale(0.8 + Math.random() * 0.7, 0.6 + Math.random() * 0.6, 0.8 + Math.random() * 0.7);
            g.rotateX(Math.random() * Math.PI);
            g.rotateY(Math.random() * Math.PI);

            let px, pz, py;
            if (apilada) {
                px = (Math.random() - 0.5) * 50;             // casi en el sitio
                pz = (Math.random() - 0.5) * 50;
                py = apiladoY + r * 0.45;
                apiladoY += r * 0.75;
            } else {
                const ang = Math.random() * Math.PI * 2;     // dispersión pequeña -> compacto
                const d = Math.random() * r * 0.9;
                px = Math.cos(ang) * d;
                pz = Math.sin(ang) * d;
                py = r * 0.4;
            }
            g.translate(px, py, pz);

            const tono = 0.82 + Math.random() * 0.15;        // casi blanco, con ligera variación
            partes.push({ geo: g, color: new THREE.Color(tono, tono, Math.min(1, tono + 0.02)) });
        }

        const geo = fundirGeometrias(partes);

        // Colisión del bounding box real, centrada en el origen (XZ).
        geo.computeBoundingBox();
        const bb = geo.boundingBox;
        const cx = (bb.min.x + bb.max.x) / 2;
        const cz = (bb.min.z + bb.max.z) / 2;
        const anchoReal = bb.max.x - bb.min.x;
        const fondoReal = bb.max.z - bb.min.z;
        geo.translate(-cx, 0, -cz);

        this.mesh.add(new THREE.Mesh(geo, matRoca));
        this.mesh.position.set(x, 0, z);

        // x0.9: sin "muro invisible" en los bordes.
        this.semiAncho = (anchoReal / 2) * 0.9;
        this.semiFondo = (fondoReal / 2) * 0.9;
    }
}
