import * as THREE from 'three';
import { crearHumanoide, animarPiernas } from './humanoid.js';
import { TWEEN } from '../lib/tween.module.min.js';
import { texturaRuido } from './texturas.js';

// Textura de tela compartida; muerte() no la libera (otros enemigos la usan).
const texTela = texturaRuido(1);

/**
 * Enemigo encapuchado: humanoide con capucha y capa, tamaño (y vida) aleatorios.
 * IA de patrulla/persecución con visión por cono y ataque cuerpo a cuerpo con aviso.
 */
export class Enemy {
    constructor(x = 0, z = 0) {
        this.mesh = new THREE.Object3D();
        this.radio = 50;
        this.danoAtaque = 20;        // lo escala la dificultad del nivel
        this.attackCooldown = 2.5;   // s entre golpes
        this.attackTimer = 0;        // 0 = listo
        this.alcanceAttack = 120;    // menor que la espada del jugador (150)
        this.windupDur = 0.7;        // aviso antes de golpear (margen para esquivar)
        this.windupTimer = 0;
        this.cargando = false;       // quieto mientras avisa

        // Tamaño aleatorio: escala el modelo, y la vida es proporcional.
        const t = Math.random();
        const escala = 0.85 + t * 0.5;
        this.hp = 60 + t * 80;      // la dificultad del nivel la multiplica aparte

        // --- Modelo ---
        const matCuerpo = new THREE.MeshStandardMaterial({ color: 0x6b3330, map: texTela });           // torso rojo apagado
        const matOscuro = new THREE.MeshStandardMaterial({ color: 0x241616, map: texTela });           // piernas/botas
        const matCara   = new THREE.MeshStandardMaterial({ color: 0x120a0a });                         // cara casi negra
        const matTela   = new THREE.MeshStandardMaterial({ color: 0x2a1a1a, map: texTela, side: THREE.DoubleSide }); // capucha + capa

        const rCabeza = 18;
        const h = crearHumanoide({
            matCuerpo, matPiernas: matOscuro, matCabeza: matCara,
            altPiernas: 45, altTorso: 50, rHombros: 24, rCintura: 16, rCabeza,
        });
        const base = h.grupo;
        base.scale.setScalar(escala);
        this.base = base;               // para animar el giro al atacar
        const cabeza = h.cabeza;
        this.piernas = h.piernas;       // para animar el paso
        this.pasoFase = 0;

        // Altura de los ojos para la línea de visión (ya escalada).
        this.altura = h.yCabeza * escala;

        // --- Capucha: abierta por delante, deja la cara en sombra ---
        const capucha = new THREE.Group();
        const atras = new THREE.Mesh(
            new THREE.SphereGeometry(rCabeza * 1.25, 16, 12, Math.PI * 0.25, Math.PI * 1.5),
            matTela
        );
        atras.rotation.y = Math.PI / 2;
        atras.position.z = -2;
        capucha.add(atras);
        const punta = new THREE.Mesh(new THREE.ConeGeometry(rCabeza * 1.25, rCabeza * 1.9, 12), matTela);
        punta.position.set(0, rCabeza * 0.95, -5);
        punta.rotation.x = -Math.PI * 0.08;   // caída hacia atrás
        capucha.add(punta);
        cabeza.add(capucha);

        // --- Capa: cilindro abierto que cubre 270° (frente, izquierda y espalda) y
        // deja el hueco a la derecha (thetaStart 45°, thetaLength 270°) ---
        const capa = new THREE.Mesh(
            new THREE.CylinderGeometry(24, 46, 92, 16, 1, true, Math.PI / 4, 3 * Math.PI / 2),
            matTela
        );
        capa.position.y = 47;   // de los hombros casi al suelo
        base.add(capa);

        // --- Ojos tenues (lo único que se intuye bajo la capucha) ---
        const matOjos = new THREE.MeshBasicMaterial({ color: 0x993333 });
        const geoOjo = new THREE.SphereGeometry(2, 8, 8);
        const ojoIzq = new THREE.Mesh(geoOjo, matOjos);
        ojoIzq.position.set(-6, 2, rCabeza - 1);
        cabeza.add(ojoIzq);
        const ojoDer = new THREE.Mesh(geoOjo, matOjos);
        ojoDer.position.set(6, 2, rCabeza - 1);
        cabeza.add(ojoDer);

        this.mesh.add(base);
        this.mesh.position.set(x, 0, z);

        // --- Estado de IA ---
        this.velocidad = 150;
        this.estado = 'PATRULLA';     // 'PATRULLA' | 'PERSIGUE'

        // Visión: cono de 140° (70° a cada lado).
        this.visionDist = 2000;
        this.visionCos = Math.cos(THREE.MathUtils.degToRad(70)); // coseno del semiángulo

        this.distParada = 100;         // se acerca casi al contacto

        // Ruta de patrulla: cuadrado alrededor del punto de aparición.
        const r = 200;
        this.ruta = [
            new THREE.Vector3(x + r, 0, z),
            new THREE.Vector3(x, 0, z + r),
            new THREE.Vector3(x - r, 0, z),
            new THREE.Vector3(x, 0, z - r),
        ];
        this.wp = 0;                  // índice del waypoint actual
        this.stuckTimer = 0;          // s bloqueado sin avanzar
        this.lostTimer = 0;           // s sin ver al jugador

        // Aviso de ataque: círculo rojo en el suelo con el radio del golpe.
        const geoAviso = new THREE.CircleGeometry(this.alcanceAttack, 32);
        const matAviso = new THREE.MeshBasicMaterial({
            color: 0xff3030, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
        });
        this.telegraph = new THREE.Mesh(geoAviso, matAviso);
        this.telegraph.rotation.x = -Math.PI / 2;   // tumbado en el suelo
        this.telegraph.position.y = 1;              // justo por encima del suelo
        this.telegraph.visible = false;
        this.mesh.add(this.telegraph);
    }

    update(dt, player, colisiona, visionBloqueada, factorVelocidad) {
        // Muerto: no actúa; main.js lo elimina.
        if (this.hp <= 0) return;

        // Vector al jugador y distancia (en XZ).
        const dx = player.mesh.position.x - this.mesh.position.x;
        const dz = player.mesh.position.z - this.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        // Si lo ve, PERSIGUE; si lo pierde 5 s seguidos, vuelve a PATRULLA.
        if (this.puedeVer(dx, dz, dist, player, visionBloqueada)) {
            this.estado = 'PERSIGUE';
            this.lostTimer = 0;
        } else if (this.estado === 'PERSIGUE') {
            this.lostTimer += dt;
            if (this.lostTimer > 5) {
                this.estado = 'PATRULLA';
                this.lostTimer = 0;
                this.stuckTimer = 0;   // empieza la patrulla sin arrastrar atasco
            }
        }

        // Velocidad de este frame (penalizada por la maleza).
        const velocidad = this.velocidad * factorVelocidad(this.mesh.position.x, this.mesh.position.z);

        // Durante el aviso se queda quieto. Guardo la posición para saber si avanzó.
        const antX = this.mesh.position.x, antZ = this.mesh.position.z;
        if (!this.cargando) {
            if (this.estado === 'PERSIGUE') {
                this.perseguir(dt, dx, dz, dist, colisiona, velocidad);
            } else {
                this.patrullar(dt, colisiona, velocidad);
            }
        }

        // Balanceo de piernas si se ha movido.
        const moviendo = Math.hypot(this.mesh.position.x - antX, this.mesh.position.z - antZ) > 0.5;
        this.pasoFase = animarPiernas(this.piernas, dt, moviendo, this.pasoFase);

        // Ataque con aviso: si el cooldown está listo y el jugador a alcance, avisa;
        // al acabar el aviso golpea solo si sigue dentro del alcance.
        if (this.attackTimer > 0) this.attackTimer -= dt;

        if (this.cargando) {
            this.windupTimer -= dt;
            if (this.windupTimer <= 0) {
                this.cargando = false;
                this.telegraph.visible = false;
                this.enemyAttack(player);            // daña solo si el jugador sigue cerca
                this.animarGiro();                   // giro de molinete (estético)
                this.attackTimer = this.attackCooldown;
            }
        } else if (this.attackTimer <= 0 && dist <= this.alcanceAttack) {
            this.cargando = true;                    // empieza el aviso
            this.windupTimer = this.windupDur;
            this.telegraph.visible = true;
        }
    }

    // Giro de molinete al atacar: una vuelta completa suavizada. Solo estético.
    animarGiro() {
        if (!this.base) return;
        const b = this.base;
        if (this._tweenGiro) this._tweenGiro.stop();
        b.rotation.y = 0;
        this._tweenGiro = new TWEEN.Tween(b.rotation)
            .to({ y: Math.PI * 2 }, 400)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onComplete(() => { b.rotation.y = 0; })
            .start();
    }

    // ¿El jugador está dentro del cono de visión y del alcance?
    puedeVer(dx, dz, dist, player, visionBloqueada) {
        if (dist === 0 || dist > this.visionDist) return false;
        const nx = dx / dist, nz = dz / dist;
        // Frente del enemigo: sus ojos miran a +Z, girado por rotation.y.
        const rot = this.mesh.rotation.y;
        const fx = Math.sin(rot), fz = Math.cos(rot);
        // Producto escalar = coseno del ángulo; por debajo del umbral, fuera del cono.
        if ((fx * nx + fz * nz) < this.visionCos) return false;

        // ¿Un muro corta la visión a la altura de sus ojos? Entonces está escondido.
        if (visionBloqueada(this.mesh.position.x, this.mesh.position.z,
                            player.mesh.position.x, player.mesh.position.z,
                            this.altura)) {
            return false;
        }
        return true;
    }

    // Persecución: mira al jugador y avanza recto, salvo que ya esté a distancia de parada.
    perseguir(dt, dx, dz, dist, colisiona, velocidad) {
        this.mesh.rotation.y = Math.atan2(dx, dz);   // los ojos (+Z) apuntan al jugador
        if (dist > this.distParada) {
            const nextX = this.mesh.position.x + (dx / dist) * velocidad * dt;
            if (!colisiona(nextX, this.mesh.position.z, this.radio, this)) this.mesh.position.x = nextX;
            const nextZ = this.mesh.position.z + (dz / dist) * velocidad * dt;
            if (!colisiona(this.mesh.position.x, nextZ, this.radio, this)) this.mesh.position.z = nextZ;
        }
    }

    // Patrulla: recorre los waypoints de la ruta en bucle.
    patrullar(dt, colisiona, velocidad) {
        const destino = this.ruta[this.wp];
        const dx = destino.x - this.mesh.position.x;
        const dz = destino.z - this.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 10) {                              // llegó: al siguiente (cíclico)
            this.wp = (this.wp + 1) % this.ruta.length;
            this.stuckTimer = 0;                      // llegó: reinicia el atasco
            return;
        }
        this.mesh.rotation.y = Math.atan2(dx, dz);

        // Posición antes de moverse, para detectar si se queda bloqueado.
        const antesX = this.mesh.position.x;
        const antesZ = this.mesh.position.z;

        const nextX = this.mesh.position.x + (dx / dist) * velocidad * dt;
        if (!colisiona(nextX, this.mesh.position.z, this.radio, this)) this.mesh.position.x = nextX;
        const nextZ = this.mesh.position.z + (dz / dist) * velocidad * dt;
        if (!colisiona(this.mesh.position.x, nextZ, this.radio, this)) this.mesh.position.z = nextZ;

        // Si lleva más de 5 s sin avanzar (bloqueado), pasa al siguiente waypoint.
        const movido = Math.hypot(this.mesh.position.x - antesX, this.mesh.position.z - antesZ);
        if (movido < 0.01) {
            this.stuckTimer += dt;
            if (this.stuckTimer > 5) {
                this.wp = (this.wp + 1) % this.ruta.length;
                this.stuckTimer = 0;
            }
        } else {
            this.stuckTimer = 0;   // se ha movido: reinicia el contador
        }
    }

    // Golpe cuerpo a cuerpo: solo por distancia. Devuelve true si acierta.
    enemyAttack(player) {
        if (player.hp <= 0) return false;
        const dx = player.mesh.position.x - this.mesh.position.x;
        const dz = player.mesh.position.z - this.mesh.position.z;
        if (Math.hypot(dx, dz) > this.alcanceAttack) return false;   // ya no está a alcance
        player.hp -= this.danoAtaque;
        return true;
    }

    // Saca al enemigo de la escena y libera geometría y materiales.
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
