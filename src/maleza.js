import * as THREE from 'three';
import { fundirGeometrias } from './geomUtils.js';
import { texturaCesped } from './texturas.js';

// Césped compartido para el parche base; el tinte del material lo separa del suelo.
const texMaleza = texturaCesped(3);

/**
 * Maleza — zona de hierba que ralentiza al que la pisa. No choca: se camina por encima.
 * Parche verde oscuro con briznas (fundidas en una malla). Expone contiene(x, z) y factor.
 */

// Materiales compartidos.
const matSuelo  = new THREE.MeshStandardMaterial({
    map: texMaleza, color: 0x5c7a38,   // tinte oliva
    transparent: true, opacity: 0.9, side: THREE.DoubleSide,
});
const matHierba = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide });
const C_HIERBA  = new THREE.Color(0x3f7d2e);   // verde base
const C_PUNTA   = new THREE.Color(0x66aa3a);   // verde claro (algunas briznas)

export class Maleza {
    constructor(x = 0, z = 0, ancho = 300, fondo = 300, factor = 0.5) {
        this.mesh = new THREE.Object3D();
        this.mesh.position.set(x, 1, z);        // algo sobre el suelo (z-fighting)

        this.semiAncho = ancho / 2;
        this.semiFondo = fondo / 2;
        this.factor = factor;                   // multiplicador de velocidad

        // Parche plano, para ver la zona desde arriba.
        const base = new THREE.Mesh(new THREE.PlaneGeometry(ancho, fondo), matSuelo);
        base.rotation.x = -Math.PI / 2;
        this.mesh.add(base);

        // Briznas finas, fundidas en una malla.
        const numBriznas = Math.min(600, Math.max(60, Math.round((ancho * fondo) / 700)));
        const partes = [];
        for (let i = 0; i < numBriznas; i++) {
            const h = 22 + Math.random() * 32;
            const g = new THREE.ConeGeometry(1.4 + Math.random() * 1.4, h, 4);
            g.rotateX((Math.random() - 0.5) * 0.5);   // inclinación aleatoria
            g.rotateZ((Math.random() - 0.5) * 0.5);
            g.rotateY(Math.random() * Math.PI);
            const bx = (Math.random() - 0.5) * ancho;
            const bz = (Math.random() - 0.5) * fondo;
            g.translate(bx, h / 2, bz);                // base de la brizna en el suelo
            partes.push({ geo: g, color: Math.random() < 0.5 ? C_HIERBA : C_PUNTA });
        }
        this.mesh.add(new THREE.Mesh(fundirGeometrias(partes), matHierba));
    }

    // ¿El punto (x, z) está sobre esta maleza?
    contiene(x, z) {
        return Math.abs(x - this.mesh.position.x) <= this.semiAncho &&
               Math.abs(z - this.mesh.position.z) <= this.semiFondo;
    }
}
