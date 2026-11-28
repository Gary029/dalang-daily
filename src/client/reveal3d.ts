import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { HEAD, figure } from '../shared/figures.ts';
import { GH, GW } from '../shared/grid.ts';
import {
  DEPTH_SCALE,
  LAMP_B_DX,
  LAMP_X,
  UNIT,
  lampMagnify,
  lampShift,
  poseAffine,
} from '../shared/shadow.ts';
import type { PaintedPuppet } from './paint.ts';

/**
 * The turn-around: the solved kelir in 3D, then the camera swings to the
 * dalang's side. A real point light at the blencong lamp casts the puppets'
 * shadows onto the cloth. Each puppet is placed by inverting that projection,
 * so its 3D shadow is exactly the 2D shadow the player matched.
 *
 * World units are kelir cells; the cloth is the plane z = 0, the lamp is at
 * z = LAMP_Z on the dalang's side.
 *
 * The puppets on show are the Blender-built vinyl figures (public/models,
 * tools/blender/build_wayang.py): a `body`, a `head` whose origin is the neck
 * pivot, and every arm position as `front_<shoulder><elbow>` and
 * `back_<shoulder><elbow>`, of which the pose shows one of each. They never
 * cast the shadow: an invisible plane with the exact scored silhouette does.
 * Until a model loads, or if it cannot, the painted plane from paint.ts
 * stands in.
 */

const modelUrl = (id: string) => `${import.meta.env.BASE_URL}models/${id}.glb`;

const LAMP_Z = 160;
const LAMP_Y = 30;
/** shadow magnification for a depth step; always > 1 for a point light.
 * Shared with the engine, so a second lamp's shadow lands where it scores. */
const magnify = lampMagnify;

const SWING_START = 450;
const SWING_MS = 3400;
const FOV = 32;

const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const smooth = (a: number, b: number, t: number) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

const texture = (c: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

const clothCanvas = () => {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 384;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f6e6c2';
  g.fillRect(0, 0, c.width, c.height);
  g.globalAlpha = 0.05;
  g.fillStyle = '#6b4a2a';
  for (let x = 0; x < c.width; x += 6) g.fillRect(x, 0, 1, c.height);
  for (let y = 0; y < c.height; y += 6) g.fillRect(0, y, c.width, 1);
  // a maroon border sewn along the top, like a real kelir
  g.globalAlpha = 1;
  g.fillStyle = '#7a1f1f';
  g.fillRect(0, 0, c.width, 10);
  g.fillRect(0, c.height - 6, c.width, 6);
  return c;
};

const flameCanvas = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,250,225,1)');
  r.addColorStop(0.18, 'rgba(255,214,120,0.95)');
  r.addColorStop(0.45, 'rgba(255,150,50,0.35)');
  r.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return c;
};

export type RevealHandle = { dispose: () => void };

/** Throws if WebGL is unavailable; the caller falls back to the flat flip. */
export const startReveal = (
  host: HTMLElement,
  puppets: PaintedPuppet[],
  lampCount = 1
): RevealHandle => {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // nothing that casts a shadow moves, so render the shadow map once
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.domElement.className = 'reveal-gl';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const night = new THREE.Color('#150c0b');
  scene.background = night;
  scene.fog = new THREE.Fog(night, 420, 1100);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 3000);

  scene.add(new THREE.AmbientLight('#ffdcb0', 0.8));
  // one blencong, or two on a two-lamp night (the second LAMP_B_DX to the left)
  const lampXs = lampCount === 2 ? [LAMP_X, LAMP_X + LAMP_B_DX] : [LAMP_X];
  const power = lampCount === 2 ? 2.1 : 3.4;
  const lights = lampXs.map((x) => {
    const l = new THREE.PointLight('#ffd08f', power, 0, 0);
    l.position.set(x, LAMP_Y, LAMP_Z);
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    l.shadow.camera.near = 4;
    l.shadow.camera.far = 600;
    l.shadow.bias = -0.002;
    l.shadow.radius = 2;
    scene.add(l);
    return l;
  });
  const lamp = lights[0]!;

  // the kelir and its carved frame
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(GW, GH),
    new THREE.MeshLambertMaterial({ map: texture(clothCanvas()) })
  );
  cloth.position.set(GW / 2, GH / 2, 0);
  cloth.receiveShadow = true;
  scene.add(cloth);
  const wood = new THREE.MeshLambertMaterial({ color: '#4a2717' });
  const bar = (w: number, h: number, x: number, y: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 5), wood);
    b.position.set(x, y, -1.2);
    b.receiveShadow = true;
    scene.add(b);
  };
  bar(GW + 16, 7, GW / 2, GH + 3.5);
  bar(GW + 16, 7, GW / 2, -3.5);
  bar(8, GH + 70, -4, GH / 2 - 28);
  bar(8, GH + 70, GW + 4, GH / 2 - 28);
  // the banana trunk the puppets stand in, and the floor
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, GW + 40, 20),
    new THREE.MeshLambertMaterial({ color: '#4f5a2a' })
  );
  trunk.rotation.z = Math.PI / 2;
  trunk.position.set(GW / 2, -12, 26);
  trunk.receiveShadow = true;
  scene.add(trunk);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshLambertMaterial({ color: '#2a1810' })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(GW / 2, -18, 200);
  floor.receiveShadow = true;
  scene.add(floor);

  // the blencong: a brass lamp with a live flame
  const brass = new THREE.MeshLambertMaterial({
    color: '#c99a3e',
    emissive: '#3a2408',
  });
  const flameMat = new THREE.SpriteMaterial({
    map: texture(flameCanvas()),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  });
  const glowMat = flameMat.clone();
  const flames: THREE.Sprite[] = [];
  const lampParts: THREE.Object3D[] = [];
  for (const l of lights) {
    const body = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), brass);
    body.scale.set(1.6, 0.7, 1);
    body.position.set(l.position.x, LAMP_Y - 3.4, LAMP_Z + 1.5);
    const chain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 160, 6),
      brass
    );
    chain.position.set(l.position.x, LAMP_Y + 78, LAMP_Z + 1.5);
    const flame = new THREE.Sprite(flameMat);
    flame.position.copy(l.position);
    const glow = new THREE.Sprite(glowMat);
    glow.position.copy(l.position);
    glow.scale.set(80, 80, 1);
    flames.push(flame);
    lampParts.push(body, chain, flame, glow);
  }
  for (const o of lampParts) {
    o.visible = false;
    scene.add(o);
  }

  // the puppets, each where its shadow says it must be
  const faded: THREE.Material[] = [];
  let disposed = false;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  /** swap the painted stand-in for the 3D figure once it arrives */
  const loadModel = (
    p: PaintedPuppet,
    m: number,
    z: number,
    standIns: THREE.Object3D[]
  ) => {
    loader.load(
      modelUrl(p.id),
      (gltf) => {
        const model = gltf.scene;
        const pose = p.pose;
        const front = `front_${pose.arm}${pose.elbow}`;
        const back = `back_${pose.back}${pose.backElbow}`;
        // a model from before the two-armed puppets cannot show this pose:
        // the painted stand-in stays
        if (
          disposed ||
          !model.getObjectByName(front) ||
          !model.getObjectByName(back)
        ) {
          model.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.geometry.dispose();
              (o.material as THREE.Material).dispose();
            }
          });
          return;
        }
        for (const o of model.children) {
          if (/^(front|back)_\d\d$/.test(o.name))
            o.visible = o.name === front || o.name === back;
        }
        // the head turns about the neck (its node's origin), in figure space
        const head = model.getObjectByName('head');
        if (head) head.rotation.z = THREE.MathUtils.degToRad(HEAD[pose.head]!);
        const opacity = (faded[0] as THREE.Material | undefined)?.opacity ?? 0;
        model.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const g = o.geometry as THREE.BufferGeometry;
          if (!g.getAttribute('normal')) g.computeVertexNormals();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const mat of mats as THREE.Material[]) {
            mat.side = THREE.DoubleSide;
            mat.transparent = true;
            mat.opacity = opacity;
            faded.push(mat);
          }
        });
        // figure units -> kelir (the pose) -> world (back along the lamp's rays)
        const a = poseAffine(figure(p.id), p.pose);
        const s = DEPTH_SCALE[p.pose.d]! * UNIT;
        model.matrixAutoUpdate = false;
        model.matrix.set(
          a.a / m,
          a.c / m,
          0,
          LAMP_X + (a.e - LAMP_X) / m,
          a.b / m,
          a.d / m,
          0,
          LAMP_Y + (a.f - LAMP_Y) / m,
          0,
          0,
          s / m,
          z,
          0,
          0,
          0,
          1
        );
        scene.add(model);
        for (const o of standIns) o.visible = false;
      },
      undefined,
      () => {
        /* keep the painted stand-in */
      }
    );
  };
  /** what the final shot must hold: the lamp, the puppets, their shadows */
  const keep: THREE.Vector3[] = [
    lamp.position.clone(),
    lamp.position.clone().add(new THREE.Vector3(0, 10, 0)),
    lamp.position
      .clone()
      .add(new THREE.Vector3(-14 + (lampCount === 2 ? LAMP_B_DX : 0), 0, 0)),
    lamp.position.clone().add(new THREE.Vector3(14, 0, 0)),
  ];
  for (const p of puppets) {
    const m = magnify(p.pose.d);
    const z = LAMP_Z * (1 - 1 / m);
    const wx = (x: number) => LAMP_X + (x - LAMP_X) / m;
    const wy = (y: number) => LAMP_Y + (y - LAMP_Y) / m;
    const ax = wx(p.box.x0);
    const bx = wx(p.box.x1);
    const ay = wy(p.box.y0);
    const by = wy(p.box.y1);
    const geo = new THREE.PlaneGeometry(bx - ax, by - ay);
    const colorTex = texture(p.color);
    const front = new THREE.MeshLambertMaterial({
      map: colorTex,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(geo, front);
    mesh.position.set((ax + bx) / 2, (ay + by) / 2, z);
    scene.add(mesh);
    // the shadow comes from the exact scored silhouette, drawn by nothing
    // three.js copies map and alphaTest from this material into the shadow
    // pass, so the exact mask lives here; the material itself draws nothing
    const caster = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(p.mask),
        alphaTest: 0.5,
        colorWrite: false,
        depthWrite: false,
        // a one-sided caster would cast from its back faces only
        side: THREE.DoubleSide,
      })
    );
    caster.position.copy(mesh.position);
    caster.castShadow = true;
    scene.add(caster);
    // the leather's thickness, seen when the camera swings round
    const back = new THREE.MeshBasicMaterial({
      map: colorTex,
      color: '#2b190d',
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const edge = new THREE.Mesh(geo, back);
    edge.position.set(mesh.position.x + 0.15, mesh.position.y, z - 0.6);
    scene.add(edge);
    faded.push(front, back);
    loadModel(p, m, z, [mesh, edge]);
    for (const [x, y] of [
      [p.box.x0, p.box.y0],
      [p.box.x1, p.box.y1],
      [p.box.x0, p.box.y1],
      [p.box.x1, p.box.y0],
    ] as const) {
      keep.push(new THREE.Vector3(x, Math.max(0, y), 0));
      keep.push(new THREE.Vector3(wx(x), wy(y), z));
      // the second lamp's shadow, shifted along the cloth
      if (lampCount === 2)
        keep.push(
          new THREE.Vector3(
            Math.min(GW, x + lampShift(p.pose)),
            Math.max(0, y),
            0
          )
        );
    }
  }

  // camera: from the audience's square-on view to the dalang's side
  const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const lookStart = new THREE.Vector3(GW / 2, GH / 2, 0);
  const lookEnd = new THREE.Box3()
    .setFromPoints(keep)
    .getCenter(new THREE.Vector3());
  const dirOf = (yaw: number, el: number) =>
    new THREE.Vector3(
      Math.sin(yaw) * Math.cos(el),
      Math.sin(el),
      Math.cos(yaw) * Math.cos(el)
    );
  let aspect = 1;
  let d0 = 1;
  let d1 = 1;
  let yaw1 = 0.9;
  let el1 = 0.2;
  /** the distance at which every kept point fits the frame */
  const fitPoints = (dir: THREE.Vector3) => {
    const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    const up = dir.clone().cross(right).normalize();
    const tanH = tanV * aspect;
    let d = 0;
    const v = new THREE.Vector3();
    for (const p of keep) {
      v.copy(p).sub(lookEnd);
      const ahead = v.dot(dir);
      d = Math.max(
        d,
        ahead + Math.abs(v.dot(right)) / tanH,
        ahead + Math.abs(v.dot(up)) / tanV
      );
    }
    return d * 1.15;
  };
  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    aspect = w / h;
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    // a tall phone sees the stage from higher and more behind the lamp
    yaw1 = aspect < 1 ? 0.62 : 0.92;
    el1 = aspect < 1 ? 0.28 : 0.2;
    d0 = Math.max((GH / 2 + 4) / tanV, (GW / 2 + 4) / (tanV * aspect));
    d1 = fitPoints(dirOf(yaw1, el1));
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const look = new THREE.Vector3();
  const t0 = performance.now();
  let raf = 0;
  if (import.meta.env.DEV)
    // dev only: lets a test check that the final shot holds everything
    (window as unknown as Record<string, unknown>).__reveal = () =>
      keep.map((p) => {
        const v = p.clone().project(camera);
        return [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100];
      });
  const frame = (now: number) => {
    const ms = now - t0;
    const k = ease(Math.min(1, Math.max(0, (ms - SWING_START) / SWING_MS)));
    const drift =
      k >= 1 ? Math.sin((ms - SWING_START - SWING_MS) / 2600) * 0.05 : 0;
    look.copy(lookStart).lerp(lookEnd, k);
    camera.position
      .copy(dirOf(yaw1 * k + drift, el1 * k))
      .multiplyScalar(d0 + (d1 - d0) * k)
      .add(look);
    camera.lookAt(look);

    const show = smooth(0.12, 0.55, k);
    for (const mat of faded) mat.opacity = show;
    const lit = smooth(0.2, 0.6, k);
    for (const o of lampParts) o.visible = lit > 0;
    const s = ms / 1000;
    const flicker = 1 + 0.05 * Math.sin(s * 13.1) + 0.03 * Math.sin(s * 7.7);
    lights.forEach((l, n) => {
      // each wick flickers on its own
      l.intensity = power * (n === 0 ? flicker : 2 - flicker);
    });
    flameMat.opacity = lit;
    glowMat.opacity = lit * 0.5;
    for (const f of flames) f.scale.set(12 * flicker, 16 * flicker, 1);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const mat of mats as THREE.Material[]) {
            for (const v of Object.values(mat))
              if (v instanceof THREE.Texture) v.dispose();
            mat.dispose();
          }
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
};
