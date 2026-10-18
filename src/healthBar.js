import * as THREE from 'three';

// Barra de vida flotante sobre la cabeza de una entidad (verde = vida, rojo = perdida).
// Siempre encara a la cámara (billboard). La entidad necesita mesh, hp y opcional altura.

const _q = new THREE.Quaternion();   // reutilizable, para no crear uno por frame

export function asignarBarraSalud(entidad, opciones = {}) {
    const ancho  = opciones.ancho  ?? 80;
    const alto   = opciones.alto   ?? 10;
    const altura = opciones.altura ?? ((entidad.altura ?? 200) + 100);   // sobre la cabeza

    entidad.hpMax = entidad.hp;   // nace llena

    const grupo = new THREE.Group();
    grupo.position.y = altura;

    // Fondo rojo (vida perdida), a lo ancho completo.
    const fondo = new THREE.Mesh(
        new THREE.PlaneGeometry(ancho, alto),
        new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide })
    );
    grupo.add(fondo);

    // Frente verde (vida actual). Para que al encoger quede anclado a la izquierda, se
    // desplaza la geometría de modo que su pivote (x=0) caiga en el borde izquierdo.
    const geoVerde = new THREE.PlaneGeometry(ancho, alto);
    geoVerde.translate(ancho / 2, 0, 0);            // borde izquierdo en x=0
    const frente = new THREE.Mesh(
        geoVerde,
        new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
    );
    frente.position.set(-ancho / 2, 0, 0.5);        // a la izquierda, un pelín delante
    grupo.add(frente);

    entidad.mesh.add(grupo);
    entidad.barraSalud = { grupo, frente };
}

export function actualizarBarraSalud(entidad, camera) {
    const b = entidad.barraSalud;
    if (!b) return;

    // La barra verde se escala en X según la vida restante (0..1).
    b.frente.scale.x = Math.max(0, entidad.hp / entidad.hpMax);

    // Billboard: para encarar la cámara hay que compensar la rotación del padre (el
    // enemigo gira al moverse): local = (rotación mundial del padre)^-1 * cámara.
    entidad.mesh.getWorldQuaternion(_q);
    _q.invert();
    b.grupo.quaternion.copy(_q).multiply(camera.quaternion);
}
