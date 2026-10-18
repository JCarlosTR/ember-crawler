import * as THREE from 'three';
import { fundirGeometrias } from './geomUtils.js';
import { texturaRuido, mapasPBR } from './texturas.js';

/**
 * Tree — pino: tronco (cilindro) y copa de conos apilados.
 *
 * La copa de cada árbol es una malla aparte; los troncos de todo el bosque van en una
 * sola malla con corteza (crearMallaTroncos), así texturarlos no suma draw calls.
 * Interfaz de obstáculo (mesh, semiAncho, semiFondo): la copa choca y tapa la visión.
 */

const PROP_TRONCO = 0.3;                       // tronco = 30% de la altura
const dimsTronco = (altura) => ({ largo: altura * PROP_TRONCO, radio: altura * 0.04 });

// Copa: verde por vértice (compartido), con ruido claro para moteado.
const matCopa = new THREE.MeshStandardMaterial({ vertexColors: true, map: texturaRuido(2) });
const C_COPA  = new THREE.Color(0x2e6b2e);     // verde

// Corteza: textura PBR compartida por la malla única de troncos. metalness/roughness a 1
// para que mande el mapa arm.
const matCorteza = new THREE.MeshStandardMaterial({
    ...mapasPBR('bark', 'metasequoia_bark', 2, 3),   // repite 2 alrededor, 3 a lo alto
    metalness: 1,
    roughness: 1,
});

// Tronco con la base apoyada en y=0.
export function geometriaTronco(altura) {
    const { largo, radio } = dimsTronco(altura);
    const g = new THREE.CylinderGeometry(radio, radio, largo, 8);
    g.translate(0, largo / 2, 0);
    return g;
}

// Funde todos los troncos (items = [{x, z, altura}]) en una malla con corteza.
export function crearMallaTroncos(items) {
    const partes = items.map(({ x, z, altura }) => ({
        geo: geometriaTronco(altura).translate(x, 0, z),   // cada tronco a su sitio
        color: new THREE.Color(0xffffff),                  // se ignora (sin vertexColors)
    }));
    return new THREE.Mesh(fundirGeometrias(partes), matCorteza);
}

export class Tree {
    constructor(x = 0, z = 0, altura = 300) {
        this.mesh = new THREE.Object3D();

        const { largo: largoTronco, radio: radioTronco } = dimsTronco(altura);

        // Copa de conos apilados. El tronco va en la malla global, aquí no.
        const partes = [];
        const numCapas = Math.max(3, Math.floor(altura / 200));
        const altoCopaTotal = altura * (1 - PROP_TRONCO);
        const radioBaseCopa = altura * 0.22;
        const altoCono = altoCopaTotal * 0.55;               // se solapan entre capas
        const separacionCapas = (altoCopaTotal * 0.8) / numCapas;

        for (let i = 0; i < numCapas; i++) {
            const factor = i / numCapas;                     // 0 (base) -> ~1 (punta)
            const radioNivel = radioBaseCopa * (1 - (factor * 0.65));
            const gCopa = new THREE.ConeGeometry(radioNivel, altoCono, 8);
            gCopa.translate(0, largoTronco + (separacionCapas * i) + (altoCono / 2), 0);
            partes.push({ geo: gCopa, color: C_COPA });
        }

        this.mesh.add(new THREE.Mesh(fundirGeometrias(partes), matCopa));
        this.mesh.position.set(x, 0, z);

        // Colisión fina, para pasar entre árboles.
        this.semiAncho = radioTronco + 1;
        this.semiFondo = radioTronco + 1;
    }
}
