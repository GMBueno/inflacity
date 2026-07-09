import { Suspense, useMemo, useRef } from 'react';
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
        <fog attach="fog" args={['#070b14', 28, 70]} />

        <PerspectiveCamera makeDefault position={[14, 12, 16]} fov={42} />
        <CameraController resetKey={cameraResetKey} />

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
            radius={80}
            depth={40}
            count={1200}
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
          minPolarAngle={0.25}
          maxPolarAngle={Math.PI / 2.15}
          minDistance={8}
          maxDistance={42}
          target={[0, 3, 0]}
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
      camera.position.set(14, 12, 16);
      if (controls) {
        controls.target.set(0, 3, 0);
        controls.update();
      }
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
