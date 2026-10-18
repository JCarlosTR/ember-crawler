import * as THREE from 'three';

// Objeto recogible que mejora al jugador al pasar por encima (atravesable, como el cofre).
// Cada tipo tiene su forma y un efecto permanente y acumulable (ver aplicar()).

const BOOST = 1.10;          // +10%
const COOLDOWN_MULT = 0.90;  // -10%

// Color de la peana luminosa por tipo.
const COLORES = {
    botas:  0x8b5a2b,   // cuero marrón
    espada: 0xcfd4da,   // acero
    reloj:  0xffd54a,   // oro
    orbe:   0xff3b1f,   // fuego rojo
    pocion: 0xcc0000,   // rojo rubí (salud)
};

// Material de la peana, compartido por tipo: al recoger el item solo se libera su geometría.
const peanaMats = {};
function peanaMat(tipo, color) {
    if (!peanaMats[tipo]) {
        peanaMats[tipo] = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 });
    }
    return peanaMats[tipo];
}

export class Item {
    constructor(x = 0, z = 0, tipo = 'botas') {
        this.tipo = tipo;
        this.radioRecogida = 90;            // distancia a la que se recoge
        this.mesh = new THREE.Object3D();

        const color = COLORES[tipo] ?? COLORES.botas;

        // Modelo por tipo (clases *Geom), escalado al juego. Gira y bota en update().
        this.cuerpo = new THREE.Group();
        let modelo, escala;
        switch (tipo) {
            case 'espada': modelo = new ItemEspadaGeom().mesh; escala = 2.4; break;
            case 'reloj':  modelo = new ItemRelojGeom().mesh;  escala = 7.0; break;
            case 'orbe':   modelo = new ItemOrbeGeom().mesh;   escala = 6.0; break;
            case 'pocion': modelo = new ItemPocionGeom().mesh; escala = 6.0; break;  // matraz de salud
            default:       modelo = new ItemBotasGeom().mesh;  escala = 2.25; break;  // botas (mitad de tamaño)
        }
        modelo.scale.setScalar(escala);
        this.cuerpo.add(modelo);
        this.alturaFlote = 45;              // altura a la que flota
        this.cuerpo.position.y = this.alturaFlote;
        this.mesh.add(this.cuerpo);

        // Peana luminosa para verlo en la penumbra.
        const peana = new THREE.Mesh(new THREE.CylinderGeometry(50, 50, 6, 24), peanaMat(tipo, color));
        peana.position.y = 3;
        this.mesh.add(peana);

        this.mesh.position.set(x, 0, z);
        this.t = Math.random() * Math.PI * 2;   // desfase para que no boten todos a la vez
    }

    // Gira y flota. Llamar cada frame.
    update(dt) {
        this.t += dt;
        this.cuerpo.rotation.y += dt * 1.5;
        this.cuerpo.position.y = this.alturaFlote + Math.sin(this.t * 2) * 15;
    }

    // ¿El jugador está lo bastante cerca para recogerlo?
    recogido(player) {
        const dx = player.mesh.position.x - this.mesh.position.x;
        const dz = player.mesh.position.z - this.mesh.position.z;
        return Math.hypot(dx, dz) < this.radioRecogida;
    }

    // Efecto permanente y acumulable sobre el jugador.
    aplicar(player) {
        switch (this.tipo) {
            case 'botas':  player.velocidad    *= BOOST; break;
            case 'espada': player.danoEspada   *= BOOST; break;
            case 'reloj':  player.swordCooldown *= COOLDOWN_MULT;
                           player.fireCooldown  *= COOLDOWN_MULT; break;
            case 'orbe':   player.danoFuego    *= 1.20;            // +20% daño
                           player.alcanceFuego *= 1.05;           // +5% alcance
                           // -7.5% de coste de maná (redondeo arriba, mínimo 1).
                           player.costeFuegoExacto *= 0.925;
                           player.costeFuego = Math.max(1, Math.ceil(player.costeFuegoExacto));
                           break;
            case 'pocion': {                                       // +5% de vida máxima
                const nuevoMax = Math.floor(player.hpMax * 1.05);
                player.hp += (nuevoMax - player.hpMax);           // cura lo que sube el máximo
                player.hpMax = nuevoMax;
                break;
            }
        }
    }





}

 
// Materiales de la espada.
const matMango = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }); // negro
const matGuarda = new THREE.MeshStandardMaterial({ color: 0x8a733e, metalness: 0.6, roughness: 0.4 }); // bronce
const matMetal = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 }); // acero

export class ItemEspadaGeom {
    constructor(x = 0, z = 0) {
        this.mesh = new THREE.Group();

        // Pomo
        const pomo = new THREE.Mesh(
            new THREE.SphereGeometry(2.5, 8, 8),
            matGuarda
        );
        pomo.position.y = 2.5;
        this.mesh.add(pomo);

        // Mango
        const altoMango = 12;
        const mango = new THREE.Mesh(
            new THREE.CylinderGeometry(1.5, 1.5, altoMango, 8), 
            matMango
        );
        mango.position.y = 2.5 + (altoMango / 2);
        this.mesh.add(mango);

        // Guarda
        const guarda = new THREE.Mesh(
            new THREE.BoxGeometry(16, 2, 4), 
            matGuarda
        );
        guarda.position.y = 2.5 + altoMango + 1;
        this.mesh.add(guarda);

        // Hoja
        const altoHoja = 40;
        const anchoHoja = 5;
        const grosorHoja = 0.8; // fina, para que parezca afilada
        
        const hoja = new THREE.Mesh(
            new THREE.BoxGeometry(anchoHoja, altoHoja, grosorHoja), 
            matMetal
        );
        const baseHojaY = 2.5 + altoMango + 2; 
        hoja.position.y = baseHojaY + (altoHoja / 2);
        this.mesh.add(hoja);

        // Punta
        const altoPunta = 8;
        const punta = new THREE.Mesh(
            new THREE.ConeGeometry(anchoHoja / 2, altoPunta, 16),   // 16 segmentos: lados suaves al aplastarla
            matMetal
        );
        punta.position.y = baseHojaY + altoHoja + (altoPunta / 2);

        // Aplastada en Z para igualar el grosor de la hoja (queda como una cuña).
        punta.scale.set(1, 1, 0.16);
        this.mesh.add(punta);

        this.mesh.position.set(x, 0, z);

        // Colisión
        this.semiAncho = 10;
        this.semiFondo = 10;
    }

    
}


// Cuero, compartido.
const matCuero = new THREE.MeshStandardMaterial({ color: 0x5c4033 });

export class ItemBotasGeom {
    constructor(x = 0, z = 0) {
        this.mesh = new THREE.Group();

        // Molde de una bota; luego se clona para el par.
        const botaBase = new THREE.Group();

        // Caña
        const altoCana = 20;
        const radioCana = 6;
        const cana = new THREE.Mesh(
            new THREE.CylinderGeometry(radioCana + 1, radioCana, altoCana, 8),
            matCuero
        );
        cana.position.y = altoCana / 2; // base en y=0
        botaBase.add(cana);

        // Pie
        const largoPie = 18;
        const pie = new THREE.Mesh(
            new THREE.BoxGeometry(radioCana * 2, 8, largoPie),
            matCuero
        );
        pie.position.set(0, 4, (largoPie / 2) - 4);   // hacia delante, cerca del suelo
        botaBase.add(pie);

        // Dobladillo superior
        const dobladillo = new THREE.Mesh(
            new THREE.CylinderGeometry(radioCana + 2.5, radioCana + 1.5, 6, 8),
            matCuero
        );
        dobladillo.position.y = altoCana;
        botaBase.add(dobladillo);


        // El par: dos clones con la punta girada hacia afuera.
        const botaIzquierda = botaBase.clone();
        botaIzquierda.position.x = -7;
        botaIzquierda.rotation.y = -Math.PI * 0.08;
        this.mesh.add(botaIzquierda);

        const botaDerecha = botaBase.clone();
        botaDerecha.position.x = 7;
        botaDerecha.rotation.y = Math.PI * 0.08;
        this.mesh.add(botaDerecha);

        this.mesh.position.set(x, 0, z);

        // Colisión
        this.semiAncho = 15;
        this.semiFondo = 15;
    }
}


// Materiales del reloj.
const matAmarillo = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.3 }); // oro
const matEsfera = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }); // esfera blanca
const matManecillas = new THREE.MeshStandardMaterial({ color: 0x111111 }); // negro

export class ItemRelojGeom {
    constructor(x = 0, z = 0) {
        this.mesh = new THREE.Group();
        this.mesh.rotation.z = Math.PI / 4;


        // Caja
        const caja = new THREE.Mesh(
            new THREE.CylinderGeometry(4.5, 4.5, 1.5, 16),
            matAmarillo
        );
        caja.position.y = 2.5;


        this.mesh.add(caja);

        // Esfera (pantalla)
        const esfera = new THREE.Mesh(
            new THREE.CylinderGeometry(3.8, 3.8, 1.6, 16),
            matEsfera
        );
        esfera.position.y = 2.5;
        this.mesh.add(esfera);

        // Corona (a las 3)
        const corona = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
            matAmarillo
        );
        corona.rotation.z = Math.PI / 2;
        corona.position.set(4.8, 2.5, 0);
        this.mesh.add(corona);

        // --- Manecillas ---
        const alturaManecillas = 3.35; // sobre la esfera

        // Minutero (a las 6)
        const largoMinutero = 3.2;
        const geomMinutero = new THREE.BoxGeometry(0.3, 0.2, largoMinutero);
        geomMinutero.translate(0, 0, -largoMinutero / 2);   // pivote en la base de la manecilla

        const minutero = new THREE.Mesh(geomMinutero, matManecillas);
        minutero.position.y = alturaManecillas;
        minutero.rotation.y = Math.PI;
        this.mesh.add(minutero);

        // Horario (45º)
        const largoHorario = 2.2;
        const geomHorario = new THREE.BoxGeometry(0.4, 0.2, largoHorario);
        geomHorario.translate(0, 0, -largoHorario / 2);

        const horario = new THREE.Mesh(geomHorario, matManecillas);
        horario.position.y = alturaManecillas + 0.1; // un pelín arriba para evitar z-fighting
        horario.rotation.y = -Math.PI / 4;
        this.mesh.add(horario);

        // Eje central
        const eje = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.4, 0.4, 8),
            matManecillas
        );
        eje.position.y = alturaManecillas + 0.15;
        this.mesh.add(eje);

        this.mesh.position.set(x, 0, z);

        // Colisión
        this.semiAncho = 7;
        this.semiFondo = 7;
    }
}

// Cristal exterior: rojo translúcido.
const matCristalRojo = new THREE.MeshPhysicalMaterial({
    color: 0xff0000,
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: 0.6,            // deja ver el núcleo
    transmission: 0.5,       // refracción
    clearcoat: 1.0,
    clearcoatRoughness: 0.1
});

// Núcleo interior luminoso.
const matEnergia = new THREE.MeshStandardMaterial({
    color: 0xff4400,
    emissive: 0xffaa00,
    emissiveIntensity: 0.8,
    roughness: 1.0
});

export class ItemOrbeGeom {
    constructor(x = 0, z = 0) {
        this.mesh = new THREE.Group();

        const alturaBase = 6; // flota un poco sobre el suelo

        // Núcleo
        const radioNucleo = 3;
        const nucleo = new THREE.Mesh(
            new THREE.SphereGeometry(radioNucleo, 16, 16),
            matEnergia
        );
        nucleo.position.y = alturaBase;
        this.mesh.add(nucleo);

        // Cristal exterior
        const radioCristal = 4;
        const cristal = new THREE.Mesh(
            new THREE.SphereGeometry(radioCristal, 32, 32),   // 32 segmentos: contorno y reflejos suaves
            matCristalRojo
        );
        cristal.position.y = alturaBase;
        this.mesh.add(cristal);

        this.mesh.position.set(x, 0, z);

        // Colisión
        this.semiAncho = radioCristal + 2;
        this.semiFondo = radioCristal + 2;
    }
}

// Cristal translúcido simple: sin transmission, que dejaba el matraz casi invisible y
// ocultaba el líquido.
const matCristal = new THREE.MeshStandardMaterial({
    color: 0xbcd4e6,         // leve tinte azulado de vidrio
    transparent: true,
    opacity: 0.22,
    roughness: 0.1,
    side: THREE.DoubleSide
});

// Líquido: rojo opaco con brillo propio para que se vea dentro del matraz.
const matLiquido = new THREE.MeshStandardMaterial({
    color: 0xcc0000,
    emissive: 0x440000,
    emissiveIntensity: 0.8,
    roughness: 0.4
});

// Corcho.
const matCorcho = new THREE.MeshStandardMaterial({
    color: 0x8b5a2b,
    roughness: 0.9,
});

export class ItemPocionGeom {
    constructor(x = 0, z = 0) {
        this.mesh = new THREE.Group();

        // --- Medidas del matraz ---
        const radioCuerpo = 4.0;

        const anguloCorteInferior = Math.PI * 0.9;   // recorta el 10% inferior de la esfera

        // Eleva la pieza para que el fondo plano apoye en y=0.
        const elevacionCentro = Math.abs(radioCuerpo * Math.cos(anguloCorteInferior));

        // --- Cristal: cuerpo y base ---
        const cuerpoCristal = new THREE.Mesh(
            new THREE.SphereGeometry(radioCuerpo, 32, 32, 0, Math.PI * 2, 0, anguloCorteInferior),
            matCristal
        );
        cuerpoCristal.position.y = elevacionCentro;
        this.mesh.add(cuerpoCristal);

        // Tapa inferior (fondo del matraz).
        const radioBase = radioCuerpo * Math.sin(anguloCorteInferior);
        const baseCristal = new THREE.Mesh(
            new THREE.CircleGeometry(radioBase, 32),
            matCristal
        );
        baseCristal.rotation.x = -Math.PI / 2;
        baseCristal.position.y = 0;
        this.mesh.add(baseCristal);

        // --- Cristal: cuello y reborde ---
        const altoCuello = 3.5;
        const radioCuello = 1.2;

        const cuello = new THREE.Mesh(
            new THREE.CylinderGeometry(radioCuello, radioCuello, altoCuello, 32),
            matCristal
        );
        cuello.position.y = elevacionCentro + radioCuerpo + (altoCuello / 2) - 0.6;   // hundido en la esfera para fundirlo
        this.mesh.add(cuello);

        // Labio
        const reborde = new THREE.Mesh(
            new THREE.TorusGeometry(radioCuello + 0.15, 0.25, 16, 32),
            matCristal
        );
        reborde.rotation.x = Math.PI / 2;
        reborde.position.y = cuello.position.y + (altoCuello / 2);
        this.mesh.add(reborde);

        // --- Líquido interior ---
        const radioLiq = 3.7; // algo menor que el cristal

        const nivelAguaArriba = Math.PI * 0.35; // a mayor valor, menos lleno
        const longitudArcoLiq = anguloCorteInferior - nivelAguaArriba;

        // cuerpo
        const cuerpoLiquido = new THREE.Mesh(
            new THREE.SphereGeometry(radioLiq, 32, 16, 0, Math.PI * 2, nivelAguaArriba, longitudArcoLiq),
            matLiquido
        );
        cuerpoLiquido.position.y = elevacionCentro;
        this.mesh.add(cuerpoLiquido);

        // superficie
        const radioSuperficie = radioLiq * Math.sin(nivelAguaArriba);
        const superficieLiq = new THREE.Mesh(
            new THREE.CircleGeometry(radioSuperficie, 32),
            matLiquido
        );
        superficieLiq.rotation.x = -Math.PI / 2;
        superficieLiq.position.y = elevacionCentro + (radioLiq * Math.cos(nivelAguaArriba));
        this.mesh.add(superficieLiq);

        // fondo
        const radioFondoLiq = radioLiq * Math.sin(anguloCorteInferior);
        const fondoLiq = new THREE.Mesh(
            new THREE.CircleGeometry(radioFondoLiq, 32),
            matLiquido
        );
        fondoLiq.rotation.x = Math.PI / 2;
        fondoLiq.position.y = elevacionCentro + (radioLiq * Math.cos(anguloCorteInferior));
        this.mesh.add(fondoLiq);

        // --- Corcho ---
        const corcho = new THREE.Mesh(
            new THREE.CylinderGeometry(radioCuello + 0.1, radioCuello - 0.1, 1.2, 16),
            matCorcho
        );
        corcho.position.y = reborde.position.y + 0.4;
        this.mesh.add(corcho);

        this.mesh.position.set(x, 0, z);

        // Colisión
        this.semiAncho = radioCuerpo;
        this.semiFondo = radioCuerpo;
    }
}