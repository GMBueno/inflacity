import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Detalhes temáticos no topo/base do prédio conforme o produto/grupo.
 */
export default function BuildingTheme({ theme, color, heightRef, baseY = 0.12 }) {
  const ref = useRef();

  useFrame(() => {
    if (!ref.current || !heightRef) return;
    ref.current.position.y = baseY + heightRef.current + 0.35;
  });

  const c = color || '#38bdf8';

  return (
    <group ref={ref}>
      <ThemeMeshes theme={theme} color={c} />
    </group>
  );
}

function ThemeMeshes({ theme, color }) {
  switch (theme) {
    case 'energy':
      return <EnergyTheme color={color} />;
    case 'rice':
      return <RiceTheme />;
    case 'gas':
    case 'ethanol':
    case 'diesel':
      return <GasStationTheme color={color} fuel={theme} />;
    case 'gas_bottle':
      return <GasBottleTheme color={color} />;
    case 'plane':
      return <PlaneTheme color={color} />;
    case 'bus':
      return <BusTheme color={color} />;
    case 'coffee':
      return <CoffeeTheme color={color} />;
    case 'beer':
    case 'wine':
      return <BottleTheme color={color} />;
    case 'milk':
      return <MilkTheme />;
    case 'bread':
      return <BreadTheme />;
    case 'tomato':
      return <TomatoTheme />;
    case 'meat':
      return <MeatTheme />;
    case 'egg':
      return <EggTheme />;
    case 'health':
      return <HealthTheme color={color} />;
    case 'education':
      return <EducationTheme color={color} />;
    case 'computer':
      return <ComputerTheme />;
    case 'water':
      return <WaterDropTheme color={color} />;
    case 'oil':
      return <OilTheme color={color} />;
    case 'beans':
      return <BeansTheme />;
    case 'potato':
      return <PotatoTheme />;
    case 'pasta':
      return <PastaTheme />;
    case 'cigarette':
      return <CigaretteTheme />;
    case 'restaurant':
      return <RestaurantTheme color={color} />;
    case 'house':
    case 'rent':
    case 'condo':
      return <HouseTheme color={color} />;
    case 'soap':
      return <SoapTheme color={color} />;
    case 'domestic':
      return <DomesticTheme color={color} />;
    case 'pantry':
      return <PantryTheme color={color} />;
    default:
      return <DefaultAntenna color={color} />;
  }
}

function EnergyTheme({ color }) {
  const bolt = useRef();
  useFrame(({ clock }) => {
    if (bolt.current) {
      bolt.current.material.emissiveIntensity = 0.8 + Math.sin(clock.elapsedTime * 8) * 0.5;
    }
  });
  return (
    <group>
      {/* Raio estilizado (cones empilhados) */}
      <mesh ref={bolt} position={[0, 0.55, 0]} rotation={[0, 0, 0.15]} castShadow>
        <coneGeometry args={[0.18, 0.55, 4]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0.08, 0.15, 0]} rotation={[0, 0, -0.35]}>
        <coneGeometry args={[0.14, 0.4, 4]} />
        <meshStandardMaterial color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={1.4} />
      </mesh>
      <pointLight color={color} intensity={1.2} distance={6} position={[0, 0.4, 0]} />
    </group>
  );
}

function RiceTheme() {
  return (
    <group>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          position={[(i - 2) * 0.18, 0.12 + (i % 2) * 0.05, Math.sin(i) * 0.1]}
          castShadow
        >
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color="#fafaf9" roughness={0.9} metalness={0.05} />
        </mesh>
      ))}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.45, 0.5, 0.08, 12]} />
        <meshStandardMaterial color="#e7e5e4" roughness={0.85} />
      </mesh>
    </group>
  );
}

function GasStationTheme({ color, fuel }) {
  const canopyColor = fuel === 'ethanol' ? '#84cc16' : fuel === 'diesel' ? '#57534e' : color;
  return (
    <group>
      {/* Toldo do posto */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.6, 0.1, 1.1]} />
        <meshStandardMaterial color={canopyColor} emissive={canopyColor} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[-0.55, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.5, 8]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} />
      </mesh>
      <mesh position={[0.55, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.5, 8]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} />
      </mesh>
      {/* Bomba */}
      <mesh position={[0, 0.2, 0.35]} castShadow>
        <boxGeometry args={[0.35, 0.4, 0.25]} />
        <meshStandardMaterial color="#0f172a" metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.42, 0.35]}>
        <boxGeometry args={[0.2, 0.08, 0.12]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

function GasBottleTheme({ color }) {
  return (
    <group>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.25, 0.7, 12]} />
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.15, 8]} />
        <meshStandardMaterial color="#334155" metalness={0.7} />
      </mesh>
    </group>
  );
}

function PlaneTheme({ color }) {
  return (
    <group rotation={[0, 0.4, 0]}>
      <mesh castShadow>
        <boxGeometry args={[1.1, 0.12, 0.28]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.15, 0.05, 0.9]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.5} />
      </mesh>
      <mesh position={[-0.45, 0.12, 0]}>
        <boxGeometry args={[0.12, 0.25, 0.08]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function BusTheme({ color }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.9, 0.4, 0.4]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0.15, 0.32, 0.21]}>
        <boxGeometry args={[0.45, 0.12, 0.02]} />
        <meshStandardMaterial color="#0ea5e9" emissive="#38bdf8" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function CoffeeTheme({ color }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.18, 0.35, 16]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[0.28, 0.22, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.1, 0.03, 8, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function BottleTheme({ color }) {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.45, 12]} />
        <meshStandardMaterial color={color} transparent opacity={0.85} metalness={0.2} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 0.18, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function MilkTheme() {
  return (
    <mesh position={[0, 0.3, 0]} castShadow>
      <boxGeometry args={[0.28, 0.55, 0.2]} />
      <meshStandardMaterial color="#f0f9ff" roughness={0.7} />
    </mesh>
  );
}

function BreadTheme() {
  return (
    <mesh position={[0, 0.15, 0]} rotation={[0, 0.3, 0.1]} castShadow>
      <capsuleGeometry args={[0.18, 0.35, 4, 8]} />
      <meshStandardMaterial color="#fbbf24" roughness={0.9} />
    </mesh>
  );
}

function TomatoTheme() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#ef4444" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <coneGeometry args={[0.08, 0.12, 5]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>
    </group>
  );
}

function MeatTheme() {
  return (
    <mesh position={[0, 0.15, 0]} rotation={[0.3, 0.2, 0]} castShadow>
      <boxGeometry args={[0.55, 0.18, 0.35]} />
      <meshStandardMaterial color="#f87171" roughness={0.7} />
    </mesh>
  );
}

function EggTheme() {
  return (
    <mesh position={[0, 0.25, 0]} scale={[1, 1.25, 1]} castShadow>
      <sphereGeometry args={[0.22, 12, 12]} />
      <meshStandardMaterial color="#fef3c7" roughness={0.8} />
    </mesh>
  );
}

function HealthTheme({ color }) {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.55, 0.18, 0.18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      <mesh castShadow>
        <boxGeometry args={[0.18, 0.55, 0.18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function EducationTheme({ color }) {
  return (
    <group rotation={[0, 0.4, 0]}>
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[0.7, 0.12, 0.5]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.28, 0]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[0.55, 0.08, 0.4]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
    </group>
  );
}

function ComputerTheme() {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.7, 0.45, 0.08]} />
        <meshStandardMaterial color="#27272a" metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.25, 0.02]}>
        <boxGeometry args={[0.58, 0.35, 0.02]} />
        <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.0, 0.1]}>
        <boxGeometry args={[0.5, 0.06, 0.3]} />
        <meshStandardMaterial color="#3f3f46" />
      </mesh>
    </group>
  );
}

function WaterDropTheme({ color }) {
  return (
    <mesh position={[0, 0.3, 0]} scale={[1, 1.4, 1]} castShadow>
      <sphereGeometry args={[0.22, 12, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.4}
        transparent
        opacity={0.85}
        metalness={0.3}
        roughness={0.15}
      />
    </mesh>
  );
}

function OilTheme({ color }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.16, 0.4, 12]} />
        <meshStandardMaterial color={color} metalness={0.2} roughness={0.4} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.15, 8]} />
        <meshStandardMaterial color="#365314" />
      </mesh>
    </group>
  );
}

function BeansTheme() {
  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[(i % 2) * 0.2 - 0.1, 0.12 + Math.floor(i / 2) * 0.15, (i % 3) * 0.1 - 0.1]}
          castShadow
        >
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color="#292524" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function PotatoTheme() {
  return (
    <mesh position={[0, 0.18, 0]} scale={[1.2, 0.85, 1]} castShadow>
      <sphereGeometry args={[0.28, 12, 12]} />
      <meshStandardMaterial color="#d6b37a" roughness={0.95} />
    </mesh>
  );
}

function PastaTheme() {
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[(i - 1) * 0.15, 0.2, 0]} castShadow>
          <torusGeometry args={[0.12, 0.04, 6, 16]} />
          <meshStandardMaterial color="#fde68a" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function CigaretteTheme() {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.7, 8]} />
        <meshStandardMaterial color="#f5f5f4" />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.065, 0.065, 0.15, 8]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
    </group>
  );
}

function RestaurantTheme({ color }) {
  return (
    <group>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.55, 8]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function HouseTheme({ color }) {
  return (
    <group>
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[0.55, 0.3, 0.45]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.4, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.42, 0.28, 4]} />
        <meshStandardMaterial color="#7f1d1d" />
      </mesh>
    </group>
  );
}

function SoapTheme({ color }) {
  return (
    <mesh position={[0, 0.15, 0]} castShadow>
      <boxGeometry args={[0.45, 0.22, 0.28]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
    </mesh>
  );
}

function DomesticTheme({ color }) {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} castShadow>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.25, 0.3, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function PantryTheme({ color }) {
  return (
    <mesh position={[0, 0.25, 0]} castShadow>
      <boxGeometry args={[0.5, 0.5, 0.35]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

function DefaultAntenna({ color }) {
  return (
    <group>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.7, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
      </mesh>
    </group>
  );
}
