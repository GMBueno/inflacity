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
import {
  calculateAccumulatedIndex,
  calculateTwelveMonthInflation,
} from '../data/inflationMath.js';

const DEFAULT_CAM = [14, 12, 16];
const DEFAULT_TARGET = [0, 3, 0];
const WALK_SPEED = 14; // unidades/s no plano XZ
const MAX_DISTANCE = 84; // ~2× o zoom out anterior (42)

/**
 * Canvas 3D da Cidade da Inflação.
 */
export default function CityScene({
  groupsData,
  endDate,
  mode, // 'accumulated' | 'twelveMonths'
  selectedId,
  hoveredId,
  onHover,
  onSelect,
  cameraResetKey,
}) {
  return (
    <div className="city-canvas">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        onPointerMissed={() => onSelect?.(null)}
      >
        <color attach="background" args={['#070b14']} />
        <fog attach="fog" args={['#070b14', 40, 120]} />

        <PerspectiveCamera makeDefault position={DEFAULT_CAM} fov={42} />
        <CameraController resetKey={cameraResetKey} />
        <WalkControls speed={WALK_SPEED} />

        <ambientLight intensity={0.32} color="#8ba3c7" />
        <hemisphereLight
          args={['#9ec9ff', '#0a1220', 0.45]}
        />
        <directionalLight
          castShadow
          position={[12, 22, 10]}
          intensity={1.45}
          color="#fff4e6"
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={60}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
          shadow-bias={-0.0002}
        />
        <directionalLight
          position={[-10, 8, -8]}
          intensity={0.4}
          color="#6ea8ff"
        />
        <pointLight position={[0, 6, 0]} intensity={0.45} color="#7dd3fc" distance={30} />

        <Suspense fallback={null}>
          <CityGround />
          <CityBuildings
            groupsData={groupsData}
            endDate={endDate}
            mode={mode}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onHover={onHover}
            onSelect={onSelect}
          />
          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={0.55}
            scale={40}
            blur={2.5}
            far={12}
            color="#000"
          />
          <Stars
            radius={120}
            depth={50}
            count={1400}
            factor={3}
            saturation={0}
            fade
            speed={0.3}
          />
        </Suspense>

        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 2.15}
          minDistance={6}
          maxDistance={MAX_DISTANCE}
          target={DEFAULT_TARGET}
          enableDamping
          dampingFactor={0.06}
        />
      </Canvas>
    </div>
  );
}

function CameraController({ resetKey }) {
  const { camera, controls } = useThree();
  const lastKey = useRef(resetKey);

  useFrame(() => {
    if (resetKey !== lastKey.current) {
      lastKey.current = resetKey;
      camera.position.set(...DEFAULT_CAM);
      if (controls) {
        controls.target.set(...DEFAULT_TARGET);
        controls.update();
      }
    }
  });

  return null;
}

/**
 * WASD: move câmera + alvo do orbit no plano XZ, relativo à direção da vista.
 * (W/S frente/trás, A/D esquerda/direita — como “andar” na cidade.)
 */
function WalkControls({ speed = 14 }) {
  const { camera, controls } = useThree();
  const keys = useRef({ w: false, a: false, s: false, d: false });

  useEffect(() => {
    const isTypingTarget = (el) => {
      if (!el || !(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable
      );
    };

    const setKey = (code, pressed) => {
      switch (code) {
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
        default:
          break;
      }
    };

    const onDown = (e) => {
      if (isTypingTarget(e.target)) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      setKey(e.code, true);
    };
    const onUp = (e) => setKey(e.code, false);
    const onBlur = () => {
      keys.current = { w: false, a: false, s: false, d: false };
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
    if (!k.w && !k.a && !k.s && !k.d) return;

    // Direção no plano horizontal a partir da câmera
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) {
      // Olhando quase vertical: usa -Z mundial
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }

    const right = new THREE.Vector3()
      .crossVectors(forward, new THREE.Vector3(0, 1, 0))
      .normalize();

    const move = new THREE.Vector3();
    if (k.w) move.add(forward);
    if (k.s) move.sub(forward);
    if (k.d) move.add(right);
    if (k.a) move.sub(right);

    if (move.lengthSq() < 1e-8) return;
    move.normalize().multiplyScalar(speed * Math.min(delta, 0.05));

    camera.position.add(move);
    if (controls?.target) {
      controls.target.add(move);
      controls.update();
    }
  });

  return null;
}

function CityGround() {
  const gridTexture = useMemo(() => createGridTexture(), []);

  return (
    <group>
      {/* Chão principal */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial
          color="#0d1524"
          metalness={0.2}
          roughness={0.85}
          map={gridTexture}
        />
      </mesh>

      {/* Plataforma central da cidade */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
        <circleGeometry args={[14, 64]} />
        <meshStandardMaterial
          color="#111b2e"
          metalness={0.35}
          roughness={0.7}
          transparent
          opacity={0.95}
        />
      </mesh>

      {/* Anel luminoso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[13.6, 14.1, 64]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>

      {/* Avenidas em cruz */}
      <Road x={0} z={0} length={28} width={1.1} rotation={0} />
      <Road x={0} z={0} length={28} width={1.1} rotation={Math.PI / 2} />

      {/* Prédios de fundo (decorativos, baixos) */}
      <BackgroundSkyline />
    </group>
  );
}

function Road({ x, z, length, width, rotation }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, rotation]}
      position={[x, 0.02, z]}
      receiveShadow
    >
      <planeGeometry args={[length, width]} />
      <meshStandardMaterial
        color="#151f33"
        metalness={0.3}
        roughness={0.6}
        emissive="#1e3a5f"
        emissiveIntensity={0.15}
      />
    </mesh>
  );
}

function BackgroundSkyline() {
  const buildings = useMemo(() => {
    const list = [];
    const rng = mulberry32(42);
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
      const radius = 18 + rng() * 8;
      list.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        h: 1.5 + rng() * 4,
        w: 0.8 + rng() * 1.2,
        d: 0.8 + rng() * 1.2,
      });
    }
    return list;
  }, []);

  return (
    <group>
      {buildings.map((b, i) => (
        <mesh
          key={i}
          position={[b.x, b.h / 2, b.z]}
          castShadow
        >
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial
            color="#0a1220"
            emissive="#1a2744"
            emissiveIntensity={0.2}
            metalness={0.4}
            roughness={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

function CityBuildings({
  groupsData,
  endDate,
  mode,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
}) {
  const positions = useMemo(() => getBuildingPositions(), []);

  const buildings = useMemo(() => {
    return IPCA_GROUPS.map((meta, i) => {
      const data = groupsData?.[meta.id];
      const series = data?.series || [];
      const stats =
        mode === 'twelveMonths'
          ? calculateTwelveMonthInflation(series, endDate)
          : calculateAccumulatedIndex(series, endDate);

      // Peso mais recente até endDate
      let latestWeight = null;
      for (let j = series.length - 1; j >= 0; j--) {
        if (endDate && series[j].dateKey > endDate) continue;
        if (series[j].weight != null) {
          latestWeight = series[j].weight;
          break;
        }
      }

      return {
        group: {
          ...meta,
          ...(data || {}),
        },
        stats: { ...stats, latestWeight },
        position: positions[i],
        appearDelay: i * 0.08,
      };
    });
  }, [groupsData, endDate, mode, positions]);

  return (
    <group>
      {buildings.map((b) => (
        <Building
          key={b.group.id}
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

function createGridTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0d1524';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1;
  const step = 32;
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // linhas mais fortes a cada 4
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
  for (let i = 0; i <= size; i += step * 4) {
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
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
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
