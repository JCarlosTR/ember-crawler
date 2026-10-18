import * as THREE from 'three';

// Funde varias geometrías ya colocadas en una sola BufferGeometry con color por vértice,
// para dibujar un objeto compuesto (árbol, roca, hierba) en un único draw call.
// partes: [{ geo, color }]. El material debe llevar vertexColors. Libera las geometrías de entrada.
export function fundirGeometrias(partes) {
    // Al pasar a no indexado, los vértices se expanden al número de índices.
    let total = 0;
    for (const pt of partes) {
        total += pt.geo.index ? pt.geo.index.count : pt.geo.attributes.position.count;
    }

    const pos = new Float32Array(total * 3);
    const nor = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    const uvs = new Float32Array(total * 2);   // UV, para poder texturizar

    let offset = 0;
    for (const pt of partes) {
        const g = pt.geo.index ? pt.geo.toNonIndexed() : pt.geo;  // sin índices es trivial concatenar
        const p = g.attributes.position.array;
        const n = g.attributes.normal.array;
        const u = g.attributes.uv ? g.attributes.uv.array : null;
        const count = g.attributes.position.count;
        pos.set(p, offset * 3);
        nor.set(n, offset * 3);
        if (u) uvs.set(u, offset * 2);
        for (let i = 0; i < count; i++) {
            col[(offset + i) * 3]     = pt.color.r;
            col[(offset + i) * 3 + 1] = pt.color.g;
            col[(offset + i) * 3 + 2] = pt.color.b;
        }
        offset += count;
        if (g !== pt.geo) g.dispose();   // temporal no indexado
        pt.geo.dispose();                // pieza original
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal',   new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
    return geo;
}
