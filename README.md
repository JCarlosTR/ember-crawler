# Ember Crawler

Roguelite de acción en tercera persona ambientado en un bosque crepuscular, hecho con
Three.js (r140) y módulos ES nativos, sin empaquetador ni dependencias que instalar.
Trabajo de la asignatura Gráficos por Computador (GPC) del máster MIARFID.

## Jugar

Versión online (GitHub Pages): https://USUARIO.github.io/ember-crawler/

> Sustituye `USUARIO` por tu usuario de GitHub una vez publicado.

## Controles

- **W / S**: avanzar / retroceder
- **A / D**: girar
- **Shift**: caminar despacio (por defecto se corre)
- **Clic izquierdo**: espada (cono frontal)
- **Clic derecho**: bola de fuego (gasta maná)
- **Esc**: pausa

Encuentra el cofre dorado de cada nivel para avanzar: el mapa se regenera y la dificultad
sube sin techo. Los objetos que sueltan los enemigos y los repartidos por el mapa mejoran
de forma permanente (velocidad, daño, cadencia, fuego, vida máxima).

## Ejecutar en local

Los módulos ES necesitan servirse por HTTP (no vale abrir el `index.html` con `file://`).
La forma más simple es la extensión **Live Server** de VS Code: abrir la carpeta y pulsar
"Go Live". No hace falta Node ni ningún proceso de build.

## Tecnología y características

- Three.js r140 con módulos ES e `importmap` (sin CDN; la librería va en `lib/`).
- Iluminación de crepúsculo (direccional + hemisférica) y niebla exponencial.
- Sombras dinámicas (PCF) con caja de sombra que sigue al jugador.
- Texturas procedurales (canvas) para suelo, muros, copas y cuerpos, y texturas PBR reales
  (color + normales + rugosidad/metalicidad) para la corteza de los troncos y el mármol de
  las rocas.
- Modelo glTF para el cofre, cargado con `GLTFLoader`.
- Niveles procedurales: bosque en arboledas, rocas, maleza, enemigos y objetos sin solaparse.
- IA enemiga con máquina de estados, cono de visión y línea de visión por raycast.
- Cámara en tercera persona con anti-oclusión y suavizado.
- Animaciones con easing (tween.js) y medidor de FPS/ms (stats.js).
- Optimización de dibujado: cada árbol, roca y mata se funde en una malla, y todos los
  troncos del bosque van en una sola (menos draw calls).

## Créditos de assets

- Texturas de corteza y mármol y modelo del cofre: [Poly Haven](https://polyhaven.com) (CC0).
- Iconos de objetos: ver la licencia incluida en cada carpeta de `sprites2d/`.

El código del juego es de elaboración propia.
