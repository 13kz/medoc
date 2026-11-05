'use client'

import { ContactShadows, Environment, Float, Html, Lightformer, PresentationControls, RoundedBox, Text } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import type { Medication } from '@medoc/lib/types'
import { LIDS, type BoxCell, type BoxDay } from '@/lib/box'

const W = 1
const D = 0.9
const G = 0.1
const WALL_H = 0.36
const COLS = 7
const ROWS = 4
const TOTAL_W = COLS * W + (COLS + 1) * G
const TOTAL_D = ROWS * D + (ROWS + 1) * G
const FONT = '/fonts/atkinson-700.woff'

const colX = (c: number) => -TOTAL_W / 2 + G + W / 2 + c * (W + G)
const rowZ = (r: number) => -TOTAL_D / 2 + G + D / 2 + r * (D + G)

const STATUS: Record<string, string> = {
  pris: 'Pris',
  'a-venir': 'À venir',
  'a-prendre': 'À prendre',
  reporte: 'Reporté',
  'en-retard': 'Oublié',
}

function PillMesh({ med, position, rot }: { med: Medication; position: [number, number, number]; rot: number }) {
  const color = med.color
  const mat = <meshPhysicalMaterial color={color} roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.3} />
  switch (med.form) {
    case 'gelule':
      return (
        <group position={position} rotation={[0, rot, Math.PI / 2]}>
          <mesh castShadow position={[0, 0.06, 0]}>
            <capsuleGeometry args={[0.065, 0.09, 6, 16]} />
            {mat}
          </mesh>
          <mesh castShadow position={[0, -0.06, 0]}>
            <capsuleGeometry args={[0.066, 0.09, 6, 16]} />
            <meshPhysicalMaterial color="#fbfaf4" roughness={0.3} clearcoat={0.6} />
          </mesh>
        </group>
      )
    case 'sachet':
      return (
        <RoundedBox args={[0.3, 0.035, 0.22]} radius={0.015} position={position} rotation={[0, rot, 0]} castShadow>
          {mat}
        </RoundedBox>
      )
    case 'injection':
      return (
        <mesh castShadow position={position} rotation={[0, rot, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.36, 18]} />
          {mat}
        </mesh>
      )
    case 'gouttes':
      return (
        <mesh castShadow position={position} scale={[1, 1.35, 1]}>
          <sphereGeometry args={[0.08, 24, 16]} />
          <meshPhysicalMaterial color={color} roughness={0.05} transmission={0.4} thickness={0.3} clearcoat={1} />
        </mesh>
      )
    default:
      return (
        <mesh castShadow position={position} rotation={[0.08, rot, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.06, 28]} />
          {mat}
        </mesh>
      )
  }
}

const SPOTS: [number, number][] = [
  [-0.22, -0.14],
  [0.2, 0.12],
  [0.18, -0.18],
  [-0.2, 0.18],
  [0, 0],
]

function Lid({
  cell,
  col,
  row,
  letter,
  isToday,
  index,
  interactive,
  onPick,
  selected,
}: {
  cell: BoxCell
  col: number
  row: number
  letter: string
  isToday: boolean
  index: number
  interactive: boolean
  onPick: (e: ThreeEvent<MouseEvent>) => void
  selected: boolean
}) {
  const pivot = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshPhysicalMaterial>(null)
  const [hover, setHover] = useState(false)
  const info = LIDS[row]
  const tone = useMemo(() => new THREE.Color(info.tone), [info.tone])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    if (!pivot.current) return
    let target = 0
    if (t > 0.6 + index * 0.035) {
      if (cell.state === 'pris') target = -1.95
      else if (cell.state === 'partiel') target = -1.1
      else if (cell.state === 'maintenant') target = -0.5 - Math.sin(t * 3) * 0.12
      if (hover && interactive) target -= 0.18
      if (selected) target = Math.min(target, -1.2)
    }
    const r = pivot.current.rotation
    r.x = THREE.MathUtils.damp(r.x, target, 6, dt)
    if (mat.current) {
      const glow = cell.state === 'maintenant' ? 0.35 + Math.sin(t * 3) * 0.2 : cell.state === 'oublie' ? 0.04 : 0
      mat.current.emissiveIntensity = THREE.MathUtils.damp(mat.current.emissiveIntensity, glow + (hover ? 0.12 : 0), 8, dt)
    }
  })

  const empty = cell.state === 'vide'
  return (
    <group ref={pivot} position={[colX(col), 0, rowZ(row) - D / 2 - G / 2]}>
      <group position={[0, 0.04, D / 2 + G / 2]}>
        <RoundedBox
          args={[W + G * 0.9, 0.07, D + G * 0.9]}
          radius={0.03}
          smoothness={3}
          castShadow
          onClick={interactive ? onPick : undefined}
          onPointerOver={
            interactive
              ? (e) => {
                  e.stopPropagation()
                  setHover(true)
                  document.body.style.cursor = 'pointer'
                }
              : undefined
          }
          onPointerOut={
            interactive
              ? () => {
                  setHover(false)
                  document.body.style.cursor = ''
                }
              : undefined
          }
        >
          <meshPhysicalMaterial
            ref={mat}
            color={tone}
            emissive={tone}
            emissiveIntensity={0}
            roughness={0.18}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.08}
            transparent
            opacity={empty ? 0.4 : cell.state === 'pris' ? 0.55 : 0.88}
          />
        </RoundedBox>
        {row === 0 && (
          <Suspense fallback={null}>
          <Text font={FONT} fontSize={0.34} position={[0, 0.041, 0.02]} rotation={[-Math.PI / 2, 0, 0]} color={isToday ? '#14201a' : '#3a2f00'} fillOpacity={0.78} anchorX="center" anchorY="middle">
            {letter}
          </Text>
          </Suspense>
        )}
        {cell.state === 'oublie' && (
          <mesh position={[0, 0.045, D / 2 - 0.08]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.055, 24]} />
            <meshBasicMaterial color="#ff4d3d" toneMapped={false} />
          </mesh>
        )}
        {/* Petit ergot pour soulever le couvercle, comme sur un vrai pilulier. */}
        <mesh position={[0, 0.0, D / 2 + G * 0.45 + 0.03]}>
          <boxGeometry args={[0.28, 0.045, 0.06]} />
          <meshPhysicalMaterial color={tone} roughness={0.3} clearcoat={1} transparent opacity={empty ? 0.42 : 0.9} />
        </mesh>
      </group>
    </group>
  )
}

function Body({ days }: { days: BoxDay[] }) {
  const porcelain = <meshPhysicalMaterial color="#f4f1ea" roughness={0.42} clearcoat={0.5} clearcoatRoughness={0.4} />
  const todayCol = days.findIndex((d) => d.isToday)
  return (
    <group>
      <RoundedBox args={[TOTAL_W + 0.14, 0.42, TOTAL_D + 0.14]} radius={0.16} smoothness={5} position={[0, -WALL_H - 0.21 + 0.06, 0]} receiveShadow castShadow>
        {porcelain}
      </RoundedBox>
      {Array.from({ length: COLS + 1 }, (_, i) => (
        <mesh key={`x${i}`} position={[-TOTAL_W / 2 + G / 2 + i * (W + G), -WALL_H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[G, WALL_H, TOTAL_D]} />
          {porcelain}
        </mesh>
      ))}
      {Array.from({ length: ROWS + 1 }, (_, i) => (
        <mesh key={`z${i}`} position={[0, -WALL_H / 2, -TOTAL_D / 2 + G / 2 + i * (D + G)]} castShadow receiveShadow>
          <boxGeometry args={[TOTAL_W, WALL_H, G]} />
          {porcelain}
        </mesh>
      ))}
      <mesh position={[0, -WALL_H + 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[TOTAL_W, TOTAL_D]} />
        <meshStandardMaterial color="#e9e3d6" roughness={0.9} />
      </mesh>
      {todayCol >= 0 && (
        <mesh position={[colX(todayCol), -0.28, TOTAL_D / 2 + 0.075]}>
          <boxGeometry args={[W * 0.7, 0.05, 0.01]} />
          <meshBasicMaterial color="#0b6e4f" toneMapped={false} />
        </mesh>
      )}
      <Suspense fallback={null}>
      <Text font={FONT} fontSize={0.16} letterSpacing={0.32} position={[TOTAL_W / 2 - 0.9, -0.4, TOTAL_D / 2 + 0.075]} color="#9a9384" anchorX="center" anchorY="middle">
        MEDOC
      </Text>
      </Suspense>
    </group>
  )
}

function Pills({ days }: { days: BoxDay[] }) {
  return (
    <group>
      {days.map((day, c) =>
        day.cells.map((cell, r) =>
          cell.doses
            .filter((d) => d.status !== 'pris')
            .slice(0, SPOTS.length)
            .map((d, i) => {
              const [dx, dz] = SPOTS[i]
              return <PillMesh key={d.key} med={d.med} position={[colX(c) + dx, -WALL_H + 0.12, rowZ(r) + dz]} rot={(c * 7 + r * 3 + i) * 0.9} />
            }),
        ),
      )}
    </group>
  )
}

function Tip({ day, cell, onClose, onTake }: { day: BoxDay; cell: BoxCell; onClose: () => void; onTake?: () => void }) {
  const lid = LIDS.find((l) => l.id === cell.lid)!
  const pending = cell.doses.filter((d) => d.status === 'a-prendre' || d.status === 'en-retard' || d.status === 'reporte')
  return (
    <div className="box-tip" style={{ ['--tone' as string]: lid.tone }}>
      <div className="box-tip-head">
        <span className="box-tip-dot" />
        <strong>
          {day.label} · {lid.label}
        </strong>
        <button className="box-tip-x" onClick={onClose} aria-label="Fermer">
          ×
        </button>
      </div>
      {cell.doses.length === 0 ? (
        <p className="box-tip-empty">Case vide : rien de prévu.</p>
      ) : (
        <ul>
          {cell.doses.map((d) => (
            <li key={d.key} data-status={d.status}>
              <span className="box-tip-time">{d.time.replace(':', ' h ')}</span>
              <span className="box-tip-name">{d.med.name}</span>
              <span className="box-tip-status">
                {STATUS[d.status]}
                {d.intake && ` à ${new Date(d.intake.takenAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {onTake && day.isToday && pending.length > 0 && (
        <button className="box-tip-take" onClick={onTake}>
          Marquer comme pris
        </button>
      )}
    </div>
  )
}

function Scene({
  days,
  interactive,
  onTake,
}: {
  days: BoxDay[]
  interactive: boolean
  onTake?: (cell: BoxCell) => void
}) {
  const [sel, setSel] = useState<{ c: number; r: number } | null>(null)
  const selDay = sel ? days[sel.c] : null
  const selCell = sel && selDay ? selDay.cells[sel.r] : null
  return (
    <>
      <Body days={days} />
      <Pills days={days} />
      {days.map((day, c) =>
        day.cells.map((cell, r) => (
          <Lid
            key={`${c}-${r}`}
            cell={cell}
            col={c}
            row={r}
            index={c * ROWS + r}
            letter={day.letter}
            isToday={day.isToday}
            interactive={interactive}
            selected={!!sel && sel.c === c && sel.r === r}
            onPick={(e) => {
              e.stopPropagation()
              setSel((s) => (s && s.c === c && s.r === r ? null : { c, r }))
            }}
          />
        )),
      )}
      {sel && selDay && selCell && (
        <Html position={[colX(sel.c), 0.9, rowZ(sel.r)]} center zIndexRange={[40, 0]}>
          <Tip
            day={selDay}
            cell={selCell}
            onClose={() => setSel(null)}
            onTake={
              onTake
                ? () => {
                    onTake(selCell)
                    setSel(null)
                  }
                : undefined
            }
          />
        </Html>
      )}
    </>
  )
}

/** Garde tout le pilulier dans le cadre, quelle que soit la largeur de l'écran. */
function Fit({ children }: { children: ReactNode }) {
  const { size } = useThree()
  const k = Math.min(1, size.width / size.height / 1.5) * 0.92
  return (
    <group rotation={[0.04, -0.12, 0]} scale={k}>
      {children}
    </group>
  )
}

export default function PillBox({
  days,
  interactive = true,
  onTake,
  className,
  camera = [0, 7.2, 7.4],
}: {
  days: BoxDay[]
  interactive?: boolean
  onTake?: (cell: BoxCell) => void
  className?: string
  camera?: [number, number, number]
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  // Hors de l'écran, la scène ne se redessine plus : deux piluliers sur la page restent légers.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div className={className} ref={ref}>
      <Canvas frameloop={visible ? 'always' : 'never'} shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 2]} camera={{ position: camera, fov: 32 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[4, 9, 5]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />
        <PresentationControls global={false} snap polar={[-0.15, 0.35]} azimuth={[-0.55, 0.55]} speed={1.2}>
          <Float speed={1.4} rotationIntensity={0.08} floatIntensity={0.25} floatingRange={[-0.05, 0.08]}>
            <Fit>
              <Scene days={days} interactive={interactive} onTake={onTake} />
            </Fit>
          </Float>
        </PresentationControls>
        <ContactShadows position={[0, -1.05, 0]} opacity={0.55} scale={16} blur={2.6} far={3} color="#000" />
        <Environment resolution={256}>
          <Lightformer intensity={3} position={[0, 5, -6]} scale={[12, 3, 1]} color="#fff6e8" />
          <Lightformer intensity={1.4} position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} color="#ffd43b" />
          <Lightformer intensity={1.2} position={[6, 2, 2]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} color="#6cb4ff" />
          <Lightformer intensity={0.8} position={[0, -4, 4]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} color="#b69cff" />
        </Environment>
      </Canvas>
    </div>
  )
}
