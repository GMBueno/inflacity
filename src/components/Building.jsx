import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { floorsToHeight, formatPct } from '../data/inflationMath.js';
import BuildingTheme from './BuildingTheme.jsx';

const FLOOR_UNIT = 0.8; // altura por andar (dobrada vs. escala original)
const BUILDING_WIDTH = 2.0;
const BUILDING_DEPTH = 1.85;

/**
 * Prédio de um grupo do IPCA.
 * Altura animada proporcional aos andares (10 * índice).
 */
export default function Building({
  group,
  stats,
  position,
  selected,
  hovered,
  onHover,
  onSelect,
  appearDelay = 0,
}) {
  const groupRef = useRef();
  const bodyRef = useRef();
  const targetHeight = floorsToHeight(stats?.floors ?? 10);
  const currentHeight = useRef(0.1);
  const [ready, setReady] = useState(false);
  const elapsed = useRef(0);

  const theme = group.theme || 'default';
  const isRice = theme === 'rice';

  // Janelas: grid procedural (arroz usa textura de grãos)
  const windowTexture = useMemo(
    () => (isRice ? createRiceTexture() : createWindowTexture(group.color)),
    [group.color, isRice]
  );

  const bodyMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: isRice
        ? new THREE.Color('#f5f5f4')
        : new THREE.Color(group.color).multiplyScalar(0.55),
      emissive: new THREE.Color(group.emissive || group.color),
      emissiveIntensity: theme === 'energy' ? 0.35 : 0.15,
      metalness: theme === 'energy' ? 0.65 : 0.35,
      roughness: isRice ? 0.85 : 0.45,
      map: windowTexture,
    });
  }, [group.color, group.emissive, windowTexture, theme, isRice]);

  const accentMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: group.color,
        emissive: group.color,
        emissiveIntensity: 0.4,
        metalness: 0.5,
        roughness: 0.3,
      }),
    [group.color]
  );

  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current < appearDelay) return;
    if (!ready) setReady(true);

    // Suaviza altura (ease-out)
    const t = 1 - Math.exp(-delta * 4.5);
    currentHeight.current += (targetHeight - currentHeight.current) * t;

    const h = Math.max(currentHeight.current, 0.15);
    if (bodyRef.current) {
      bodyRef.current.scale.y = h / FLOOR_UNIT; // base unit = 1 floor visual block
      bodyRef.current.position.y = h / 2 + 0.12;
    }

    // Leve flutuação no hover
    if (groupRef.current) {
      const lift = hovered || selected ? 0.12 : 0;
      groupRef.current.position.y +=
        (lift - groupRef.current.position.y) * Math.min(1, delta * 8);
    }

    // Intensidade emissiva no hover/seleção
    if (bodyMaterial) {
      const targetEmissive = hovered || selected ? 0.45 : 0.15;
      bodyMaterial.emissiveIntensity +=
        (targetEmissive - bodyMaterial.emissiveIntensity) * t;
    }
  });

  const displayFloors = stats?.floors ?? 10;
  const inflationLabel = formatPct(stats?.inflationPct ?? 0);

  // Linhas de andares (apenas as visíveis, max ~40 para performance)
  const floorLines = useMemo(() => {
    const count = Math.min(Math.ceil(displayFloors), 45);
    const lines = [];
    for (let i = 1; i < count; i++) {
      lines.push(i);
    }
    return lines;
  }, [displayFloors]);

  const h = Math.max(currentHeight.current, targetHeight * 0.01);

  return (
    <group
      ref={groupRef}
      position={[position.x, 0, position.z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        onHover?.(group.id);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'auto';
        onHover?.(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(group.id);
      }}
    >
      {/* Plaza / base */}
      <mesh position={[0, 0.04, 0]} receiveShadow castShadow>
        <boxGeometry args={[BUILDING_WIDTH + 0.7, 0.08, BUILDING_DEPTH + 0.7]} />
        <meshStandardMaterial
          color="#1a2332"
          metalness={0.4}
          roughness={0.6}
        />
      </mesh>
      <mesh position={[0, 0.09, 0]} receiveShadow>
        <boxGeometry args={[BUILDING_WIDTH + 0.35, 0.04, BUILDING_DEPTH + 0.35]} />
        <meshStandardMaterial
          color={group.color}
          emissive={group.color}
          emissiveIntensity={0.25}
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>

      {/* Corpo principal */}
      <mesh
        ref={bodyRef}
        position={[0, h / 2 + 0.12, 0]}
        castShadow
        receiveShadow
        material={bodyMaterial}
        scale={[1, Math.max(h / FLOOR_UNIT, 0.2), 1]}
      >
        {/* Unidade base: 1 × FLOOR_UNIT × 1 → scale.y multiplica a altura */}
        <boxGeometry args={[BUILDING_WIDTH, FLOOR_UNIT, BUILDING_DEPTH]} />
      </mesh>

      {/* Faixas de andares (linhas horizontais) */}
      <FloorBands
        floors={floorLines}
        width={BUILDING_WIDTH}
        depth={BUILDING_DEPTH}
        color={group.color}
        animatedHeightRef={currentHeight}
        baseY={0.12}
      />

      {/* Topo / coroa */}
      <Roof
        heightRef={currentHeight}
        baseY={0.12}
        color={group.color}
        accentMaterial={accentMaterial}
        width={BUILDING_WIDTH}
        depth={BUILDING_DEPTH}
      />

      {/* Detalhe temático (energia, arroz, posto…) */}
      <BuildingTheme
        theme={theme}
        color={group.color}
        heightRef={currentHeight}
        baseY={0.12}
      />

      {/* Base temática: posto de gasolina */}
      {(theme === 'gas' || theme === 'ethanol' || theme === 'diesel') && (
        <mesh position={[0, 0.14, 1.15]} castShadow>
          <boxGeometry args={[2.6, 0.12, 0.9]} />
          <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.6} />
        </mesh>
      )}

      {/* Glow no chão quando selecionado */}
      {(selected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[1.6, 2.1, 48]} />
          <meshBasicMaterial
            color={group.color}
            transparent
            opacity={selected ? 0.55 : 0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Label HTML sobre o prédio */}
      <Html
        position={[0, targetHeight + 1.35, 0]}
        center
        distanceFactor={14}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        zIndexRange={[20, 0]}
      >
        <div className={`building-label ${selected ? 'selected' : ''} ${hovered ? 'hovered' : ''}`}>
          <div className="building-label__name">{group.shortName}</div>
          <div className="building-label__pct" style={{ color: group.color }}>
            {inflationLabel}
          </div>
          <div className="building-label__floors">
            {displayFloors.toLocaleString('pt-BR', {
              maximumFractionDigits: 1,
            })}{' '}
            andares
          </div>
        </div>
      </Html>
    </group>
  );
}

function FloorBands({ floors, width, depth, color, animatedHeightRef, baseY }) {
  const groupRef = useRef();

  useFrame(() => {
    if (!groupRef.current) return;
    const h = animatedHeightRef.current;
    groupRef.current.children.forEach((child, i) => {
      const floorIndex = floors[i];
      const y = baseY + floorIndex * FLOOR_UNIT;
      child.visible = y < h + baseY - 0.05;
      child.position.y = y;
    });
  });

  return (
    <group ref={groupRef}>
      {floors.map((f) => (
        <mesh key={f} position={[0, baseY + f * FLOOR_UNIT, 0]}>
          <boxGeometry args={[width + 0.02, 0.03, depth + 0.02]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.35}
            metalness={0.6}
            roughness={0.3}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}

function Roof({ heightRef, baseY, color, accentMaterial, width, depth }) {
  const ref = useRef();

  useFrame(() => {
    if (!ref.current) return;
    const h = heightRef.current;
    ref.current.position.y = baseY + h + 0.08;
  });

  return (
    <group ref={ref}>
      {/* Platô do topo */}
      <mesh castShadow material={accentMaterial}>
        <boxGeometry args={[width * 0.92, 0.14, depth * 0.92]} />
      </mesh>
      {/* Caixa técnica */}
      <mesh position={[0.3, 0.22, 0.2]} castShadow>
        <boxGeometry args={[0.55, 0.3, 0.45]} />
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Antena */}
      <mesh position={[-0.35, 0.45, -0.15]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.7, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[-0.35, 0.82, -0.15]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
        />
      </mesh>
      {/* Detalhe de beiral */}
      <RoundedBox
        args={[width * 1.05, 0.08, depth * 1.05]}
        radius={0.02}
        position={[0, -0.02, 0]}
      >
        <meshStandardMaterial
          color="#0b1220"
          metalness={0.4}
          roughness={0.5}
        />
      </RoundedBox>
    </group>
  );
}

function createRiceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5f5f4';
  ctx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.5 ? '#e7e5e4' : '#d6d3d1';
    ctx.beginPath();
    ctx.ellipse(x, y, 2.2, 1.1, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Textura procedural de janelas iluminadas (noite).
 */
function createWindowTexture(accentHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Fachada escura
  ctx.fillStyle = '#0c1220';
  ctx.fillRect(0, 0, 128, 256);

  const accent = new THREE.Color(accentHex);
  const cols = 4;
  const rows = 16;
  const padX = 10;
  const padY = 8;
  const gapX = 6;
  const gapY = 5;
  const winW = (128 - padX * 2 - gapX * (cols - 1)) / cols;
  const winH = (256 - padY * 2 - gapY * (rows - 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = Math.random() > 0.28;
      if (lit) {
        const brightness = 0.55 + Math.random() * 0.45;
        const rC = Math.floor(accent.r * 40 + 180 * brightness);
        const gC = Math.floor(accent.g * 40 + 200 * brightness);
        const bC = Math.floor(accent.b * 40 + 160 * brightness);
        ctx.fillStyle = `rgb(${rC},${gC},${bC})`;
      } else {
        ctx.fillStyle = '#152033';
      }
      const x = padX + c * (winW + gapX);
      const y = padY + r * (winH + gapY);
      ctx.fillRect(x, y, winW, winH);

      // brilho sutil
      if (lit) {
        ctx.fillStyle = 'rgba(255,255,220,0.15)';
        ctx.fillRect(x, y, winW, winH * 0.35);
      }
    }
  }

  // Linha de destaque superior
  ctx.fillStyle = accentHex;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, 0, 128, 4);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
