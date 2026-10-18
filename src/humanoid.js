import * as THREE from 'three';

/**
 * Cuerpo humanoide común a jugador y enemigos: piernas con pies que se balancean,
 * torso estrechado en la cintura y cabeza. Cada clase añade lo suyo encima.
 */

// opts: { matCuerpo, matPiernas?, matCabeza?, altPiernas, altTorso, rHombros, rCintura, rCabeza }
// return: { grupo, piernas:[caderaIzq, caderaDer], cabeza, yHombros, yCabeza }
export function crearHumanoide(opts) {
    const matCuerpo  = opts.matCuerpo;
    const matPiernas = opts.matPiernas ?? matCuerpo;
    const matCabeza  = opts.matCabeza ?? matCuerpo;
    const altPiernas = opts.altPiernas ?? 55;
    const altTorso   = opts.altTorso ?? 55;
    const rHombros   = opts.rHombros ?? 22;
    const rCintura   = opts.rCintura ?? 15;
    const rCabeza    = opts.rCabeza ?? 20;

    const grupo = new THREE.Object3D();

    // --- Piernas: cada una cuelga de un pivote de cadera, que al rotar la balancea ---
    const piernas = [];
    const rPierna = Math.max(7, rCintura * 0.55);
    for (const lado of [-1, 1]) {
        const cadera = new THREE.Object3D();
        cadera.position.set(lado * rCintura * 0.6, altPiernas, 0);

        const pierna = new THREE.Mesh(
            new THREE.CylinderGeometry(rPierna * 0.85, rPierna, altPiernas, 8),
            matPiernas
        );
        pierna.position.y = -altPiernas / 2;         // cuelga hacia abajo desde la cadera
        cadera.add(pierna);

        const pie = new THREE.Mesh(
            new THREE.BoxGeometry(rPierna * 1.8, rPierna * 0.9, rPierna * 2.6),
            matPiernas
        );
        pie.position.set(0, -altPiernas + rPierna * 0.35, rPierna * 0.7);   // extremo inferior, hacia delante
        cadera.add(pie);

        grupo.add(cadera);
        piernas.push(cadera);
    }

    // --- Torso: cilindro estrechado en la cintura y achatado en Z ---
    const torso = new THREE.Mesh(
        new THREE.CylinderGeometry(rHombros, rCintura, altTorso, 12),
        matCuerpo
    );
    torso.position.y = altPiernas + altTorso / 2;
    torso.scale.z = 0.75;
    grupo.add(torso);

    // --- Cabeza ---
    const yCabeza = altPiernas + altTorso + rCabeza * 0.7;
    const cabeza = new THREE.Mesh(new THREE.SphereGeometry(rCabeza, 16, 12), matCabeza);
    cabeza.position.y = yCabeza;
    grupo.add(cabeza);

    return {
        grupo, piernas, cabeza,
        yHombros: altPiernas + altTorso - rHombros * 0.3,
        yCabeza,
    };
}

// Balanceo de piernas al caminar: avanza la fase y rota las caderas en oposición.
// Si no se mueve, las devuelve suavemente a reposo. Devuelve la nueva fase.
export function animarPiernas(piernas, dt, moviendo, fase) {
    if (moviendo) {
        fase += dt * 9;                       // velocidad del ciclo de paso
        const a = Math.sin(fase) * 0.5;       // amplitud (radianes)
        piernas[0].rotation.x = a;
        piernas[1].rotation.x = -a;
    } else {
        const k = Math.min(1, dt * 10);       // volver a reposo
        piernas[0].rotation.x += -piernas[0].rotation.x * k;
        piernas[1].rotation.x += -piernas[1].rotation.x * k;
        fase = 0;
    }
    return fase;
}
