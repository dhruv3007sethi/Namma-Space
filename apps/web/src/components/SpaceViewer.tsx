import type { PointOfInterest, Vec3 } from '@namma/shared';
import { Grid, Html, OrbitControls } from '@react-three/drei';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { useState } from 'react';

export interface SpaceViewerProps {
  pois: PointOfInterest[];
  selectedPoiId?: string | null;
  /** When set, clicking the floor reports the picked point (metres, Y-up). */
  onPickFloor?: (position: Vec3) => void;
  pickMode?: boolean;
  draftPosition?: Vec3 | null;
  onSelectPoi?: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  door: '#f59e0b',
  window: '#38bdf8',
  exit: '#ef4444',
  furniture: '#a78bfa',
  stairs: '#f472b6',
  elevator: '#22d3ee',
  restroom: '#34d399',
  appliance: '#fb923c',
  landmark: '#facc15',
  other: '#94a3b8',
};

const round = (n: number) => Math.round(n * 100) / 100;

function Marker({
  poi,
  selected,
  onSelect,
}: {
  poi: PointOfInterest;
  selected: boolean;
  onSelect?: (id: string) => void;
}) {
  const color = CATEGORY_COLORS[poi.category] ?? '#94a3b8';
  return (
    <group position={[poi.position.x, poi.position.y, poi.position.z]}>
      <mesh
        position={[0, 0.25, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(poi.id);
        }}
      >
        <sphereGeometry args={[selected ? 0.22 : 0.15, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 0.6 : 0.2}
        />
      </mesh>
      <mesh position={[0, 0.125, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.25, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Html position={[0, 0.6, 0]} center distanceFactor={10} zIndexRange={[10, 0]}>
        <div className={`poi-label${selected ? ' poi-label-selected' : ''}`}>{poi.name}</div>
      </Html>
    </group>
  );
}

/**
 * Interactive 3D view of a space in its local metric frame. Until a real
 * reconstruction exists, it shows a measured floor grid with POI markers;
 * reconstructed meshes/splats will be loaded into this same scene.
 */
export default function SpaceViewer({
  pois,
  selectedPoiId,
  onPickFloor,
  pickMode = false,
  draftPosition,
  onSelectPoi,
}: SpaceViewerProps) {
  const [hover, setHover] = useState<Vec3 | null>(null);

  const toVec = (e: ThreeEvent<PointerEvent | MouseEvent>): Vec3 => ({
    x: round(e.point.x),
    y: 0,
    z: round(e.point.z),
  });

  return (
    <div className={`viewer${pickMode ? ' viewer-picking' : ''}`}>
      <Canvas camera={{ position: [8, 7, 8], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={['#0b1220']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1.1} />
        <Grid
          args={[40, 40]}
          cellSize={0.5}
          cellThickness={0.6}
          sectionSize={1}
          sectionThickness={1.1}
          cellColor="#1e3a5f"
          sectionColor="#2f6f8f"
          fadeDistance={45}
          infiniteGrid
        />
        <axesHelper args={[1]} />
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerMove={(e) => pickMode && setHover(toVec(e))}
          onPointerOut={() => setHover(null)}
          onClick={(e) => {
            if (!pickMode || !onPickFloor) return;
            e.stopPropagation();
            onPickFloor(toVec(e));
          }}
        >
          <planeGeometry args={[200, 200]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {pois.map((p) => (
          <Marker key={p.id} poi={p} selected={p.id === selectedPoiId} onSelect={onSelectPoi} />
        ))}
        {draftPosition && (
          <mesh position={[draftPosition.x, 0.25, draftPosition.z]}>
            <sphereGeometry args={[0.18, 24, 24]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.8} />
          </mesh>
        )}
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
      <div className="viewer-overlay">
        <span>No 3D reconstruction yet · floor grid is 1 m</span>
        {pickMode && (
          <span>
            Click the floor to place the point
            {hover && ` (x ${hover.x}, z ${hover.z})`}
          </span>
        )}
      </div>
    </div>
  );
}
