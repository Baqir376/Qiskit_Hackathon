"use client";
import { Environment, Html, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

export type SkylineProps = {
  probs: number[];          // probability of each feasible plan (24), indexed like data.plans
  rank: number[];           // feasible indices sorted best -> worst for current lambda
  optimal: Set<number>;     // feasible indices of the exact optimum
  invalid: number;          // probability mass on invalid plans
  labels: string[];         // short plan label per feasible index
  color: string;            // variant colour
  done: boolean;
};

const COLS = 6, GAP = 0.78, HMAX = 2.3;

function Column({ j, rankPos, prob, maxP, isOpt, color, label, done }: { j: number; rankPos: number; prob: number; maxP: number; isOpt: boolean; color: string; label: string; done: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshPhysicalMaterial>(null);
  const [hover, setHover] = useState(false);
  const row = Math.floor(rankPos / COLS), col = rankPos % COLS;
  const x = (col - (COLS - 1) / 2) * GAP, z = (row - 1.5) * GAP;
  const target = Math.max(0.03, (prob / maxP) * HMAX);
  const base = useMemo(() => new THREE.Color(isOpt ? color : "#7B7567"), [isOpt, color]);
  useFrame((_, dt) => {
    const m = mesh.current!;
    const h = THREE.MathUtils.damp(m.scale.y, target, 6, dt);
    m.scale.y = h;
    m.position.y = h / 2;
    mat.current!.emissiveIntensity = THREE.MathUtils.damp(mat.current!.emissiveIntensity, isOpt ? (done ? 2.2 : 0.9) : hover ? 0.6 : 0.05, 6, dt);
  });
  return (
    <group position={[x, 0, z]}>
      <mesh ref={mesh} scale={[1, 0.03, 1]} onPointerOver={(e) => { e.stopPropagation(); setHover(true); }} onPointerOut={() => setHover(false)}>
        <boxGeometry args={[0.5, 1, 0.5]} />
        <meshPhysicalMaterial ref={mat} color={base} emissive={base} emissiveIntensity={0.1} roughness={0.15} metalness={0.1}
          transmission={isOpt ? 0 : 0.35} thickness={0.5} clearcoat={1} toneMapped={!isOpt} />
      </mesh>
      {(hover || (isOpt && done)) && (
        <Html position={[0, target + 0.45, 0]} center distanceFactor={7} zIndexRange={[20, 0]}>
          <div className={`whitespace-nowrap rounded-lg border px-2 py-1 font-mono text-[11px] ${isOpt ? "border-win/50 bg-[#1F2A14] text-win" : "border-white/15 bg-[#141936] text-white/80"}`}>
            {isOpt ? "👑 " : `#${rankPos + 1} `}{label} · {(prob * 100).toFixed(1)}%
          </div>
        </Html>
      )}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.62, 0.62]} />
        <meshBasicMaterial color={isOpt ? color : "#2A2F55"} transparent opacity={0.5} />
      </mesh>
      {void j}
    </group>
  );
}

function InvalidPool({ invalid }: { invalid: number }) {
  const m = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const h = THREE.MathUtils.damp(m.current!.scale.y, Math.max(0.02, invalid * HMAX), 6, dt);
    m.current!.scale.y = h; m.current!.position.y = h / 2;
  });
  return (
    <group position={[-(COLS / 2) * GAP - 1.1, 0, 0]}>
      <mesh ref={m} scale={[1, 0.02, 1]}>
        <cylinderGeometry args={[0.38, 0.38, 1, 48]} />
        <meshPhysicalMaterial color="#E0533D" emissive="#E0533D" emissiveIntensity={0.5} transparent opacity={0.65} roughness={0.2} toneMapped={false} />
      </mesh>
      <Html position={[0, -0.35, 0.7]} center distanceFactor={7}>
        <div className="whitespace-nowrap font-mono text-[11px] text-[#E0533D]">invalid {(invalid * 100).toFixed(0)}%</div>
      </Html>
    </group>
  );
}

export default function Skyline3D(p: SkylineProps) {
  const maxP = Math.max(0.1, ...p.probs);
  const pos = new Map(p.rank.map((j, r) => [j, r]));
  return (
    <Canvas camera={{ position: [5.6, 5.2, 7.6], fov: 36 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 4]} intensity={1.4} />
      <pointLight position={[-4, 3, -3]} intensity={12} color="#6F7DF0" />
      <group position={[0.55, -0.55, 0]}>
        <RoundedBox args={[COLS * GAP + 3.0, 0.08, 4 * GAP + 0.6]} radius={0.04} position={[-0.6, -0.05, 0]}>
          <meshPhysicalMaterial color="#141936" metalness={0.5} roughness={0.3} clearcoat={1} />
        </RoundedBox>
        {p.probs.map((prob, j) => (
          <Column key={j} j={j} rankPos={pos.get(j) ?? 0} prob={prob} maxP={maxP} isOpt={p.optimal.has(j)} color={p.color} label={p.labels[j]} done={p.done} />
        ))}
        <InvalidPool invalid={p.invalid} />
      </group>
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} minPolarAngle={0.5} maxPolarAngle={1.25} />
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={2.5} position={[0, 5, -5]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[-5, 2, 0]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} color="#6FC3B2" />
      </Environment>
    </Canvas>
  );
}
