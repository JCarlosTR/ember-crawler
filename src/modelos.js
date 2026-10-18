import { GLTFLoader } from '../lib/GLTFLoader.module.js';

const loader = new GLTFLoader();

// Carga un modelo glTF y devuelve una promesa con su escena. La carga es asíncrona,
// así que conviene cargar el fichero una vez y clonar el resultado por instancia.
export function cargarModelo(ruta) {
    return new Promise((resolve, reject) => {
        loader.load(ruta, (gltf) => resolve(gltf.scene), undefined, reject);
    });
}
