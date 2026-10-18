import * as THREE from 'three';
import { texturaPiedra } from './texturas.js';

// Piedra base; cada muro la clona y ajusta la repetición a su tamaño (baldosas sin estirar).
const texPiedraBase = texturaPiedra(1);

/**
 * mapElement — muro del mapa: una caja que bloquea el paso y la visión.
 */
export class mapElement {

    constructor(x = 0, z = 0, ancho, alto, fondo) {

        this.mesh = new THREE.Object3D();
        this.semiAncho = ancho / 2;
        this.semiFondo = fondo / 2;
        this.disponerMaterial = true; // material propio: limpiarNivel lo libera

        // Repetición según el lado largo (max de ancho/fondo), para que todos los muros
        // tilen igual sin estirarse.
        const tex = texPiedraBase.clone();
        tex.needsUpdate = true;
        const largo = Math.max(ancho, fondo);
        tex.repeat.set(Math.max(1, Math.round(largo / 400)), Math.max(1, Math.round(alto / 400)));
        const material = new THREE.MeshStandardMaterial({ map: tex });

        // Caja del muro.

        const base = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), material);
        // Media altura arriba para que apoye en el suelo (la caja se centra en su origen).
        base.position.y = alto / 2;

        this.mesh.add(base);

        // Posición en el suelo (x, z).
        this.mesh.position.set(x, 0, z);
    }

}
