import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  PerspectiveCamera,
  Stars,
} from '@react-three/drei';
import * as THREE from 'three';
import Building from './Building.jsx';
import { getBuildingPositions, IPCA_GROUPS } from '../data/groups.js';
import { getProductPositions } from '../data/products.js';
import { ISLANDS, nearestIsland } from '../data/islands.js';
import {
  calculateAccumulatedIndex,
  calculateTwelveMonthInflation,
} from '../data/inflationMath.js';

const DEFAULT_CAM = [ISLANDS.groups.origin.x + 18, 16, ISLANDS.groups.origin.z + 22];
const DEFAULT_TARGET = [ISLANDS.groups.origin.x, 2, ISLANDS.groups.origin.z];
const WALK_SPEED = 12;
const SPRINT_MULT = 2.2;
const FLY_SPEED = 10;
const MAX_DISTANCE = 140;

/**
 * Canvas 3D — duas ilhas, ciclo dia/noite, água e movimento estilo Minecraft.
 */
export default function CityScene({
  groupsData,
  productsData,
  endDate,
  mode,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
  cameraResetKey,
  onActiveIslandChange,
  onTeleportRequest,
  teleportToken,
  timeOfDay = 'afternoon', // 'morning' | 'afternoon' | 'night'
}) {
  return (
    <div className="city-canvas">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        onPointerMissed={() => onSelect?.(null)}
      >
        <PerspectiveCamera makeDefault position={DEFAULT_CAM} fov={45} near={0.1} far={250} />
        <CameraController
          resetKey={cameraResetKey}
          teleportToken={teleportToken}
          onTeleportRequest={onTeleportRequest}
        />
        <WalkControls />
        <IslandTracker onActiveIslandChange={onActiveIslandChange} />
        <DayNightCycle timeOfDay={timeOfDay} />

        <Suspense fallback={null}>
          <WorldEnvironment />

          <CityDistrict
            island={ISLANDS.groups}
            items={buildGroupItems(groupsData, endDate, mode)}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onHover={onHover}
            onSelect={onSelect}
            idPrefix="g"
            roadSpacing={9.5}
            roadCols={3}
            roadRows={3}
          />

          <CityDistrict
            island={ISLANDS.selected}
            items={buildProductItems(productsData, endDate, mode)}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onHover={onHover}
            onSelect={onSelect}
            idPrefix="p"
            roadSpacing={7.2}
            roadCols={5}
            roadRows={7}
          />

          {/* ContactShadows removido: gerava disco escuro sob cada cidade */}
        </Suspense>

        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          minPolarAngle={0.12}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={5}
          maxDistance={MAX_DISTANCE}
          target={DEFAULT_TARGET}
          enableDamping
          dampingFactor={0.06}
        />
      </Canvas>
    </div>
  );
}

function buildGroupItems(groupsData, endDate, mode) {
  const positions = getBuildingPositions();
  return IPCA_GROUPS.map((meta, i) => {
    const data = groupsData?.[meta.id];
    const series = data?.series || [];
    const stats =
      mode === 'twelveMonths'
        ? calculateTwelveMonthInflation(series, endDate)
        : calculateAccumulatedIndex(series, endDate);
    return {
      group: { ...meta, ...(data || {}), id: meta.id },
      stats,
      position: positions[i],
      appearDelay: i * 0.06,
    };
  });
}

function buildProductItems(productsData, endDate, mode) {
  if (!productsData?.products) return [];
  const list = Object.values(productsData.products);
  const positions = getProductPositions(list.length, 5, 7.2);
  return list.map((meta, i) => {
    const series = meta.series || [];
    // Produtos: se endDate anterior ao início da série, acumula vazio (índice 1)
    const seriesStart = series[0]?.dateKey;
    const effectiveEnd =
      endDate && seriesStart && endDate < seriesStart ? seriesStart : endDate;
    const hasData = series.some((p) => !effectiveEnd || p.dateKey <= effectiveEnd);
    const stats = !hasData
      ? {
          index: 1,
          inflationPct: 0,
          floors: 10,
          monthsUsed: 0,
          startDate: seriesStart || null,
          endDate: null,
          lastMonthly: null,
          noDataYet: true,
        }
      : mode === 'twelveMonths'
        ? calculateTwelveMonthInflation(series, effectiveEnd)
        : calculateAccumulatedIndex(series, effectiveEnd);

    const code = String(meta.code || meta.id);
    return {
      group: {
        ...meta,
        // Prefixo evita colisão com ids numéricos dos 9 grupos (ex.: Educação = 8)
        id: `sel:${code}`,
        code,
        fullName: meta.fullName || meta.name,
        shortName: meta.shortName,
      },
      stats,
      position: positions[i],
      appearDelay: 0.3 + i * 0.03,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Controles                                                          */
/* ------------------------------------------------------------------ */

function CameraController({ resetKey, teleportToken }) {
  const { camera, controls } = useThree();
  const lastReset = useRef(resetKey);
  const lastTeleport = useRef(teleportToken);

  useFrame(() => {
    if (resetKey !== lastReset.current) {
      lastReset.current = resetKey;
      camera.position.set(...DEFAULT_CAM);
      if (controls) {
        controls.target.set(...DEFAULT_TARGET);
        controls.update();
      }
    }
    if (teleportToken && teleportToken !== lastTeleport.current) {
      lastTeleport.current = teleportToken;
      const { islandId } = teleportToken;
      const island = ISLANDS[islandId] || ISLANDS.groups;
      const ox = island.origin.x;
      const oz = island.origin.z;
      camera.position.set(ox + 18, 16, oz + 22);
      if (controls) {
        controls.target.set(ox, 2, oz);
        controls.update();
      }
    }
  });

  return null;
}

/** WASD + Space/Ctrl + Shift (Minecraft-like) */
function WalkControls() {
  const { camera, controls } = useThree();
  const keys = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    up: false,
    down: false,
    sprint: false,
  });

  useEffect(() => {
    const isTyping = (el) => {
      if (!el || !(el instanceof HTMLElement)) return false;
      const t = el.tagName;
      return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable;
    };

    const setKey = (e, pressed) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.w = pressed;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.current.s = pressed;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.a = pressed;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.current.d = pressed;
          break;
        case 'Space':
          keys.current.up = pressed;
          break;
        case 'ControlLeft':
        case 'ControlRight':
          keys.current.down = pressed;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.sprint = pressed;
          break;
        default:
          break;
      }
    };

    const block = [
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Space', 'ControlLeft', 'ControlRight',
    ];

    const onDown = (e) => {
      if (isTyping(e.target)) return;
      if (block.includes(e.code)) e.preventDefault();
      setKey(e, true);
    };
    const onUp = (e) => setKey(e, false);
    const onBlur = () => {
      keys.current = {
        w: false, a: false, s: false, d: false,
        up: false, down: false, sprint: false,
      };
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useFrame((_, delta) => {
    const k = keys.current;
    if (!k.w && !k.a && !k.s && !k.d && !k.up && !k.down) return;

    const dt = Math.min(delta, 0.05);
    const speed = WALK_SPEED * (k.sprint ? SPRINT_MULT : 1);

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    else forward.normalize();

    const right = new THREE.Vector3()
      .crossVectors(forward, new THREE.Vector3(0, 1, 0))
      .normalize();

    const move = new THREE.Vector3();
    if (k.w) move.add(forward);
    if (k.s) move.sub(forward);
    if (k.d) move.add(right);
    if (k.a) move.sub(right);

    if (move.lengthSq() > 1e-8) {
      move.normalize().multiplyScalar(speed * dt);
    }

    // Vertical (Space / Ctrl)
    if (k.up) move.y += FLY_SPEED * (k.sprint ? SPRINT_MULT : 1) * dt;
    if (k.down) move.y -= FLY_SPEED * (k.sprint ? SPRINT_MULT : 1) * dt;

    if (move.lengthSq() < 1e-10) return;

    camera.position.add(move);
    // Limite de altura mínima
    if (camera.position.y < 1.2) camera.position.y = 1.2;

    if (controls?.target) {
      controls.target.add(move);
      if (controls.target.y < 0.5) controls.target.y = 0.5;
      controls.update();
    }
  });

  return null;
}

function IslandTracker({ onActiveIslandChange }) {
  const { camera } = useThree();
  const last = useRef(null);

  useFrame(() => {
    if (!onActiveIslandChange) return;
    const island = nearestIsland(camera.position.x, camera.position.z);
    if (island.id !== last.current) {
      last.current = island.id;
      onActiveIslandChange(island.id);
    }
  });

  return null;
}

/* ------------------------------------------------------------------ */
/*  Iluminação fixa: manhã | tarde | noite (controlada pelo usuário)   */
/* ------------------------------------------------------------------ */

const TIME_PRESETS = {
  morning: {
    sunPos: [28, 18, 22],
    sunIntensity: 1.15,
    sunColor: '#fff1d6',
    moonIntensity: 0,
    ambient: 0.42,
    ambientColor: '#e8f0ff',
    hemiSky: '#c5ddf5',
    hemiGround: '#6a9b55',
    hemiIntensity: 0.55,
    sky: '#9ec9ef',
    fogNear: 120,
    fogFar: 300,
    exposure: 1.08,
    stars: false,
  },
  afternoon: {
    sunPos: [12, 32, 8],
    sunIntensity: 1.45,
    sunColor: '#fff8e8',
    moonIntensity: 0,
    ambient: 0.48,
    ambientColor: '#dceaf8',
    hemiSky: '#b8d4f0',
    hemiGround: '#5a8f4a',
    hemiIntensity: 0.6,
    sky: '#87b8e0',
    fogNear: 130,
    fogFar: 310,
    exposure: 1.12,
    stars: false,
  },
  night: {
    sunPos: [-20, 8, -15],
    sunIntensity: 0.08,
    sunColor: '#6b7c9c',
    moonIntensity: 0.45,
    ambient: 0.18,
    ambientColor: '#1a2744',
    hemiSky: '#1e293b',
    hemiGround: '#0f1a12',
    hemiIntensity: 0.28,
    sky: '#070b14',
    fogNear: 90,
    fogFar: 240,
    exposure: 0.95,
    stars: true,
  },
};

function cloneTimePreset(id) {
  const p = TIME_PRESETS[id] || TIME_PRESETS.afternoon;
  return { ...p, sunPos: [...p.sunPos] };
}

function DayNightCycle({ timeOfDay = 'afternoon' }) {
  const sunRef = useRef();
  const moonRef = useRef();
  const ambientRef = useRef();
  const hemiRef = useRef();
  const starsRef = useRef();
  const { scene, gl } = useThree();
  const fogRef = useRef();
  const target = useRef(cloneTimePreset('afternoon'));
  const current = useRef(cloneTimePreset('afternoon'));

  useEffect(() => {
    scene.fog = new THREE.Fog('#a8c8e0', 130, 310);
    fogRef.current = scene.fog;
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useEffect(() => {
    target.current = cloneTimePreset(timeOfDay);
  }, [timeOfDay]);

  useFrame((_, delta) => {
    const t = Math.min(1, delta * 2.2); // transição suave ao trocar o toggle
    const cur = current.current;
    const tgt = target.current;

    // Lerp numéricos
    cur.sunIntensity += (tgt.sunIntensity - cur.sunIntensity) * t;
    cur.moonIntensity += (tgt.moonIntensity - cur.moonIntensity) * t;
    cur.ambient += (tgt.ambient - cur.ambient) * t;
    cur.hemiIntensity += (tgt.hemiIntensity - cur.hemiIntensity) * t;
    cur.fogNear += (tgt.fogNear - cur.fogNear) * t;
    cur.fogFar += (tgt.fogFar - cur.fogFar) * t;
    cur.exposure += (tgt.exposure - cur.exposure) * t;

    // Lerp posições do sol
    for (let i = 0; i < 3; i++) {
      cur.sunPos[i] += (tgt.sunPos[i] - cur.sunPos[i]) * t;
    }

    if (sunRef.current) {
      sunRef.current.position.set(...cur.sunPos);
      sunRef.current.intensity = cur.sunIntensity;
      sunRef.current.color.set(tgt.sunColor);
    }
    if (moonRef.current) {
      moonRef.current.position.set(-cur.sunPos[0] * 0.6, 22, -cur.sunPos[2] * 0.6);
      moonRef.current.intensity = cur.moonIntensity;
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = cur.ambient;
      ambientRef.current.color.set(tgt.ambientColor);
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = cur.hemiIntensity;
      hemiRef.current.color.set(tgt.hemiSky);
      hemiRef.current.groundColor.set(tgt.hemiGround);
    }

    scene.background = new THREE.Color(tgt.sky);
    if (fogRef.current) {
      fogRef.current.color.set(tgt.sky);
      fogRef.current.near = cur.fogNear;
      fogRef.current.far = cur.fogFar;
    }
    if (gl) gl.toneMappingExposure = cur.exposure;

    if (starsRef.current) {
      starsRef.current.visible = Boolean(tgt.stars);
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.48} color="#dceaf8" />
      <hemisphereLight ref={hemiRef} args={['#b8d4f0', '#5a8f4a', 0.6]} />
      <directionalLight
        ref={sunRef}
        castShadow
        position={[12, 32, 8]}
        intensity={1.45}
        color="#fff8e8"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={140}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-bias={-0.0002}
      />
      <directionalLight ref={moonRef} position={[-15, 22, -10]} intensity={0} color="#93c5fd" />
      <group ref={starsRef} visible={false}>
        <Stars
          radius={140}
          depth={60}
          count={1800}
          factor={3.5}
          saturation={0}
          fade
          speed={0.15}
        />
      </group>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Mundo: campo, rios, cidades orgânicas, natureza                    */
/* ------------------------------------------------------------------ */

function WorldEnvironment() {
  const grassTex = useMemo(() => createFieldTexture(), []);
  const waterRef = useRef();

  useFrame(({ clock }) => {
    if (waterRef.current) {
      // Água ligeiramente acima do campo para não sumir por z-fight
      waterRef.current.position.y = 0.06 + Math.sin(clock.elapsedTime * 0.55) * 0.025;
    }
  });

  return (
    <group>
      {/* Campo / chão do mundo (quadrado, gramado — não preto) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4, 0, 0]} receiveShadow>
        <planeGeometry args={[180, 140]} />
        <meshStandardMaterial
          map={grassTex}
          roughness={0.95}
          metalness={0.02}
          color="#5a8f4a"
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Colinas suaves no fundo */}
      <Hills />

      {/* Sistema de rios */}
      <group ref={waterRef}>
        <RiverSystem />
      </group>

      {/* Areia nas margens do rio principal */}
      <RiverBanks />

      {/* Ponte entre as duas cidades */}
      <Bridge />

      {/* Natureza espalhada no campo */}
      <NatureScatter />
    </group>
  );
}

/** Rio principal (N–S entre cidades) + afluentes sinuosos */
function RiverSystem() {
  const waterMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1d7aad',
        metalness: 0.35,
        roughness: 0.18,
        emissive: '#0c4a6e',
        emissiveIntensity: 0.18,
        transparent: true,
        opacity: 0.94,
      }),
    []
  );

  // Segmentos do rio principal (faixas retangulares levemente rotacionadas)
  const main = useMemo(() => {
    const segs = [];
    const z0 = -55;
    const z1 = 55;
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const zA = z0 + (z1 - z0) * t0;
      const zB = z0 + (z1 - z0) * t1;
      const xA = 3 + Math.sin(t0 * Math.PI * 2.2) * 4.5;
      const xB = 3 + Math.sin(t1 * Math.PI * 2.2) * 4.5;
      const midZ = (zA + zB) / 2;
      const midX = (xA + xB) / 2;
      const len = Math.hypot(xB - xA, zB - zA) + 0.8;
      const angle = Math.atan2(xB - xA, zB - zA);
      const width = 9.5 + Math.sin(t0 * 5) * 1.8;
      segs.push({ x: midX, z: midZ, len, width, angle });
    }
    return segs;
  }, []);

  // Afluente oeste (abraça cidade dos grupos)
  const west = useMemo(
    () => [
      { x: -48, z: -22, w: 5.5, d: 18, rot: 0.4 },
      { x: -42, z: 8, w: 5, d: 16, rot: -0.35 },
      { x: -38, z: 28, w: 4.5, d: 14, rot: 0.25 },
    ],
    []
  );
  // Afluente leste
  const east = useMemo(
    () => [
      { x: 58, z: -18, w: 5, d: 16, rot: -0.3 },
      { x: 62, z: 12, w: 5.5, d: 18, rot: 0.4 },
      { x: 54, z: 32, w: 4.5, d: 12, rot: -0.2 },
    ],
    []
  );

  return (
    <group>
      {main.map((s, i) => (
        <mesh
          key={`m${i}`}
          rotation={[-Math.PI / 2, 0, s.angle]}
          position={[s.x, 0, s.z]}
          receiveShadow
          material={waterMat}
        >
          <planeGeometry args={[s.width, s.len]} />
        </mesh>
      ))}
      {west.map((s, i) => (
        <mesh
          key={`w${i}`}
          rotation={[-Math.PI / 2, 0, s.rot]}
          position={[s.x, 0, s.z]}
          material={waterMat}
          receiveShadow
        >
          <planeGeometry args={[s.w, s.d]} />
        </mesh>
      ))}
      {east.map((s, i) => (
        <mesh
          key={`e${i}`}
          rotation={[-Math.PI / 2, 0, s.rot]}
          position={[s.x, 0, s.z]}
          material={waterMat}
          receiveShadow
        >
          <planeGeometry args={[s.w, s.d]} />
        </mesh>
      ))}
      {/* Lagoas (y local 0; o grupo waterRef sobe o conjunto) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8, 0, -38]} material={waterMat}>
        <circleGeometry args={[6, 28]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[48, 0, 40]} material={waterMat}>
        <circleGeometry args={[5.5, 28]} />
      </mesh>
    </group>
  );
}

function RiverBanks() {
  const sand = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#c2a878',
        roughness: 0.95,
        metalness: 0.02,
      }),
    []
  );
  const banks = useMemo(() => {
    const list = [];
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const z = -50 + t * 100;
      const x = 3 + Math.sin(t * Math.PI * 2.2) * 4.5;
      list.push({ x: x - 6.2, z, s: 3.2 + (i % 3) * 0.4 });
      list.push({ x: x + 6.2, z, s: 3.0 + (i % 2) * 0.5 });
    }
    return list;
  }, []);

  return (
    <group>
      {banks.map((b, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, (i % 5) * 0.2]}
          position={[b.x, 0.03, b.z]}
          receiveShadow
          material={sand}
        >
          <circleGeometry args={[b.s, 10]} />
        </mesh>
      ))}
    </group>
  );
}

function Hills() {
  const hills = useMemo(() => {
    const rng = mulberry32(99);
    const list = [];
    for (let i = 0; i < 18; i++) {
      list.push({
        x: -70 + rng() * 150,
        z: -55 + rng() * 20,
        s: 4 + rng() * 8,
        h: 1.2 + rng() * 2.5,
      });
      list.push({
        x: -70 + rng() * 150,
        z: 40 + rng() * 20,
        s: 4 + rng() * 8,
        h: 1.2 + rng() * 2.5,
      });
    }
    return list;
  }, []);

  return (
    <group>
      {hills.map((h, i) => (
        <mesh
          key={i}
          position={[h.x, h.h * 0.15, h.z]}
          scale={[h.s, h.h, h.s * 0.85]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#4a7c45" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Bridge() {
  const g = ISLANDS.groups.origin;
  const s = ISLANDS.selected.origin;
  const midX = (g.x + s.x) / 2;
  // Comprimento da ponte = vão do rio + acesso
  const length = Math.abs(s.x - g.x) - (ISLANDS.groups.halfW + ISLANDS.selected.halfW) * 0.55;
  const bridgeLen = Math.max(length, 18);

  return (
    <group position={[midX, 0.55, 0]}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[bridgeLen, 0.28, 4.2]} />
        <meshStandardMaterial color="#64748b" metalness={0.35} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.4, 2.0]}>
        <boxGeometry args={[bridgeLen, 0.18, 0.14]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.45} />
      </mesh>
      <mesh position={[0, 0.4, -2.0]}>
        <boxGeometry args={[bridgeLen, 0.18, 0.14]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.45} />
      </mesh>
      {[-0.4, -0.15, 0.15, 0.4].map((t, i) => (
        <mesh key={i} position={[t * bridgeLen, -0.55, 0]} castShadow>
          <boxGeometry args={[0.7, 1.5, 0.7]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      ))}
      <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[bridgeLen * 0.92, 0.14]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
      {/* Rampas de acesso */}
      <mesh position={[-bridgeLen / 2 - 2.2, 0.15, 0]} rotation={[0, 0, 0.18]} castShadow>
        <boxGeometry args={[5, 0.22, 4]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      <mesh position={[bridgeLen / 2 + 2.2, 0.15, 0]} rotation={[0, 0, -0.18]} castShadow>
        <boxGeometry args={[5, 0.22, 4]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
    </group>
  );
}

/**
 * Distrito urbano: terreno orgânico + grade de ruas + prédios + parque + postes.
 */
function CityDistrict({
  island,
  items,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
  idPrefix,
  roadSpacing,
  roadCols,
  roadRows,
}) {
  const { x, z } = island.origin;
  const shapeGeom = useMemo(
    () => createIslandGeometry(island.shoreline),
    [island.shoreline]
  );
  const cliffGeom = useMemo(
    () => createIslandCliffGeometry(island.shoreline),
    [island.shoreline]
  );
  const grassTex = useMemo(
    () => createCityGrassTexture(island.groundColor),
    [island.groundColor]
  );

  return (
    <group position={[x, 0, z]}>
      {/*
        Base da cidade: topo VERDE (não disco preto).
        A falésia é só a lateral (material terra), sem face superior escura.
      */}
      <mesh geometry={cliffGeom} castShadow receiveShadow>
        <meshStandardMaterial color="#7a6a52" roughness={0.95} flatShading={false} />
      </mesh>

      {/* Superfície gramada — normais para cima + offset para evitar z-fight */}
      <mesh
        geometry={shapeGeom}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.12, 0]}
        receiveShadow
        renderOrder={1}
      >
        <meshStandardMaterial
          map={grassTex}
          roughness={0.9}
          metalness={0.02}
          color="#6fad58"
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* Areia só na borda (anel: shape maior semi-transparente por baixo da grama na orla) */}
      <mesh
        geometry={shapeGeom}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.1, 0]}
        scale={[1.06, 1.06, 1]}
        receiveShadow
      >
        <meshStandardMaterial
          color="#d2b48c"
          roughness={1}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Grama por cima da areia no miolo (scale 1) — já desenhada acima em y=0.12 */}

      {/* Grade de avenidas */}
      <StreetGrid
        spacing={roadSpacing}
        cols={roadCols}
        rows={roadRows}
        color={island.asphaltColor}
      />

      {/* Calçadas / quarteirões sob prédios */}
      {items.map((b) => (
        <mesh
          key={`lot-${b.group.id}`}
          position={[b.position.x, 0.14, b.position.z]}
          receiveShadow
        >
          <boxGeometry args={[4.2, 0.06, 4.0]} />
          <meshStandardMaterial color="#4a5568" roughness={0.85} />
        </mesh>
      ))}

      {/* Parque com lago — fora do cruzamento central das avenidas */}
      <CityPark accent={island.accent} />

      {/* Postes de luz nas avenidas */}
      <StreetLights spacing={roadSpacing} cols={roadCols} rows={roadRows} />

      {/* Árvores de bairro */}
      <DistrictTrees shoreline={island.shoreline} seed={island.id === 'groups' ? 3 : 11} />

      {/* Placa da cidade */}
      <group position={[0, 0.2, -island.halfD - 1]}>
        <mesh castShadow>
          <boxGeometry args={[5.2, 1.2, 0.18]} />
          <meshStandardMaterial color="#0f172a" metalness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.1]}>
          <boxGeometry args={[4.8, 0.9, 0.03]} />
          <meshStandardMaterial
            color={island.accent}
            emissive={island.accent}
            emissiveIntensity={0.3}
          />
        </mesh>
      </group>

      {/* Prédios */}
      {items.map((b) => (
        <Building
          key={`${idPrefix}-${b.group.id}`}
          group={b.group}
          stats={b.stats}
          position={b.position}
          selected={selectedId === b.group.id}
          hovered={hoveredId === b.group.id}
          onHover={onHover}
          onSelect={onSelect}
          appearDelay={b.appearDelay}
        />
      ))}
    </group>
  );
}

function StreetGrid({ spacing, cols, rows, color }) {
  const roads = useMemo(() => {
    const list = [];
    const halfC = (cols - 1) / 2;
    const halfR = (rows - 1) / 2;
    const roadW = 2.4;
    // Horizontais (ao longo de X) — entre linhas de quarteirões e nas bordas
    for (let r = 0; r <= rows; r++) {
      const z = (r - halfR - 0.5) * spacing;
      const len = cols * spacing + 4;
      list.push({ x: 0, z, w: len, d: roadW, rot: 0 });
    }
    // Verticais (ao longo de Z)
    for (let c = 0; c <= cols; c++) {
      const x = (c - halfC - 0.5) * spacing;
      const len = rows * spacing + 4;
      list.push({ x, z: 0, w: roadW, d: len, rot: 0 });
    }
    return list;
  }, [spacing, cols, rows]);

  return (
    <group>
      {roads.map((rd, i) => (
        <group key={i} position={[rd.x, 0.135, rd.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[rd.w, rd.d]} />
            <meshStandardMaterial
              color={color || '#3d4a5c'}
              roughness={0.75}
              metalness={0.15}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* faixa tracejada */}
          {(rd.w > rd.d ? rd.w : rd.d) > 8 && (
            <mesh rotation={[-Math.PI / 2, 0, rd.w > rd.d ? 0 : Math.PI / 2]} position={[0, 0.01, 0]}>
              <planeGeometry args={[Math.max(rd.w, rd.d) * 0.85, 0.1]} />
              <meshBasicMaterial color="#eab308" transparent opacity={0.55} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function StreetLights({ spacing, cols, rows }) {
  const lamps = useMemo(() => {
    const list = [];
    const halfC = (cols - 1) / 2;
    const halfR = (rows - 1) / 2;
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        // só cruzamentos (não todos)
        if ((r + c) % 2 === 0) continue;
        list.push({
          x: (c - halfC - 0.5) * spacing + 1.1,
          z: (r - halfR - 0.5) * spacing + 1.1,
        });
      }
    }
    return list;
  }, [spacing, cols, rows]);

  return (
    <group>
      {lamps.map((p, i) => (
        <group key={i} position={[p.x, 0.12, p.z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.05, 0.07, 2.4, 6]} />
            <meshStandardMaterial color="#475569" metalness={0.5} />
          </mesh>
          <mesh position={[0, 1.3, 0]}>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshStandardMaterial color="#fef9c3" emissive="#fde047" emissiveIntensity={0.95} />
          </mesh>
          <pointLight position={[0, 1.25, 0]} color="#fde68a" intensity={0.28} distance={9} />
        </group>
      ))}
    </group>
  );
}

/** Parque num quarteirão livre (NE do centro), fora do cruzamento das avenidas */
const PARK_OFFSET = { x: 4.6, z: -4.6 };

function CityPark({ accent }) {
  return (
    <group position={[PARK_OFFSET.x, 0.16, PARK_OFFSET.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[3.6, 28]} />
        <meshStandardMaterial color="#4d8a42" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[3.35, 3.65, 28]} />
        <meshBasicMaterial color={accent} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* Lago do parque — bem acima do chão, bem azul */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[1.6, 24]} />
        <meshStandardMaterial
          color="#1da2d8"
          emissive="#0e7490"
          emissiveIntensity={0.25}
          metalness={0.35}
          roughness={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      {[-1.8, 1.8].map((ox, i) => (
        <Tree key={i} x={ox} z={1.6} s={0.9} />
      ))}
      {[-1.5, 1.5].map((ox, i) => (
        <Tree key={`b${i}`} x={ox} z={-1.7} s={0.75} />
      ))}
    </group>
  );
}

function DistrictTrees({ shoreline, seed }) {
  const trees = useMemo(() => {
    const rng = mulberry32(seed * 97);
    const list = [];
    // árvores ao longo da orla (pontos do shoreline)
    for (let i = 0; i < shoreline.length; i++) {
      const [sx, sz] = shoreline[i];
      // para dentro da ilha
      const inward = 0.82;
      list.push({
        x: sx * inward + (rng() - 0.5) * 1.5,
        z: sz * inward + (rng() - 0.5) * 1.5,
        s: 0.65 + rng() * 0.55,
      });
      if (rng() > 0.45) {
        list.push({
          x: sx * 0.7 + (rng() - 0.5) * 2,
          z: sz * 0.7 + (rng() - 0.5) * 2,
          s: 0.55 + rng() * 0.4,
        });
      }
    }
    return list;
  }, [shoreline, seed]);

  return (
    <group>
      {trees.map((t, i) => (
        <Tree key={i} x={t.x} z={t.z} s={t.s} />
      ))}
    </group>
  );
}

function NatureScatter() {
  const items = useMemo(() => {
    const rng = mulberry32(42);
    const trees = [];
    const bushes = [];
    // Campos ao redor das cidades, evitando rio central (~x=3)
    for (let i = 0; i < 90; i++) {
      let x = -75 + rng() * 155;
      let z = -55 + rng() * 110;
      // evita centros urbanos
      const dg = Math.hypot(x - ISLANDS.groups.origin.x, z - ISLANDS.groups.origin.z);
      const ds = Math.hypot(x - ISLANDS.selected.origin.x, z - ISLANDS.selected.origin.z);
      if (dg < 22 || ds < 26) continue;
      // evita leito do rio
      if (Math.abs(x - 3) < 8 && Math.abs(z) < 50) continue;
      trees.push({ x, z, s: 0.6 + rng() * 0.9 });
    }
    for (let i = 0; i < 50; i++) {
      let x = -70 + rng() * 145;
      let z = -50 + rng() * 100;
      const dg = Math.hypot(x - ISLANDS.groups.origin.x, z - ISLANDS.groups.origin.z);
      const ds = Math.hypot(x - ISLANDS.selected.origin.x, z - ISLANDS.selected.origin.z);
      if (dg < 20 || ds < 24) continue;
      if (Math.abs(x - 3) < 7) continue;
      bushes.push({ x, z, s: 0.4 + rng() * 0.5 });
    }
    return { trees, bushes };
  }, []);

  return (
    <group>
      {items.trees.map((t, i) => (
        <Tree key={`t${i}`} x={t.x} z={t.z} s={t.s} />
      ))}
      {items.bushes.map((b, i) => (
        <mesh key={`b${i}`} position={[b.x, 0.25 * b.s, b.z]} scale={b.s} castShadow>
          <sphereGeometry args={[0.55, 8, 8]} />
          <meshStandardMaterial color="#3f7a38" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Tree({ x, z, s = 1 }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.13, 0.9, 6]} />
        <meshStandardMaterial color="#6b4423" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.15, 0]} castShadow>
        <coneGeometry args={[0.65, 1.2, 7]} />
        <meshStandardMaterial color="#1f6b32" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow>
        <coneGeometry args={[0.48, 0.9, 7]} />
        <meshStandardMaterial color="#2d8a42" roughness={0.95} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Geometria orgânica de ilha                                         */
/* ------------------------------------------------------------------ */

function createIslandGeometry(shoreline) {
  const shape = new THREE.Shape();
  shoreline.forEach(([px, pz], i) => {
    if (i === 0) shape.moveTo(px, pz);
    else shape.lineTo(px, pz);
  });
  shape.closePath();
  // suaviza com curvas leves via pontos intermediários já densos
  const geom = new THREE.ShapeGeometry(shape, 12);
  return geom;
}

/**
 * Falésia: extrude com topo oculto (só laterais de terra).
 * O topo escuro era o “disco preto” sob a cidade.
 */
function createIslandCliffGeometry(shoreline) {
  const shape = new THREE.Shape();
  shoreline.forEach(([px, pz], i) => {
    if (i === 0) shape.moveTo(px, pz);
    else shape.lineTo(px, pz);
  });
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.85,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.2,
    bevelSegments: 2,
  });
  // Extrude em +Z → rotaciona para -Y (base para baixo)
  geom.rotateX(Math.PI / 2);
  // Empurra para que o topo fique ~ y=0.08 e a base desça
  geom.translate(0, -0.85, 0);

  // Remove faces quase horizontais do topo (normais apontando para +Y)
  // para não aparecer um “disco” escuro sob a grama.
  const normals = geom.attributes.normal;
  const indices = geom.index ? Array.from(geom.index.array) : null;
  if (indices && normals) {
    const keep = [];
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i];
      const ny =
        (normals.getY(a) + normals.getY(indices[i + 1]) + normals.getY(indices[i + 2])) / 3;
      // Mantém laterais; descarta topo (ny alto) e fundo (ny bem negativo opcional)
      if (ny < 0.65) keep.push(indices[i], indices[i + 1], indices[i + 2]);
    }
    geom.setIndex(keep);
    geom.computeVertexNormals();
  }

  return geom;
}

/* ------------------------------------------------------------------ */
/*  Texturas                                                            */
/* ------------------------------------------------------------------ */

function createFieldTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  // base verde viva
  const grd = ctx.createLinearGradient(0, 0, size, size);
  grd.addColorStop(0, '#5f9a4e');
  grd.addColorStop(0.5, '#4f8a42');
  grd.addColorStop(1, '#6aa856');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  // ruído de grama
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = 80 + Math.floor(Math.random() * 100);
    ctx.fillStyle = `rgba(${40 + Math.random() * 40},${g},40,${0.08 + Math.random() * 0.12})`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 2 + Math.random() * 3);
  }
  // manchas mais claras
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(180,210,100,${0.04 + Math.random() * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * size,
      Math.random() * size,
      20 + Math.random() * 40,
      15 + Math.random() * 30,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 11);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCityGrassTexture(hex) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = hex || '#3d5c3a';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.07})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  for (let i = 0; i < 2000; i++) {
    ctx.fillStyle = `rgba(30,80,30,${Math.random() * 0.15})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
