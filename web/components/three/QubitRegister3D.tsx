"use client";
import { Environment, Float, Lightformer, RoundedBox, Text } from "@react-three/drei";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

/** Hero 3D: a glass 12-qubit register (3 teams × 4 sites) floating over flood water.
 *  Mouse → parallax tilt + hover-excite a qubit. Click → "measure": collapse to the optimal plan. */
const PLAN = new Set([1, 6, 11]); // BOAT→KNS, MED→DADU, SUP→JCD  (balanced optimum, verified by brute force)
const TEAMS = ["BOAT", "MED", "SUP"];
const SITES = ["JOHI", "KNS", "DADU", "JCD"];

function Qubit({ idx, pos, measured, hovered, onHover }: { idx: number; pos: [number, number, number]; measured: boolean; hovered: boolean; onHover: (i: number | null) => void }) {
  const core = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const on = PLAN.has(idx);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const green = useMemo(() => new THREE.Color("#FFB547"), []);
  const cyan = useMemo(() => new THREE.Color("#F3ECDD"), []);
  const violet = useMemo(() => new THREE.Color("#6F7DF0"), []);
  const saffron = useMemo(() => new THREE.Color("#E8B04B"), []);
  const dim = useMemo(() => new THREE.Color("#2A2F55"), []);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const flicker = 0.55 + 0.45 * Math.sin(t * (1.6 + (idx % 5) * 0.23) + phase);
    const targetScale = measured ? (on ? 1.15 : 0.35) : hovered ? 1.25 : 0.55 + flicker * 0.35;
    const s = THREE.MathUtils.damp(core.current!.scale.x, targetScale, 8, dt);
    core.current!.scale.setScalar(s);
    const targetCol = measured ? (on ? green : dim) : hovered ? cyan : flicker > 0.6 ? saffron : violet;
    mat.current!.color.lerp(targetCol, 0.08);
    mat.current!.emissive.lerp(targetCol, 0.08);
    mat.current!.emissiveIntensity = THREE.MathUtils.damp(mat.current!.emissiveIntensity, measured ? (on ? 3.2 : 0.1) : hovered ? 3 : 0.8 + flicker * 1.4, 6, dt);
    shell.current!.rotation.y += dt * 0.3;
    const sh = THREE.MathUtils.damp(shell.current!.scale.x, hovered ? 1.12 : 1, 10, dt);
    shell.current!.scale.setScalar(sh);
  });
  return (
    <group position={pos}>
      <mesh ref={shell}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(idx); }}
        onPointerOut={() => onHover(null)}>
        <sphereGeometry args={[0.44, 64, 64]} />
        <meshPhysicalMaterial color="#FFF3D6" transparent opacity={0.16} roughness={0.02} metalness={0.1} clearcoat={1} clearcoatRoughness={0.02} envMapIntensity={2.4} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={core}>
        <sphereGeometry args={[0.17, 32, 32]} />
        <meshStandardMaterial ref={mat} color="#E8B04B" emissive="#E8B04B" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Water() {
  const geo = useRef<THREE.PlaneGeometry>(null);
  const base = useRef<Float32Array | null>(null);
  useFrame(({ clock }) => {
    const g = geo.current!;
    const p = g.attributes.position as THREE.BufferAttribute;
    if (!base.current) base.current = Float32Array.from(p.array as Float32Array);
    const t = clock.elapsedTime;
    for (let i = 0; i < p.count; i++) {
      const x = base.current[i * 3], y = base.current[i * 3 + 1];
      p.setZ(i, Math.sin(x * 0.9 + t * 0.9) * 0.12 + Math.cos(y * 1.3 + t * 0.7) * 0.1 + Math.sin((x + y) * 0.5 + t * 0.4) * 0.08);
    }
    p.needsUpdate = true;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.55, 0]}>
      <planeGeometry ref={geo} args={[22, 14, 90, 60]} />
      <meshStandardMaterial color="#2E6F68" wireframe transparent opacity={0.22} emissive="#3F8F86" emissiveIntensity={0.4} />
    </mesh>
  );
}

function Register({ measured, onToggle }: { measured: boolean; onToggle: () => void }) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  useFrame(({ pointer }, dt) => {
    const g = group.current!;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, -0.35 + pointer.x * 0.45, 3, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, 0.28 - pointer.y * 0.22, 3, dt);
  });
  return (
    <group ref={group} onClick={onToggle}>
      {/* chassis */}
      <RoundedBox args={[5.8, 0.06, 4.4]} radius={0.03} position={[0, -0.62, 0]}>
        <meshPhysicalMaterial color="#1B2147" metalness={0.8} roughness={0.2} clearcoat={1} transparent opacity={0.55} />
      </RoundedBox>
      {[-1, 0, 1].map((r) => (
        <mesh key={r} position={[0, -0.57, r * 1.25]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5.2, 0.02]} />
          <meshBasicMaterial color="#6FC3B2" transparent opacity={0.35} />
        </mesh>
      ))}
      {TEAMS.map((t, ti) => (
        <Text key={t} position={[-3.15, -0.5, (ti - 1) * 1.25]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.2} color="#A9A291" anchorX="right">{t}</Text>
      ))}
      {SITES.map((s, si) => (
        <Text key={s} position={[(si - 1.5) * 1.25, -0.5, -2.35]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.2} color="#A9A291">{s}</Text>
      ))}
      {TEAMS.map((_, ti) => SITES.map((__, si) => {
        const idx = ti * 4 + si;
        return (
          <Float key={idx} speed={1.4} rotationIntensity={0} floatIntensity={measured ? 0.1 : 0.5} floatingRange={[-0.06, 0.08]}>
            <Qubit idx={idx} pos={[(si - 1.5) * 1.25, 0, (ti - 1) * 1.25]} measured={measured} hovered={hovered === idx} onHover={setHovered} />
          </Float>
        );
      }))}
    </group>
  );
}

export default function QubitRegister3D({ measured, onToggle }: { measured: boolean; onToggle: () => void }) {
  return (
    <Canvas camera={{ position: [0, 4.4, 9.6], fov: 34 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }} data-cursor={measured ? "reset" : "measure"}>
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 3]} intensity={1.2} />
      <pointLight position={[-4, 2, -2]} intensity={14} color="#E0533D" />
      <pointLight position={[4, 1, 3]} intensity={10} color="#6FC3B2" />
      <Register measured={measured} onToggle={onToggle} />
      <Water />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 5, -6]} scale={[12, 4, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={2} position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} color="#6FC3B2" />
        <Lightformer form="rect" intensity={2} position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} color="#8F9CFF" />
        <Lightformer form="ring" intensity={2} position={[0, 6, 2]} scale={3} color="#ffffff" />
      </Environment>
      <fog attach="fog" args={["#0C0F1E", 8, 18]} />
    </Canvas>
  );
}
