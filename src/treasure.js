import * as THREE from 'three';
import { cargarModelo } from './modelos.js';

/**
 * Treasure — cofre del tesoro. Se "encuentra" al acercarse (radioRecogida); no bloquea.
 *
 * Usa un modelo glTF cargado una vez y clonado por cofre. La geometría y los materiales
 * se comparten entre clones, así que al cambiar de nivel se quita con scene.remove, no
 * con quitarDeEscena (que los liberaría). Lleva un faro dorado y brillo propio para que
 * resalte en el bosque oscuro; el faro se añade al instante, aunque el modelo tarde.
 */

const RUTA_COFRE = 'modelos3d/treasure_chest_1k.gltf/treasure_chest_1k.gltf';

// --- AJUSTES ---
const ANCHO_OBJETIVO   = 100;        // ancho del cofre (baja para hacerlo más pequeño)
const FARO_COLOR       = 0xffcc66;   // color del resplandor
const FARO_INTENSIDAD  = 0.4;        // brillo del faro (súbelo para que destaque más)
const FARO_ALCANCE     = 1500;       // alcance de la luz
const FARO_ALTURA      = 140;        // altura del faro sobre el cofre
const BRILLO_COFRE     = 0.5;        // brillo propio del cofre; 0 = sin brillo
const BRILLO_COLOR     = 0xffcc55;   // tinte del brillo propio

// Carga la plantilla una vez (escalada, apoyada y con brillo) y la cachea.
let promesaPlantilla = null;
function plantillaCofre() {
    if (!promesaPlantilla) {
        promesaPlantilla = cargarModelo(RUTA_COFRE).then((modelo) => {
            // Escala al ancho objetivo según el tamaño real del modelo.
            const tam = new THREE.Vector3();
            new THREE.Box3().setFromObject(modelo).getSize(tam);
            const escala = ANCHO_OBJETIVO / tam.x;
            modelo.scale.setScalar(escala);
            console.log('[cofre] modelo cargado. tamaño original:', tam, '-> escala:', escala);

            // Centra en XZ y apoya la base en y=0.
            const caja = new THREE.Box3().setFromObject(modelo);
            const centro = new THREE.Vector3();
            caja.getCenter(centro);
            modelo.position.x -= centro.x;
            modelo.position.z -= centro.z;
            modelo.position.y -= caja.min.y;

            modelo.traverse((o) => {
                if (!o.isMesh) return;
                // El modelo llega después de activarSombras(); sombras aquí.
                o.castShadow = true;
                o.receiveShadow = true;
                if (o.material) {
                    // El renderer trabaja en lineal; el glTF trae el color como sRGB y
                    // saldría oscuro, así que se trata como lineal.
                    if (o.material.map) o.material.map.encoding = THREE.LinearEncoding;
                    // Brillo propio dorado siguiendo la textura, para que resalte.
                    o.material.emissive = new THREE.Color(BRILLO_COLOR);
                    o.material.emissiveMap = o.material.map || null;
                    o.material.emissiveIntensity = BRILLO_COFRE;
                    o.material.needsUpdate = true;
                }
            });
            return modelo;
        }).catch((err) => {
            // Si el modelo no carga, caja dorada de respaldo para que el cofre siga visible.
            console.error('[cofre] no se pudo cargar el modelo glTF:', RUTA_COFRE, err);
            const mat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0x886600, emissiveIntensity: 1 });
            const alto = ANCHO_OBJETIVO * 0.65;
            const caja = new THREE.Mesh(new THREE.BoxGeometry(ANCHO_OBJETIVO, alto, ANCHO_OBJETIVO * 0.6), mat);
            caja.position.y = alto / 2;
            caja.castShadow = caja.receiveShadow = true;
            const grupo = new THREE.Object3D();
            grupo.add(caja);
            return grupo;
        });
    }
    return promesaPlantilla;
}

export class Treasure {
    constructor(x = 0, z = 0) {
        this.mesh = new THREE.Object3D();
        this.radioRecogida = 130;   // distancia a la que se considera encontrado

        // Faro dorado, añadido ya (sin esperar al modelo): siempre hay un punto al que ir.
        const faro = new THREE.PointLight(FARO_COLOR, FARO_INTENSIDAD, FARO_ALCANCE);
        faro.position.set(0, FARO_ALTURA, 0);
        this.mesh.add(faro);

        // El modelo (o la caja de respaldo) aparece en cuanto termina de cargar.
        plantillaCofre().then((plantilla) => this.mesh.add(plantilla.clone()));

        this.mesh.position.set(x, 0, z);
    }

    // ¿El jugador está bastante cerca? (distancia en XZ)
    encontrado(player) {
        const dx = player.mesh.position.x - this.mesh.position.x;
        const dz = player.mesh.position.z - this.mesh.position.z;
        return Math.hypot(dx, dz) < this.radioRecogida;
    }

    // Recoloca el cofre para el siguiente.
    reubicar(x, z) {
        this.mesh.position.set(x, 0, z);
    }
}
