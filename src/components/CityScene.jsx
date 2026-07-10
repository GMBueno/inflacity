import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  PerspectiveCamera,
  Stars,
  ContactShadows,
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

const DEFAULT_CAM = [14, 12, 16];
const DEFAULT_TARGET = [0, 3, 0];
const WALK_SPEED = 12;
const SPRINT_MULT = 2.2;
const FLY_SPEED = 10;
const MAX_DISTANCE = 100;

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
        <DayNightCycle />

        <Suspense fallback={null}>
          <WorldEnvironment />

          {/* Ilha dos Grupos */}
          <IslandPlate island={ISLANDS.groups} label="Grupos IPCA" />
          <group position={[ISLANDS.groups.origin.x, 0, ISLANDS.groups.origin.z]}>
            <CityBuildings
              items={buildGroupItems(groupsData, endDate, mode)}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onHover={onHover}
              onSelect={onSelect}
              idPrefix="g"
            />
          </group>

          {/* Ilha dos Selecionados */}
          <IslandPlate island={ISLANDS.selected} label="Selecionados" />
          <group position={[ISLANDS.selected.origin.x, 0, ISLANDS.selected.origin.z]}>
            <CityBuildings
              items={buildProductItems(productsData, endDate, mode)}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onHover={onHover}
              onSelect={onSelect}
              idPrefix="p"
            />
          </group>

          <ContactShadows
            position={[0, 0.02, 0]}
            opacity={0.4}
            scale={120}
            blur={2.8}
            far={20}
            color="#000"
          />
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
  const positions = getProductPositions(list.length, 6, 4.0);
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
      camera.position.set(ox + 14, 12, oz + 16);
      if (controls) {
        controls.target.set(ox, 3, oz);
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
/*  Dia / noite                                                        */
/* ------------------------------------------------------------------ */

function DayNightCycle() {
  const sunRef = useRef();
  const moonRef = useRef();
  const ambientRef = useRef();
  const hemiRef = useRef();
  const { scene } = useThree();
  const fogRef = useRef();

  useEffect(() => {
    scene.fog = new THREE.Fog('#87b5d9', 45, 140);
    fogRef.current = scene.fog;
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame(({ clock }) => {
    // Ciclo ~90s
    const t = (clock.elapsedTime / 90) % 1;
    const angle = t * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle) * 40;
    const sunZ = Math.sin(angle * 0.3) * 20;

    // dayFactor: 0 noite, 1 dia
    const dayFactor = THREE.MathUtils.clamp(sunY * 1.2 + 0.35, 0, 1);
    const nightFactor = 1 - dayFactor;

    if (sunRef.current) {
      sunRef.current.position.set(sunX, Math.max(sunY * 35, -5), sunZ);
      sunRef.current.intensity = 0.15 + dayFactor * 1.5;
      sunRef.current.color.setHSL(0.12, 0.35, 0.55 + dayFactor * 0.35);
    }
    if (moonRef.current) {
      moonRef.current.position.set(-sunX * 0.7, Math.max(-sunY * 28, 4), -sunZ);
      moonRef.current.intensity = nightFactor * 0.35;
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = 0.12 + dayFactor * 0.35;
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = 0.2 + dayFactor * 0.45;
      hemiRef.current.color.set(dayFactor > 0.4 ? '#b8d4f0' : '#1e293b');
      hemiRef.current.groundColor.set(dayFactor > 0.4 ? '#3d4f3a' : '#0a1220');
    }

    // Céu / névoa
    const skyDay = new THREE.Color('#87b5d9');
    const skyDusk = new THREE.Color('#f97316');
    const skyNight = new THREE.Color('#070b14');
    let sky;
    if (dayFactor > 0.55) {
      sky = skyDay.clone().lerp(skyDusk, 1 - dayFactor);
    } else if (dayFactor > 0.2) {
      sky = skyDusk.clone().lerp(skyNight, 1 - dayFactor / 0.55);
    } else {
      sky = skyNight.clone();
    }
    scene.background = sky;
    if (fogRef.current) {
      fogRef.current.color.copy(sky);
      fogRef.current.near = 40 + nightFactor * 10;
      fogRef.current.far = 120 + nightFactor * 20;
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.3} color="#c7d7ea" />
      <hemisphereLight ref={hemiRef} args={['#b8d4f0', '#3d4f3a', 0.4]} />
      <directionalLight
        ref={sunRef}
        castShadow
        position={[20, 30, 10]}
        intensity={1.3}
        color="#fff4e0"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={120}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-bias={-0.0002}
      />
      <directionalLight ref={moonRef} position={[-15, 12, -10]} intensity={0.15} color="#93c5fd" />
      <Stars
        radius={140}
        depth={60}
        count={1800}
        factor={3.5}
        saturation={0}
        fade
        speed={0.2}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Mundo: água, ilhas, ruas, ponte                                    */
/* ------------------------------------------------------------------ */

function WorldEnvironment() {
  const waterMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#0c4a6e',
        metalness: 0.15,
        roughness: 0.25,
        transmission: 0.15,
        transparent: true,
        opacity: 0.92,
        emissive: '#082f49',
        emissiveIntensity: 0.15,
      }),
    []
  );

  const waterRef = useRef();
  useFrame(({ clock }) => {
    if (waterRef.current) {
      waterRef.current.position.y = -0.35 + Math.sin(clock.elapsedTime * 0.6) * 0.04;
    }
  });

  return (
    <group>
      {/* Oceano */}
      <mesh
        ref={waterRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[26, -0.35, 0]}
        receiveShadow
        material={waterMat}
      >
        <planeGeometry args={[160, 120, 1, 1]} />
      </mesh>

      {/* Fundo escuro sob a água */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[26, -0.8, 0]}>
        <planeGeometry args={[160, 120]} />
        <meshStandardMaterial color="#020617" />
      </mesh>

      {/* Rio entre as ilhas (faixa) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[26, -0.28, 0]} receiveShadow>
        <planeGeometry args={[18, 50]} />
        <meshPhysicalMaterial
          color="#0369a1"
          metalness={0.2}
          roughness={0.2}
          transparent
          opacity={0.88}
          emissive="#0c4a6e"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Ponte entre ilhas */}
      <Bridge />

      {/* Árvores decorativas nas margens */}
      <TreeLine />
    </group>
  );
}

function Bridge() {
  const g = ISLANDS.groups.origin;
  const s = ISLANDS.selected.origin;
  const midX = (g.x + s.x) / 2;
  const length = Math.abs(s.x - g.x) - 28;
  return (
    <group position={[midX, 0.4, 0]}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[length, 0.25, 3.2]} />
        <meshStandardMaterial color="#475569" metalness={0.4} roughness={0.55} />
      </mesh>
      {/* Guardrails */}
      <mesh position={[0, 0.35, 1.5]}>
        <boxGeometry args={[length, 0.15, 0.12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.35, -1.5]}>
        <boxGeometry args={[length, 0.15, 0.12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.5} />
      </mesh>
      {/* Pilares */}
      {[-0.35, 0, 0.35].map((t, i) => (
        <mesh key={i} position={[t * length, -0.6, 0]} castShadow>
          <boxGeometry args={[0.6, 1.4, 0.6]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      ))}
      {/* Faixa central */}
      <mesh position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[length * 0.9, 0.12]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
    </group>
  );
}

function TreeLine() {
  const trees = useMemo(() => {
    const list = [];
    const rng = mulberry32(7);
    for (let i = 0; i < 24; i++) {
      list.push({
        x: -14 + rng() * 8,
        z: -18 + rng() * 36,
        s: 0.7 + rng() * 0.6,
      });
      list.push({
        x: ISLANDS.selected.origin.x + 12 + rng() * 6,
        z: -16 + rng() * 32,
        s: 0.7 + rng() * 0.6,
      });
    }
    return list;
  }, []);

  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.12, 0.8, 6]} />
            <meshStandardMaterial color="#5c4033" />
          </mesh>
          <mesh position={[0, 1.1, 0]} castShadow>
            <coneGeometry args={[0.55, 1.1, 7]} />
            <meshStandardMaterial color="#166534" />
          </mesh>
          <mesh position={[0, 1.55, 0]} castShadow>
            <coneGeometry args={[0.4, 0.8, 7]} />
            <meshStandardMaterial color="#15803d" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function IslandPlate({ island, label }) {
  const { x, z } = island.origin;
  const r = island.radius;
  const roadTex = useMemo(() => createRoadTexture(), []);
  const grassTex = useMemo(() => createGrassTexture(island.groundColor), [island.groundColor]);

  return (
    <group position={[x, 0, z]}>
      {/* Base da ilha (placa elevada) */}
      <mesh position={[0, -0.15, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[r + 1.5, r + 2.2, 0.5, 48]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>

      {/* Chão gramado / asfalto */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} receiveShadow>
        <circleGeometry args={[r, 64]} />
        <meshStandardMaterial map={grassTex} roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Anel da orla */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.13, 0]}>
        <ringGeometry args={[r - 0.15, r + 0.15, 64]} />
        <meshBasicMaterial
          color={island.accent}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Ruas em grade */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0]} receiveShadow>
        <planeGeometry args={[r * 1.4, 1.4]} />
        <meshStandardMaterial map={roadTex} roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.14, 0]} receiveShadow>
        <planeGeometry args={[r * 1.4, 1.4]} />
        <meshStandardMaterial map={roadTex} roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Postes de luz */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const px = Math.cos(a) * (r - 2);
        const pz = Math.sin(a) * (r - 2);
        return (
          <group key={i} position={[px, 0.12, pz]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.05, 0.07, 2.2, 6]} />
              <meshStandardMaterial color="#334155" metalness={0.5} />
            </mesh>
            <mesh position={[0, 1.2, 0]}>
              <sphereGeometry args={[0.12, 10, 10]} />
              <meshStandardMaterial
                color="#fef08a"
                emissive="#fde047"
                emissiveIntensity={0.9}
              />
            </mesh>
            <pointLight
              position={[0, 1.15, 0]}
              color="#fde68a"
              intensity={0.35}
              distance={8}
            />
          </group>
        );
      })}

      {/* Placa da ilha */}
      <group position={[0, 0.2, -r + 1.5]}>
        <mesh castShadow>
          <boxGeometry args={[4.2, 1.1, 0.15]} />
          <meshStandardMaterial color="#0f172a" metalness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.09]}>
          <boxGeometry args={[3.9, 0.85, 0.02]} />
          <meshStandardMaterial
            color={island.accent}
            emissive={island.accent}
            emissiveIntensity={0.25}
          />
        </mesh>
      </group>
    </group>
  );
}

function CityBuildings({ items, selectedId, hoveredId, onHover, onSelect, idPrefix }) {
  return (
    <group>
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

/* ------------------------------------------------------------------ */
/*  Texturas                                                            */
/* ------------------------------------------------------------------ */

function createGrassTexture(hex) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = hex || '#1a2740';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  // grade suave
  ctx.strokeStyle = 'rgba(56,189,248,0.06)';
  for (let i = 0; i < size; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRoadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 128, 64);
  ctx.strokeStyle = '#fbbf24';
  ctx.setLineDash([10, 10]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 32);
  ctx.lineTo(128, 32);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
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
