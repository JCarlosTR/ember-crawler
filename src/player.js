import * as THREE from 'three';
import { crearHumanoide, animarPiernas } from './humanoid.js';
import { TWEEN } from '../lib/tween.module.min.js';
import { texturaRuido } from './texturas.js';

/**
 * Mago con espada: modelo humanoide con túnica y sombrero, controles de tanque,
 * espada, bola de fuego, vida y maná.
 */
export class Player {
    constructor(x = 0, z = 0) {

        this.mesh = new THREE.Object3D();

        this.velocidad = 150;       // unidades/segundo
        this.velGiro = 2.5;         // rad/s al girar con A/D
        this.radio = 38;            // menor que el modelo, para colarse entre árboles
        this.hp = 100;
        this.hpMax = 100;           // la sube la poción
        this.altura = 150;          // referencia de altura para los ataques
        this.swordCooldown = 0.6;   // s entre tajos
        this.fireCooldown = 3;      // s entre bolas de fuego
        this.swordTimer = 0;        // 0 = listo
        this.fireTimer = 0;         // 0 = listo
        this.alcanceEspada = 150;
        this.mana = 100;
        this.costeFuego = 10;        // lo baja el orbe
        this.costeFuegoExacto = 10;  // valor sin redondear, para acumular descuentos
        this.alcanceFuego = 500;    // lo aumenta el orbe
        this.alcanceFuegoBase = 500; // largo base del rectángulo visual, para escalarlo
        this.anchoFuego = 200;
        this.danoEspada = 20;       // lo suben los items de espada
        this.danoFuego = 50;        // lo suben los orbes

        // --- Modelo ---
        const matCuerpo   = new THREE.MeshStandardMaterial({ color: 0x4477cc, map: texturaRuido(1) });   // túnica azul
        const matSombrero = new THREE.MeshStandardMaterial({ color: 0x888888 });   // sombrero y espada
        const rCabeza = 20;

        // Cuerpo humanoide; 'base' se girará para que el frente mire a -Z.
        const h = crearHumanoide({
            matCuerpo, altPiernas: 55, altTorso: 55, rHombros: 22, rCintura: 15, rCabeza,
        });
        const base = h.grupo;
        const cabeza = h.cabeza;
        this.piernas = h.piernas;   // para animar el paso
        this.pasoFase = 0;

        // Falda acampanada hasta el suelo: tapa las piernas, que siguen animándose debajo.
        const matTunica = matCuerpo.clone();
        matTunica.side = THREE.DoubleSide;
        const tunica = new THREE.Mesh(new THREE.CylinderGeometry(16, 36, 56, 14, 1, true), matTunica);
        tunica.position.y = 28;     // entre el suelo y la cintura
        base.add(tunica);

        // --- Brazos (hombro, brazo, antebrazo flexionado) ---
        const yHombro = h.yHombros;
        const xHombro = 28;
        const largoBrazo = 42;
        const geoBrazo = new THREE.BoxGeometry(14, largoBrazo, 11);

        const brazoIz = new THREE.Object3D();
        brazoIz.position.set(-xHombro, yHombro, 0);
        base.add(brazoIz);
        const meshBrazoIz = new THREE.Mesh(geoBrazo, matCuerpo);
        meshBrazoIz.position.y = -largoBrazo / 2;
        brazoIz.add(meshBrazoIz);
        const antebrazoIz = new THREE.Object3D();
        antebrazoIz.position.y = -largoBrazo;
        antebrazoIz.rotation.x = -Math.PI / 4;
        brazoIz.add(antebrazoIz);
        const meshAntebrazoIz = new THREE.Mesh(geoBrazo, matCuerpo);
        meshAntebrazoIz.position.y = -largoBrazo / 2;
        antebrazoIz.add(meshAntebrazoIz);

        // Brazo derecho: clon del izquierdo.
        const brazoDe = brazoIz.clone();
        brazoDe.position.set(xHombro, yHombro, 0);
        base.add(brazoDe);
        this.brazoDe = brazoDe;     // para animar el tajo

        // Espada en la mano derecha (cosmética).
        const espada = new THREE.Mesh(new THREE.BoxGeometry(7, 85, 7), matSombrero);
        espada.position.set(0, -80, 20);
        espada.rotation.x = -Math.PI / 4;
        brazoDe.add(espada);

        // --- Sombrero: ala + cono ---
        const ala = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 4, 16), matSombrero);
        ala.position.y = rCabeza * 0.8;
        cabeza.add(ala);
        const conoSombrero = new THREE.Mesh(new THREE.ConeGeometry(18, 44, 16), matSombrero);
        conoSombrero.position.y = rCabeza * 0.8 + 24;
        conoSombrero.rotation.x = -0.1;   // ligeramente ladeado
        cabeza.add(conoSombrero);

        // --- Ojos (al frente, -Z) ---
        const matOjos = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const geoOjo = new THREE.CylinderGeometry(1.5, 1.5, 10, 12);
        const ojoIzq = new THREE.Mesh(geoOjo, matOjos);
        ojoIzq.position.set(-7, 2, rCabeza - 2);
        cabeza.add(ojoIzq);
        const ojoDer = new THREE.Mesh(geoOjo, matOjos);
        ojoDer.position.set(7, 2, rCabeza - 2);
        cabeza.add(ojoDer);

        base.rotation.y = Math.PI;   // el frente del muñeco mira a -Z
        this.mesh.add(base);
        this.mesh.position.set(x, 0, z);

        // --- Cono del tajo (área en el suelo) ---
        // Sector de 120° con radio = alcance de la espada.
        const geoCono = new THREE.CircleGeometry(this.alcanceEspada, 32, Math.PI / 6, 2 * Math.PI / 3);
        const matCono = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
        this.conoAtaque = new THREE.Mesh(geoCono, matCono);
        this.conoAtaque.rotation.x = -Math.PI / 2;   // tumbado sobre el suelo
        this.conoAtaque.position.y = 1;              // justo por encima del suelo
        this.conoAtaque.visible = false;
        this.mesh.add(this.conoAtaque);
        this.conoTimer = 0;                          // s que sigue visible

        // --- Rectángulo de la bola de fuego (área en el suelo) ---
        const geoRect = new THREE.PlaneGeometry(this.anchoFuego, this.alcanceFuego);
        const matRect = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
        this.rectFuego = new THREE.Mesh(geoRect, matRect);
        this.rectFuego.rotation.x = -Math.PI / 2;                  // tumbado en el suelo
        this.rectFuego.position.set(0, 1, -this.alcanceFuego / 2); // centrado hacia delante
        this.rectFuego.visible = false;
        this.mesh.add(this.rectFuego);
        this.fuegoDebugTimer = 0;
    }

    update(dt, keys, colisiona, vectorEnemies, visionBloqueada, factorVelocidad) {
        // Controles de tanque: A/D giran, W/S avanzan.

        // Giro con A/D.
        if (keys['KeyA']) this.mesh.rotation.y += this.velGiro * dt;  // izquierda
        if (keys['KeyD']) this.mesh.rotation.y -= this.velGiro * dt;  // derecha

        // Avance con W/S.
        let mov = 0;
        if (keys['KeyW']) mov += 1;   // adelante
        if (keys['KeyS']) mov -= 1;   // atrás

        // Por defecto se corre; Shift camina despacio (para maniobrar con cuidado).
        // La penalización de maleza se aplica aparte; velocidad solo de este frame.
        const lento = keys['ShiftLeft'] || keys['ShiftRight'];
        const factorMaleza = factorVelocidad(this.mesh.position.x, this.mesh.position.z);
        const velocidad = this.velocidad * (lento ? 1 : 4) * factorMaleza;

        // Frente del muñeco (-Z local) según rotation.y.
        const rot = this.mesh.rotation.y;
        const frenteX = -Math.sin(rot);
        const frenteZ = -Math.cos(rot);

        // Un eje cada vez, para deslizar contra los muros.
        const nextX = this.mesh.position.x + frenteX * mov * velocidad * dt;
        if (!colisiona(nextX, this.mesh.position.z, this.radio, this)) {
            this.mesh.position.x = nextX;
        }
        const nextZ = this.mesh.position.z + frenteZ * mov * velocidad * dt;
        if (!colisiona(this.mesh.position.x, nextZ, this.radio, this)) {
            this.mesh.position.z = nextZ;
        }

        // Balanceo de piernas al moverse.
        this.pasoFase = animarPiernas(this.piernas, dt, mov !== 0, this.pasoFase);

        // Espada con clic izquierdo (con cooldown).
        if (this.swordTimer > 0) this.swordTimer -= dt;
        if (keys['leftClick'] && this.swordTimer <= 0) {
            this.attackSword(vectorEnemies, visionBloqueada);
            this.swordTimer = this.swordCooldown;
            this.animarEspada();              // gesto del tajo
            this.conoAtaque.visible = true;   // muestra el área del tajo
            this.conoTimer = 0.5;
        }

        // Bola de fuego con clic derecho (gasta maná, con cooldown).
        if (this.fireTimer > 0) this.fireTimer -= dt;
        if (keys['rightClick'] && this.mana >= this.costeFuego && this.fireTimer <= 0) {
            this.attackFire(vectorEnemies, visionBloqueada);
            this.fireTimer = this.fireCooldown;
            this.mana -= this.costeFuego;
            // Ajusta el rectángulo al alcance actual.
            this.rectFuego.scale.y = this.alcanceFuego / this.alcanceFuegoBase;
            this.rectFuego.position.z = -this.alcanceFuego / 2;
            this.rectFuego.visible = true;   // muestra el área de fuego
            this.fuegoDebugTimer = 0.5;
        }

        // Oculta el cono tras 0.5 s.
        if (this.conoTimer > 0) {
            this.conoTimer -= dt;
            if (this.conoTimer <= 0) this.conoAtaque.visible = false;
        }
        // Oculta el rectángulo de fuego tras 0.5 s.
        if (this.fuegoDebugTimer > 0) {
            this.fuegoDebugTimer -= dt;
            if (this.fuegoDebugTimer <= 0) this.rectFuego.visible = false;
        }
    }

    // Gesto del tajo: el brazo derecho golpea hacia delante y vuelve al reposo. Estético.
    animarEspada() {
        if (!this.brazoDe) return;
        const arm = this.brazoDe;
        if (this._tweenEspada) this._tweenEspada.stop();
        arm.rotation.x = -1.6;                          // brazo levantado hacia atrás/arriba
        this._tweenEspada = new TWEEN.Tween(arm.rotation)
            .to({ x: 0.7 }, 150)                        // golpe hacia delante
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
                this._tweenEspada = new TWEEN.Tween(arm.rotation)
                    .to({ x: 0 }, 220)                  // regreso suave al reposo
                    .easing(TWEEN.Easing.Quadratic.InOut)
                    .start();
            })
            .start();
    }

    // Daña a los enemigos dentro de un cono de 120° al frente, si no hay muro en medio.
    attackSword(vectorEnemies, visionBloqueada) {
        const ALCANCE = this.alcanceEspada;                       // alcance corto (melee)
        const conoCos = Math.cos(THREE.MathUtils.degToRad(60));   // semiángulo 60° -> cono de 120°
        const DANO = this.danoEspada;

        // Frente del jugador (-Z).
        const rot = this.mesh.rotation.y;
        const fx = -Math.sin(rot);
        const fz = -Math.cos(rot);

        for (const enemy of vectorEnemies) {
            if (enemy.hp <= 0) continue;                          // ya muerto

            const dx = enemy.mesh.position.x - this.mesh.position.x;
            const dz = enemy.mesh.position.z - this.mesh.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist === 0 || dist > ALCANCE) continue;           // fuera de alcance

            const nx = dx / dist, nz = dz / dist;
            if (fx * nx + fz * nz < conoCos) continue;            // fuera del cono

            // un muro corta el tajo
            if (visionBloqueada(this.mesh.position.x, this.mesh.position.z,
                                enemy.mesh.position.x, enemy.mesh.position.z, this.altura)) continue;

            enemy.hp -= DANO;
        }
    }

    // Daña a los enemigos dentro de un rectángulo al frente, si no hay muro en medio.
    attackFire(vectorEnemies, visionBloqueada) {
        const LARGO = this.alcanceFuego;
        const SEMIANCHO = this.anchoFuego / 2;
        const DANO = this.danoFuego;

        // Frente (-Z) y su perpendicular.
        const rot = this.mesh.rotation.y;
        const fx = -Math.sin(rot), fz = -Math.cos(rot);   // hacia delante
        const rx = -fz, rz = fx;                          // perpendicular (lateral)

        for (const enemy of vectorEnemies) {
            if (enemy.hp <= 0) continue;

            const dx = enemy.mesh.position.x - this.mesh.position.x;
            const dz = enemy.mesh.position.z - this.mesh.position.z;

            // Proyección del enemigo sobre los ejes del jugador
            const along = dx * fx + dz * fz;              // distancia hacia delante
            if (along < 0 || along > LARGO) continue;     // detrás o más lejos del alcance
            const lateral = dx * rx + dz * rz;            // desplazamiento a los lados
            if (Math.abs(lateral) > SEMIANCHO) continue;  // fuera del ancho del rectángulo

            // un muro corta el fuego
            if (visionBloqueada(this.mesh.position.x, this.mesh.position.z,
                                enemy.mesh.position.x, enemy.mesh.position.z, this.altura)) continue;

            enemy.hp -= DANO;
        }
    }

    muerte() {
        this.mesh.traverse((obj) => {
            if (obj.isMesh) {
                obj.geometry.dispose();
                if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
                else obj.material.dispose();
            }
        });
        if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    }
}
