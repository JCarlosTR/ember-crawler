import * as THREE from 'three';
import { Enemy } from './enemy.js';
import { Player } from './player.js';
import { mapElement } from './mapElement.js';
import { Treasure } from './treasure.js';
import { Tree, crearMallaTroncos } from './tree.js';
import { Maleza } from './maleza.js';
import { asignarBarraSalud, actualizarBarraSalud } from './healthBar.js';
import { crearHUD, actualizarHUD, mostrarPausa, ocultarPausa, mostrarFinPartida, actualizarItems, actualizarScore, actualizarNivel, mostrarFundido, ocultarFundido } from './hud.js';
import { TWEEN } from '../lib/tween.module.min.js';
import { Item } from './item.js';
import { Rock } from './rock.js';
import { texturaCesped, texturaPiedra } from './texturas.js';
import Stats from '../lib/stats.module.js';

// Suelo: césped procedural y su material, reutilizados entre niveles.
const texSuelo = texturaCesped(1);
const matSuelo = new THREE.MeshStandardMaterial({ map: texSuelo });

let renderer, scene, camera, sol, stats;
let player, clock;
let vectorEnemies = [];    // enemigos vivos
let vectorObstaculos = []; // obstáculos estáticos (muros, árboles, rocas)
let obstaculoMeshes = [];  // sus meshes, para el raycast de cámara
let vectorEntidades = [];  // jugador + enemigos (colisión círculo-círculo)
let vectorMaleza = [];     // zonas que ralentizan
let vectorItems = [];      // items recogibles
let efectos = [];          // partículas temporales
let pausado = false;       // menú de pausa abierto
let gameOver = false;      // partida terminada
let killCounter = 0;       // enemigos eliminados en la partida
let treasureCounter = 0;   // cofres conseguidos
let treasure;              // cofre actual
let suelo;                 // suelo del nivel actual
let mallaTroncos = null;   // todos los troncos del bosque en una malla
let spawnTimer = 0;        // acumula dt para el spawn por tiempo
let nivel = 1;             // nivel actual
let dificultad = 1;        // multiplicador de vida/daño (sube por nivel)
let velEnemigos = 1;       // multiplicador de velocidad (sube por nivel)
let rangoAtaque = 1;       // multiplicador de alcance de ataque (sube por nivel)
let transicionTimer = 0;   // >0 durante el cambio de nivel
let score = 0;             // puntuación
let killsNivel = 0;        // kills del nivel (bonus si pasas sin matar)
const SPAWN_INTERVAL = 30; // segundos entre spawns (base del nivel 1)
let spawnInterval = SPAWN_INTERVAL;  // intervalo efectivo (baja por nivel)
let maxEnemigos = 12;      // tope de enemigos vivos a la vez
const keys = {};   // estado de teclas
const POOL_ITEMS = ['botas', 'espada', 'reloj', 'orbe', 'pocion'];
const MIN_SPAWN_DIST = 1500;   // distancia mínima a la que spawnean los enemigos
let nivelConstruido = true;    // false mientras la transición espera para reconstruir
let pickupsColocados = [];      // posiciones de cofre e items (anti-solape)
const TAMANOS_NIVEL = [5000, 7000, 9000];   // tamaño del mapa por nivel; del 4 en adelante, 15000
const itemCounts = { botas: 0, espada: 0, reloj: 0, orbe: 0, pocion: 0 };   // items recogidos (para el HUD)

// Cámara en 3ª persona, detrás del jugador
const EJE_Y = new THREE.Vector3(0, 1, 0);
const CAM_DISTANCIA = 500;  // distancia por detrás
const CAM_ALTURA = 300;     // altura de la cámara
const CAM_MIRA_Y = 180;     // altura del punto al que mira (torso)
const CAM_DESPLAZAMIENTO = 0;
let tamanoMapa = 15000;     // tamaño del mapa actual (lo fija construirNivel)
let distCamaraActual = 600; // distancia actual (se suaviza hacia la ideal)

function init() {
    // Fondo y niebla comparten color: los árboles lejanos se disuelven en el cielo
    // en vez de aparecer de golpe en el plano lejano. Tono crepuscular, frío y oscuro.
    const colorCielo = 0x3d4254;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(new THREE.Color(colorCielo));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // bordes de sombra suavizados
    document.getElementById('container').appendChild(renderer.domElement);

    scene = new THREE.Scene();

    // Niebla que hacia ~3500 u ya tapa los árboles, antes de que lleguen al far (7000):
    // oculta el pop-in y cierra el horizonte en penumbra.
    scene.fog = new THREE.FogExp2(colorCielo, 0.0005);

    const aspectRatio = window.innerWidth / window.innerHeight;
    // far 7000: la niebla oculta la carga; el margen extra evita cortes al girar,
    // porque el sol/sombra va por detrás del jugador.
    camera = new THREE.PerspectiveCamera(50, aspectRatio, 1, 7000);
    camera.position.set(350, 350, 320);

    // Sin OrbitControls: la posiciona update() cada frame.

    window.addEventListener('resize', updateAspectRatio);

    // Reloj para el delta time y escuchas de entrada.
    clock = new THREE.Clock();
    window.addEventListener('keydown', (e) => { keys[e.code] = true;  });
    window.addEventListener('keyup',   (e) => { keys[e.code] = false; });
    // Clics del ratón tratados como teclas (leftClick / rightClick).
    window.addEventListener('mousedown', (e) => {
        if (e.button === 0) keys['leftClick']  = true;
        if (e.button === 2) keys['rightClick'] = true;
    });
    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) keys['leftClick']  = false;
        if (e.button === 2) keys['rightClick'] = false;
    });
    // Sin menú contextual al usar clic derecho.
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Pausa con Esc. !e.repeat evita que mantenerla pulsada la active en bucle.
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape' && !e.repeat && !gameOver) togglePausa();
    });

    // HUD 2D con las acciones de los botones.
    crearHUD({
        onReanudar:     () => togglePausa(),
        onTerminar:     () => finDePartida(),
        onVolverAJugar: () => location.reload(),   // recarga la página
    });

    // Medidor de rendimiento (FPS/ms). Clic en el panel alterna FPS/ms/memoria.
    stats = new Stats();
    stats.showPanel(0);
    stats.dom.style.left = 'auto';
    stats.dom.style.right = '0';
    stats.dom.style.top = '72px';   // debajo de Nivel y Puntuación
    document.body.appendChild(stats.dom);
}

function loadScene() {
    // --- Iluminación de crepúsculo (permanente) ---
    // "Sol" bajo y cálido: luz rasante de atardecer que contrasta con el cielo frío.
    sol = new THREE.DirectionalLight(0xffb27a, 0.85);
    // Luz paralela: alejarla no cambia el sombreado, solo sube su cámara de sombra
    // por encima de los árboles. Luego se recoloca siguiendo al jugador.
    sol.position.set(-4000, 1760, 2400);
    sol.castShadow = true;

    // Caja de sombra ortográfica alrededor del jugador, algo mayor que el alcance de
    // la niebla (~3500) para que las sombras ya estén puestas al salir de la bruma.
    sol.shadow.mapSize.set(4096, 4096);
    sol.shadow.camera.near = 1;
    sol.shadow.camera.far  = 9000;               // margen sobre la posición del sol + la caja
    sol.shadow.camera.left   = -3600;
    sol.shadow.camera.right  =  3600;
    sol.shadow.camera.top    =  3600;
    sol.shadow.camera.bottom = -3600;
    sol.shadow.bias       = -0.0005;             // evita el rayado (shadow acne) en el suelo
    sol.shadow.normalBias =  1.5;                // evita el despegue de la sombra
    sol.shadow.camera.updateProjectionMatrix();
    scene.add(sol);
    scene.add(sol.target);                       // el target debe estar en la escena para moverlo

    // Relleno hemisférico frío: cielo azulado arriba, rebote oscuro del suelo abajo.
    // Evita que las caras en sombra queden completamente negras.
    const luzCielo = new THREE.HemisphereLight(0x6a7299, 0x14161f, 0.55);
    scene.add(luzCielo);

    // Baldosa de piedra en el centro: marca el punto de aparición del jugador.
    const marcaCentro = new THREE.Mesh(
        new THREE.PlaneGeometry(120, 120),
        new THREE.MeshStandardMaterial({ map: texturaPiedra(1) })
    );
    marcaCentro.rotation.x = -Math.PI / 2;
    marcaCentro.position.y = 1.5;                 // justo sobre el suelo (evita z-fighting)
    marcaCentro.receiveShadow = true;
    scene.add(marcaCentro);

    // Jugador (permanente; se recoloca en cada nivel).
    player = new Player();
    scene.add(player.mesh);
    activarSombras(player.mesh);

    // Primer nivel; construirNivel() se repite al tocar el cofre.
    construirNivel(1);
}

// Tamaño del mapa por nivel: pequeño al principio, grande desde el nivel 4.
function tamanoDeNivel(n) {
    return TAMANOS_NIVEL[n - 1] ?? 15000;
}

// Construye (o reconstruye) un nivel: limpia el anterior, fija tamaño y dificultad,
// y genera suelo, muros, bosque, maleza, enemigos, cofre e items.
function construirNivel(n) {
    limpiarNivel();

    tamanoMapa = tamanoDeNivel(n);

    // Dificultad sin techo: cada nivel los enemigos aguantan y pegan más, van más
    // rápidos, aparecen más seguido y caben más a la vez.
    dificultad  = 1 + (n - 1) * 0.3;                            // +30% vida y daño por nivel
    velEnemigos = 1 + (n - 1) * 0.08;                           // +8% velocidad por nivel
    rangoAtaque = 1 + (n - 1) * 0.05;                           // +5% alcance por nivel
    spawnInterval = Math.max(2.5, 30 * Math.pow(0.88, n - 1));  // spawns cada vez más rápidos (mín 2.5 s)
    maxEnemigos = Math.min(40, 12 + (n - 1) * 3);              // más enemigos a la vez (tope 40)
    killsNivel = 0;                                             // reinicia el contador del nivel
    spawnTimer = 0;
    pickupsColocados = [];                                      // anti-solape de cofre e items
    actualizarNivel(n);

    // Suelo del tamaño del mapa, con césped tileado (~1 baldosa cada 450 u).
    texSuelo.repeat.set(tamanoMapa / 450, tamanoMapa / 450);
    suelo = new THREE.Mesh(new THREE.PlaneGeometry(tamanoMapa, tamanoMapa), matSuelo);
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    scene.add(suelo);

    // Jugador al centro; única entidad de colisión al empezar.
    player.mesh.position.set(0, 0, 0);
    player.mesh.rotation.y = 0;
    vectorEntidades = [player];

    // Muros perimetrales (uno por lado, del ancho del mapa).
    const semial = tamanoMapa / 2;
    const grosor = 200, altoMuro = 400;
    spawnMapElement(0, -semial, tamanoMapa, altoMuro, grosor);   // sur
    spawnMapElement(0,  semial, tamanoMapa, altoMuro, grosor);   // norte
    spawnMapElement(-semial, 0, grosor, altoMuro, tamanoMapa);   // oeste
    spawnMapElement( semial, 0, grosor, altoMuro, tamanoMapa);   // este

    // Bosque (nº de árboles proporcional al área del mapa).
    generarBosque();

    // Rocas: spawnRoca busca un hueco acorde a su tamaño (sin solapar).
    const numRocas = 4 + Math.floor(Math.random() * 4);   // 4-7
    for (let i = 0; i < numRocas; i++) spawnRoca();

    // Maleza: parches que ralentizan, en zonas libres.
    for (let i = 0; i < 3; i++) {
        const p = posicionLibre(300, 600);
        spawnMaleza(p.x, p.z, 400 + Math.random() * 300, 400 + Math.random() * 300);
    }

    // Enemigos iniciales (más por nivel, con tope), en posiciones libres.
    const numEnemigos = Math.min(6 + (n - 1) * 2, maxEnemigos);
    for (let i = 0; i < numEnemigos; i++) {
        const p = posicionLibre(60, 600);
        spawnEnemy(p.x, p.z);
    }

    // Un solo cofre, en posición libre.
    const pc = posicionLibre(120, 500);
    spawnTreasure(pc.x, pc.z);

    // De 2 a 4 items aleatorios, en posiciones libres.
    const numItems = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numItems; i++) {
        const p = posicionLibre(100, 500);
        spawnItem(p.x, p.z, tipoItemAleatorio());
    }
}

// Libera todo lo del nivel anterior y vacía los vectores.
function limpiarNivel() {
    for (const e of vectorEnemies) e.muerte();          // dispose + quitar de escena
    vectorEnemies = [];

    for (const o of vectorObstaculos) quitarDeEscena(o.mesh, o.disponerMaterial === true);  // muros: material/textura propios; árboles/rocas: compartido
    vectorObstaculos = [];
    obstaculoMeshes = [];

    for (const m of vectorMaleza) quitarDeEscena(m.mesh, false);      // maleza comparte material
    vectorMaleza = [];

    for (const it of vectorItems) quitarDeEscena(it.mesh, false);   // modelos con materiales compartidos
    vectorItems = [];

    if (treasure)     { scene.remove(treasure.mesh);          treasure = null; }   // modelo glTF compartido (no liberar)
    if (mallaTroncos) { quitarDeEscena(mallaTroncos, false);  mallaTroncos = null; }   // matCorteza compartido
    if (suelo)        { quitarDeEscena(suelo, false);         suelo = null; }   // matSuelo/texSuelo compartidos

    vectorEntidades = player ? [player] : [];
}

// Bosque en arboledas por muestreo con rechazo. El nº de árboles es proporcional al
// área del mapa, y se deja un claro central en el punto de aparición.
function generarBosque() {
    const limiteMapa = tamanoMapa / 2;
    const radioMin = 750;                                     // claro central (0,0)
    const numArboles = Math.round(800 * Math.pow(tamanoMapa / 15000, 2));
    const maxIntentos = numArboles * 30 + 1000;              // tope de seguridad

    const radioTroncoArbol = 30;
    const diametroJugador = 100;                              // radio 50 * 2
    const margen = 50;                                        // espacio extra para no pasar rozando
    const distanciaMinima = (radioTroncoArbol * 2) + diametroJugador + margen;

    const arbolesGuardados = [];
    const troncos = [];          // {x,z,altura} de cada árbol, para fundir los troncos
    let intentos = 0;

    while (arbolesGuardados.length < numArboles && intentos < maxIntentos) {
        intentos++;
        let x, z;

        // 70%: nace pegado a otro ya existente (arboleda).
        if (arbolesGuardados.length > 0 && Math.random() < 0.70) {
            const arbolPadre = arbolesGuardados[Math.floor(Math.random() * arbolesGuardados.length)];
            const anguloLocal = Math.random() * Math.PI * 2;
            const distanciaLocal = distanciaMinima + (Math.random() * 300);
            x = arbolPadre.x + Math.cos(anguloLocal) * distanciaLocal;
            z = arbolPadre.z + Math.sin(anguloLocal) * distanciaLocal;
            if (Math.hypot(x, z) < radioMin) continue;       // no dentro del claro central
        } else {
            // 30%: árbol solitario (nuevo foco).
            const theta = Math.random() * Math.PI * 2;
            const rr = Math.sqrt(Math.random()) * (limiteMapa - radioMin) + radioMin;
            x = rr * Math.cos(theta);
            z = rr * Math.sin(theta);
        }

        // Margen con el borde para que ni la copa más grande (~290 r) toque el muro,
        // que ocupa 100 hacia dentro.
        const margenMuro = 400;
        if (Math.abs(x) > limiteMapa - margenMuro || Math.abs(z) > limiteMapa - margenMuro) continue;

        // Filtro de distancia mínima contra los ya plantados.
        let hayEspacio = true;
        for (let i = 0; i < arbolesGuardados.length; i++) {
            const otro = arbolesGuardados[i];
            if (Math.hypot(x - otro.x, z - otro.z) < distanciaMinima) { hayEspacio = false; break; }
        }

        if (hayEspacio) {
            arbolesGuardados.push({ x, z });
            const altura = 800 + Math.random() * 500;
            spawnArbol(x, z, altura);          // copa + caja de colisión
            troncos.push({ x, z, altura });    // el tronco se funde luego en la malla global
        }
    }

    // Todos los troncos en una malla con textura de corteza (1 draw call).
    if (troncos.length > 0) {
        mallaTroncos = crearMallaTroncos(troncos);
        scene.add(mallaTroncos);
        activarSombras(mallaTroncos);
    }
}

// Posición libre dentro del mapa (sin chocar ni caer en el claro). (0,0) si no la halla.
function posicionLibre(radio, margenBorde = 400) {
    const limite = tamanoMapa / 2 - margenBorde;
    for (let i = 0; i < 80; i++) {
        const x = (Math.random() * 2 - 1) * limite;
        const z = (Math.random() * 2 - 1) * limite;
        if (Math.hypot(x, z) < 700) continue;          // no sobre el punto de aparición del jugador
        if (colisiona(x, z, radio, null)) continue;    // sobre árbol/muro/entidad
        if (pickupCerca(x, z, radio + 120)) continue;  // pegado a otro cofre/item
        return { x, z };
    }
    return { x: 0, z: 0 };
}

// ¿Hay ya un cofre/item colocado a menos de 'minDist' de (x, z)?
function pickupCerca(x, z, minDist) {
    for (const p of pickupsColocados) {
        if (Math.hypot(x - p.x, z - p.z) < minDist) return true;
    }
    return false;
}

// Activa sombras en las mallas iluminadas de un objeto. Filtrar por material deja
// fuera la UI (ojos, barras de vida, avisos), que no debe proyectar sombras.
function activarSombras(raiz) {
    raiz.traverse((o) => {
        if (o.isMesh && o.material && o.material.isMeshStandardMaterial) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });
}

// Crea un enemigo, lo añade a la escena y lo registra.
function spawnEnemy(x, z) {
    const enemy = new Enemy(x, z);
    // Escala de dificultad del nivel.
    enemy.hp *= dificultad;
    enemy.danoAtaque *= dificultad;
    enemy.velocidad *= velEnemigos;
    enemy.alcanceAttack *= rangoAtaque;             // golpe con más alcance
    enemy.telegraph.scale.setScalar(rangoAtaque);   // el aviso rojo del suelo crece acorde
    scene.add(enemy.mesh);
    activarSombras(enemy.mesh);
    vectorEnemies.push(enemy);        // para el bucle de IA
    vectorEntidades.push(enemy);      // para las colisiones círculo-círculo
    asignarBarraSalud(enemy);         // barra de vida flotante
    return enemy;
}

// Spawnea un enemigo lejos del jugador, en un hueco válido. Si no lo encuentra,
// usa el punto libre más lejano que haya probado.
function spawnEnemyAroundPlayer() {
    if (vectorEnemies.length >= maxEnemigos) return;   // no pasar del tope de enemigos vivos
    const px = player.mesh.position.x, pz = player.mesh.position.z;
    const limite = tamanoMapa / 2 - 300;               // margen para no meterse en el muro
    // Distancia mínima fija al jugador: no pueden salir encima, pero moverse rápido
    // deja menos aire, así que corre más riesgo.
    let mejor = null, mejorDist = -1;
    for (let i = 0; i < 30; i++) {
        const x = (Math.random() * 2 - 1) * limite;
        const z = (Math.random() * 2 - 1) * limite;
        if (colisiona(x, z, 60, null)) continue;                    // hueco válido (ni muro/árbol/entidad)
        const d = Math.hypot(x - px, z - pz);
        if (d >= MIN_SPAWN_DIST) { spawnEnemy(x, z); return; }       // lejos: no alcanzable al instante
        if (d > mejorDist) { mejorDist = d; mejor = { x, z }; }      // guarda el más lejano (mapas pequeños)
    }
    if (mejor) spawnEnemy(mejor.x, mejor.z);                         // lo más lejos que se pudo
}

// Crea un muro, lo añade a la escena y lo registra como obstáculo.
function spawnMapElement(x, z, anc, alt, prof) {
    const el = new mapElement(x, z, anc, alt, prof);
    scene.add(el.mesh);
    activarSombras(el.mesh);
    vectorObstaculos.push(el);
    obstaculoMeshes.push(el.mesh);
    return el;
}

// Crea el cofre. No es obstáculo: el jugador debe poder pisarlo, así que no se
// registra en vectorObstaculos.
function spawnTreasure(x, z) {
    treasure = new Treasure(x, z);
    scene.add(treasure.mesh);
    activarSombras(treasure.mesh);
    pickupsColocados.push({ x, z });    // para que los items no caigan encima del cofre
    return treasure;
}

// Crea un árbol (copa) y lo registra como obstáculo.
function spawnArbol(x, z, altura) {
    const arbol = new Tree(x, z, altura);
    scene.add(arbol.mesh);
    activarSombras(arbol.mesh);
    vectorObstaculos.push(arbol);
    obstaculoMeshes.push(arbol.mesh);
    return arbol;
}

// Crea una roca y la registra como obstáculo. Se construye primero para conocer su
// tamaño y buscar luego un hueco acorde (sin solapar).
function spawnRoca() {
    const roca = new Rock();                               // construida centrada en el origen
    const radio = Math.max(roca.semiAncho, roca.semiFondo);
    const p = posicionLibre(radio + 60, 600);             // hueco libre acorde a su tamaño
    roca.mesh.position.set(p.x, 0, p.z);
    scene.add(roca.mesh);
    activarSombras(roca.mesh);
    vectorObstaculos.push(roca);
    obstaculoMeshes.push(roca.mesh);
    return roca;
}

// Crea una maleza (zona que ralentiza) y la registra.
function spawnMaleza(x, z, ancho, fondo) {
    const m = new Maleza(x, z, ancho, fondo);
    scene.add(m.mesh);
    vectorMaleza.push(m);
    return m;
}

// Crea un item recogible y lo registra.
function spawnItem(x, z, tipo) {
    const item = new Item(x, z, tipo);
    scene.add(item.mesh);
    activarSombras(item.mesh);
    vectorItems.push(item);
    pickupsColocados.push({ x, z });    // para que cofre/items no se solapen entre sí
    return item;
}

// Un tipo de item al azar.
function tipoItemAleatorio() {
    return POOL_ITEMS[Math.floor(Math.random() * POOL_ITEMS.length)];
}

// Chispas de teletransporte que suben, caen y se desvanecen. Se usan al cambiar de nivel.
function efectoTeletransporte(x, z) {
    const N = 120;
    const posiciones = new Float32Array(N * 3);
    const velocidades = [];
    for (let i = 0; i < N; i++) {
        posiciones[i * 3]     = x;
        posiciones[i * 3 + 1] = 30;
        posiciones[i * 3 + 2] = z;
        const ang = Math.random() * Math.PI * 2;
        const vr = 100 + Math.random() * 250;
        velocidades.push({ x: Math.cos(ang) * vr, y: 250 + Math.random() * 450, z: Math.sin(ang) * vr });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    const mat = new THREE.PointsMaterial({
        color: 0x7fe9ff, size: 28, transparent: true, opacity: 1,
        depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const puntos = new THREE.Points(geo, mat);
    scene.add(puntos);
    efectos.push({ puntos, velocidades, vida: 1.0, maxVida: 1.0 });
}

// Avanza y desvanece las partículas; elimina las agotadas.
function actualizarEfectos(dt) {
    for (let i = efectos.length - 1; i >= 0; i--) {
        const ef = efectos[i];
        ef.vida -= dt;
        const pos = ef.puntos.geometry.attributes.position.array;
        for (let k = 0; k < ef.velocidades.length; k++) {
            const v = ef.velocidades[k];
            pos[k * 3]     += v.x * dt;
            pos[k * 3 + 1] += v.y * dt;
            pos[k * 3 + 2] += v.z * dt;
            v.y -= 700 * dt;   // gravedad: las chispas caen
        }
        ef.puntos.geometry.attributes.position.needsUpdate = true;
        ef.puntos.material.opacity = Math.max(0, ef.vida / ef.maxVida);
        if (ef.vida <= 0) {
            scene.remove(ef.puntos);           // Points no es isMesh: se libera aquí a mano
            ef.puntos.geometry.dispose();
            ef.puntos.material.dispose();
            efectos.splice(i, 1);
        }
    }
}

// Quita un objeto de la escena y libera su geometría (y, si se pide, sus materiales;
// no los de objetos con material compartido).
function quitarDeEscena(obj3d, disposeMateriales = false) {
    obj3d.traverse((o) => {
        if (o.isMesh) {
            if (o.geometry) o.geometry.dispose();
            if (disposeMateriales && o.material) {
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }   // libera también la textura
            }
        }
    });
    if (obj3d.parent) obj3d.parent.remove(obj3d);
}

// Factor de velocidad en (x,z): 1 normal, <1 sobre maleza (el menor si se solapan).
function factorVelocidad(x, z) {
    let factor = 1;
    for (const m of vectorMaleza) {
        if (m.contiene(x, z)) factor = Math.min(factor, m.factor);
    }
    return factor;
}

// ¿Un círculo (x,z,radio) choca con algo? 'self' se excluye (null para comprobar todo).
function colisiona(x, z, radio, self) {
    // 1) Contra obstáculos: círculo-vs-caja. Punto de la caja más cercano al centro
    //    (clamp) y se mira si queda dentro del radio.
    for (const el of vectorObstaculos) {
        const cx = Math.max(el.mesh.position.x - el.semiAncho,
                            Math.min(x, el.mesh.position.x + el.semiAncho));
        const cz = Math.max(el.mesh.position.z - el.semiFondo,
                            Math.min(z, el.mesh.position.z + el.semiFondo));
        const dx = x - cx, dz = z - cz;
        if (dx * dx + dz * dz < radio * radio) return true;   // comparo distancias al cuadrado (sin raíz)
    }

    // 2) Contra otras entidades: círculo-vs-círculo.
    for (const ent of vectorEntidades) {
        if (ent === self) continue;
        const dx = x - ent.mesh.position.x;
        const dz = z - ent.mesh.position.z;
        const suma = radio + ent.radio;
        if (dx * dx + dz * dz < suma * suma) return true;
    }

    return false;
}

// Reutilizables para la línea de visión (sin crear objetos cada frame).
const _rayVision = new THREE.Raycaster();
const _origenVision = new THREE.Vector3();
const _dirVision = new THREE.Vector3();

// Rayo y vectores reutilizables para el ajuste de cámara por oclusión.
const _rayCamara = new THREE.Raycaster();
const _dirCamara = new THREE.Vector3();
const _objetivoCamara = new THREE.Vector3();
const _deseadaCamara = new THREE.Vector3();

// ¿Algo corta la visión entre (x0,z0) y (x1,z1)? El rayo va a la altura de los ojos:
// un obstáculo más bajo no tapa, así un enemigo alto ve por encima.
function visionBloqueada(x0, z0, x1, z1, alturaOjo) {
    _dirVision.set(x1 - x0, 0, z1 - z0);      // dirección horizontal hacia el jugador
    const dist = _dirVision.length();
    if (dist === 0) return false;
    _dirVision.divideScalar(dist);            // normalizar
    _origenVision.set(x0, alturaOjo, z0);
    _rayVision.set(_origenVision, _dirVision);
    _rayVision.far = dist;                     // solo hasta el jugador, no más allá
    for (const el of vectorObstaculos) {
        if (_rayVision.intersectObject(el.mesh, true).length > 0) return true;
    }
    return false;
}

function updateAspectRatio() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

// Alterna el menú de pausa.
function togglePausa() {
    pausado = !pausado;
    if (pausado) mostrarPausa();
    else ocultarPausa();
}

// Fin de partida: oculta al jugador y muestra el resumen. Lo llaman la muerte o "Terminar".
function finDePartida() {
    if (gameOver) return;          // solo una vez
    gameOver = true;
    pausado = false;
    ocultarPausa();
    player.muerte();               // el jugador desaparece
    mostrarFinPartida({ kills: killCounter, cofres: treasureCounter, puntuacion: score });
}

// Coloca sol y cámara siguiendo al jugador. El sol mantiene su dirección (la sombra
// queda centrada en él); la cámara va detrás, y se acerca si hay algo en medio.
function posicionarCamara(dt) {
    const px = player.mesh.position.x, pz = player.mesh.position.z;
    // Ancla el centro de la sombra a una rejilla en vez de seguir al jugador en continuo:
    // así el mapa de sombra muestrea casi los mismos puntos y no repta al moverse rápido.
    const paso = (3600 * 2) / 4096 * 4;              // ~7 u (4 texeles de la sombra)
    const sx = Math.round(px / paso) * paso;
    const sz = Math.round(pz / paso) * paso;
    sol.target.position.set(sx, 0, sz);
    sol.position.set(sx - 4000, 1760, sz + 2400);

    const offset = new THREE.Vector3(CAM_DESPLAZAMIENTO, CAM_ALTURA, CAM_DISTANCIA);
    offset.applyAxisAngle(EJE_Y, player.mesh.rotation.y);

    _objetivoCamara.set(player.mesh.position.x, CAM_MIRA_Y, player.mesh.position.z);  // a dónde mira
    _deseadaCamara.copy(player.mesh.position).add(offset);                            // posición ideal (detrás)

    _dirCamara.subVectors(_deseadaCamara, _objetivoCamara);
    const distIdeal = _dirCamara.length();
    _dirCamara.normalize();
    _rayCamara.set(_objetivoCamara, _dirCamara);
    _rayCamara.far = distIdeal;

    const choques = _rayCamara.intersectObjects(obstaculoMeshes, true);
    let distObjetivo = (choques.length > 0) ? choques[0].distance - 20 : distIdeal;   // 20 de margen
    distObjetivo = Math.max(distObjetivo, 60);   // nunca más cerca de 60 del jugador

    // Se acerca rápido (para no quedar tapada) pero se aleja despacio (sin tirón al
    // salir de detrás de algo).
    const velCam = (distObjetivo < distCamaraActual) ? 14 : 6;
    distCamaraActual += (distObjetivo - distCamaraActual) * (1 - Math.exp(-velCam * dt));

    camera.position.copy(_objetivoCamara).addScaledVector(_dirCamara, distCamaraActual);
    camera.lookAt(_objetivoCamara);
}

function update() {
    const dt = clock.getDelta();   // se consume aunque estemos en pausa (dt no se dispara al reanudar)
    if (pausado || gameOver) return;   // congela la lógica; el render sigue

    actualizarEfectos(dt);   // partículas (también durante la transición)

    // Transición de nivel: fundido a negro, se reconstruye el mapa oculto a mitad y
    // luego se aclara.
    if (transicionTimer > 0) {
        transicionTimer -= dt;
        // Ya en negro: reconstruye el nivel, una sola vez.
        if (!nivelConstruido && transicionTimer <= 1.4) {
            construirNivel(nivel);
            clock.getDelta();              // descarta el tiempo de reconstrucción (si no, dt se dispara)
            efectoTeletransporte(0, 0);    // chispas en el nuevo punto de aparición
            nivelConstruido = true;
        }
        // Se mantiene en negro un rato (estabiliza los FPS tras la carga) y luego aclara.
        // El return de abajo deja congelados a jugador y enemigos.
        if (transicionTimer <= 0.6) ocultarFundido();
        posicionarCamara(dt);
        return;
    }

    player.update(dt, keys, colisiona, vectorEnemies, visionBloqueada, factorVelocidad);

    // Spawn por tiempo: un enemigo cada spawnInterval s.
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
        spawnTimer -= spawnInterval;
        spawnEnemyAroundPlayer();
    }

    // IA de enemigos.
    for (const enemy of vectorEnemies) {
        enemy.update(dt, player, colisiona, visionBloqueada, factorVelocidad);
        actualizarBarraSalud(enemy, camera);   // relleno + orientación hacia la cámara
    }

    // Enemigos muertos: se eliminan de escena y vectores. Recorro al revés por el splice.
    for (let i = vectorEnemies.length - 1; i >= 0; i--) {
        const e = vectorEnemies[i];
        if (e.hp <= 0) {
            // 5% de soltar un item donde murió.
            if (Math.random() < 0.05) spawnItem(e.mesh.position.x, e.mesh.position.z, tipoItemAleatorio());
            e.muerte();                        // dispose + quitar de la escena
            vectorEnemies.splice(i, 1);        // libera hueco en el tope (maxEnemigos)
            const j = vectorEntidades.indexOf(e);
            if (j !== -1) vectorEntidades.splice(j, 1);   // deja de colisionar
            killCounter++;                     // cuenta para la pantalla de fin
            killsNivel++;                      // kills del nivel (para el bonus)
            score += 50;                       // +50 por enemigo
            actualizarScore(score);
        }
    }

    // Items: animación y recogida al pasar por encima.
    for (let i = vectorItems.length - 1; i >= 0; i--) {
        const it = vectorItems[i];
        it.update(dt);
        if (it.recogido(player)) {
            it.aplicar(player);                // efecto permanente (+velocidad/daño, -cooldown)
            itemCounts[it.tipo] = (itemCounts[it.tipo] || 0) + 1;
            actualizarItems(itemCounts);       // barra de items del HUD
            quitarDeEscena(it.mesh, false);    // materiales compartidos: no disponer
            vectorItems.splice(i, 1);
        }
    }

    // Cofre encontrado: sube de nivel y regenera el mapa.
    if (treasure && treasure.encontrado(player)) {
        treasureCounter++;
        score += 100;                                   // +100 por encontrar el cofre
        if (killsNivel === 0) score += 200;             // +200 por pasar sin matar a nadie
        actualizarScore(score);
        nivel++;
        player.mana = 100;                              // recarga el maná
        player.hp = player.hpMax;                       // cura a la vida máxima
        efectoTeletransporte(player.mesh.position.x, player.mesh.position.z);  // chispas en el sitio viejo
        mostrarFundido();                               // empieza el fundido a negro
        nivelConstruido = false;                        // el nivel se reconstruye a mitad del fundido
        transicionTimer = 2.0;                          // ~2 s: negro -> reconstruir -> esperar -> aclarar
    }

    posicionarCamara(dt);

    // HUD: vida, maná y cooldowns.
    actualizarHUD({
        hp: player.hp, hpMax: player.hpMax,
        mana: player.mana, manaMax: 100,
        swordTimer: player.swordTimer, swordCooldown: player.swordCooldown,
        fireTimer: player.fireTimer, fireCooldown: player.fireCooldown,
    });

    // Jugador sin vida: fin de la partida.
    if (player.hp <= 0) finDePartida();
}

function render() {
    stats.begin();
    update();
    TWEEN.update();           // avanza las animaciones de ataque
    renderer.render(scene, camera);
    stats.end();
    requestAnimationFrame(render);
}

// Arranque al final del archivo: las constantes de módulo ya están inicializadas
// antes del primer frame.
init();
loadScene();
render();
