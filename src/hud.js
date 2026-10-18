// Interfaz 2D del jugador en DOM/CSS sobre el canvas: vida, maná, cooldowns y los menús
// de pausa y fin de partida.

let refs = null;

// Icono de cada item, ya recortado a un solo frame del atlas original (los atlas tenían
// rejillas distintas y al mostrarlos enteros salían trozos de frames vecinos).
// Rutas relativas a index.html.
const SPRITES_ITEMS = {
    botas:  'sprites2d/travelers-boots/travelers-boots-icon.png',   // velocidad de movimiento
    espada: 'sprites2d/ember-longsword/ember-longsword-icon.png',   // daño de espada (físico)
    reloj:  'sprites2d/brass-compass/brass-compass-icon.png',       // velocidad de ataque (cooldown)
    orbe:   'sprites2d/fireball/fireball-icon.png',                 // daño de fuego (hechizo)
    pocion: 'sprites2d/health-potion/health-potion-icon.png',       // +5% vida máxima
};
const ORDEN_ITEMS = ['botas', 'espada', 'reloj', 'orbe', 'pocion'];

export function crearHUD(acciones = {}) {
    // --- Barras y cooldowns ---
    const hud = document.createElement('div');
    hud.className = 'hud';
    hud.innerHTML = `
        <div class="hud-barra hud-vida"><div class="hud-relleno"></div><span class="hud-texto"></span></div>
        <div class="hud-barra hud-mana"><div class="hud-relleno"></div><span class="hud-texto"></span></div>
        <div class="hud-habilidades">
            <div class="hud-cd" id="cd-espada">🗡️<div class="hud-cd-sweep"></div></div>
            <div class="hud-cd" id="cd-fuego">🔥<div class="hud-cd-sweep"></div></div>
        </div>
    `;
    document.body.appendChild(hud);

    // --- Menú de pausa ---
    const menuPausa = document.createElement('div');
    menuPausa.className = 'menu';
    menuPausa.innerHTML = `
        <div class="menu-panel">
            <h1>Pausa</h1>
            <button id="btn-reanudar">Reanudar</button>
            <button id="btn-terminar">Terminar</button>
        </div>
    `;
    document.body.appendChild(menuPausa);

    // --- Pantalla de fin de partida ---
    const menuFin = document.createElement('div');
    menuFin.className = 'menu';
    menuFin.innerHTML = `
        <div class="menu-panel">
            <h1>Fin de la partida</h1>
            <p>Enemigos eliminados: <span id="fin-kills">0</span></p>
            <p>Cofres conseguidos: <span id="fin-cofres">0</span></p>
            <p>Puntuación: <span id="fin-score">0</span></p>
        </div>
        <button id="btn-volver" class="btn-volver">Volver a jugar</button>
    `;
    document.body.appendChild(menuFin);

    // --- Barra de items (arriba-centro: icono + contador) ---
    const barraItems = document.createElement('div');
    barraItems.style.cssText =
        'position:fixed;top:8px;left:50%;transform:translateX(-50%);' +
        'display:flex;gap:10px;z-index:9999;pointer-events:none;';
    document.body.appendChild(barraItems);

    const itemRefs = {};
    for (const tipo of ORDEN_ITEMS) {
        const slot = document.createElement('div');
        slot.style.cssText =
            'position:relative;width:38px;height:38px;display:none;' +   // 20% más pequeños
            `background-image:url('${SPRITES_ITEMS[tipo]}');` +
            'background-size:contain;background-position:center;background-repeat:no-repeat;' +
            'image-rendering:pixelated;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.8));';
        const count = document.createElement('span');
        count.textContent = '0';
        count.style.cssText =
            'position:absolute;right:-2px;bottom:-4px;color:#fff;font:bold 13px sans-serif;' +
            'text-shadow:0 0 3px #000, 0 0 3px #000;';
        slot.appendChild(count);
        barraItems.appendChild(slot);
        itemRefs[tipo] = { slot, count };
    }

    // --- Nivel y puntuación (arriba a la derecha) ---
    const nivelEl = document.createElement('div');
    nivelEl.style.cssText =
        'position:fixed;top:12px;right:14px;z-index:9999;pointer-events:none;' +
        'color:#9fd0ff;font:bold 20px sans-serif;text-shadow:0 0 4px #000, 0 2px 4px #000;';
    nivelEl.textContent = 'Nivel: 1';
    document.body.appendChild(nivelEl);

    const scoreEl = document.createElement('div');
    scoreEl.style.cssText =
        'position:fixed;top:40px;right:14px;z-index:9999;pointer-events:none;' +
        'color:#ffe08a;font:bold 20px sans-serif;text-shadow:0 0 4px #000, 0 2px 4px #000;';
    scoreEl.textContent = 'Puntuación: 0';
    document.body.appendChild(scoreEl);

    // --- Fundido a negro para la transición entre niveles ---
    const fundido = document.createElement('div');
    fundido.style.cssText =
        'position:fixed;inset:0;background:#000;opacity:0;z-index:20000;pointer-events:none;' +
        'transition:opacity 0.6s ease;';
    document.body.appendChild(fundido);

    refs = {
        nivel:     nivelEl,
        fundido,
        score:     scoreEl,
        vida:      hud.querySelector('.hud-vida .hud-relleno'),
        mana:      hud.querySelector('.hud-mana .hud-relleno'),
        vidaTxt:   hud.querySelector('.hud-vida .hud-texto'),
        manaTxt:   hud.querySelector('.hud-mana .hud-texto'),
        cdEspada:  hud.querySelector('#cd-espada .hud-cd-sweep'),
        cdFuego:   hud.querySelector('#cd-fuego .hud-cd-sweep'),
        items:     itemRefs,
        menuPausa,
        menuFin,
        finKills:  menuFin.querySelector('#fin-kills'),
        finCofres: menuFin.querySelector('#fin-cofres'),
        finScore:  menuFin.querySelector('#fin-score'),
    };

    // Botones: cada uno dispara la acción que le pase main.js.
    menuPausa.querySelector('#btn-reanudar').addEventListener('click', () => acciones.onReanudar?.());
    menuPausa.querySelector('#btn-terminar').addEventListener('click', () => acciones.onTerminar?.());
    menuFin.querySelector('#btn-volver').addEventListener('click', () => acciones.onVolverAJugar?.());
}

// estado: { hp, hpMax, mana, manaMax, swordTimer, swordCooldown, fireTimer, fireCooldown }
// (los *Timer son los segundos que le quedan al cooldown).
export function actualizarHUD(estado) {
    if (!refs) return;

    // Ancho del relleno = porcentaje restante.
    refs.vida.style.width = Math.max(0, 100 * estado.hp   / estado.hpMax)   + '%';
    refs.mana.style.width = Math.max(0, 100 * estado.mana / estado.manaMax) + '%';

    // Número dentro de la barra (actual / máximo).
    refs.vidaTxt.textContent = Math.max(0, Math.round(estado.hp))   + ' / ' + estado.hpMax;
    refs.manaTxt.textContent = Math.max(0, Math.round(estado.mana)) + ' / ' + estado.manaMax;

    pintarCooldown(refs.cdEspada, estado.swordTimer, estado.swordCooldown);
    pintarCooldown(refs.cdFuego,  estado.fireTimer,  estado.fireCooldown);
}

// Muestra el icono de cada item recogido con su contador. counts: { tipo: cantidad }.
export function actualizarItems(counts = {}) {
    if (!refs || !refs.items) return;
    for (const tipo in refs.items) {
        const n = counts[tipo] || 0;
        refs.items[tipo].slot.style.display = n > 0 ? 'block' : 'none';
        refs.items[tipo].count.textContent = n;
    }
}

export function actualizarScore(valor) {
    if (refs && refs.score) refs.score.textContent = 'Puntuación: ' + valor;
}

export function actualizarNivel(n) {
    if (refs && refs.nivel) refs.nivel.textContent = 'Nivel: ' + n;
}

// Fundido a negro de la transición (la transición CSS es de 0.6 s).
export function mostrarFundido() { if (refs && refs.fundido) refs.fundido.style.opacity = '1'; }
export function ocultarFundido() { if (refs && refs.fundido) refs.fundido.style.opacity = '0'; }

export function mostrarPausa() { if (refs) refs.menuPausa.style.display = 'flex'; }
export function ocultarPausa() { if (refs) refs.menuPausa.style.display = 'none'; }

export function mostrarFinPartida({ kills = 0, cofres = 0, puntuacion = 0 } = {}) {
    if (!refs) return;
    refs.finKills.textContent  = kills;
    refs.finCofres.textContent = cofres;
    if (refs.finScore) refs.finScore.textContent = puntuacion;
    refs.menuFin.style.display = 'flex';
}

// Sector horario sobre el icono mientras la habilidad se recarga (restante/total en
// segundos); crece de 0° a 360° y desaparece al estar lista.
function pintarCooldown(el, restante, total) {
    if (restante <= 0) {
        el.style.background = 'none';
        return;
    }
    const ang = 360 * (1 - restante / total);
    el.style.background =
        `conic-gradient(rgba(255, 255, 150, 0.55) ${ang}deg, transparent ${ang}deg)`;
}
