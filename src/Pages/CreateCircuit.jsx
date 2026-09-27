import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useRef, useState } from "react";

import breadboardImg from "../assets/Breadboard/Breadboard.png";

/* =====================================================
   EXISTING BREADBOARD — KEPT INTACT
===================================================== */

function Breadboard() {
  const texture = useLoader(THREE.TextureLoader, breadboardImg);
  texture.colorSpace = "srgb";

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[10, 0.4, 5]} />
        <meshStandardMaterial
          color="#d7d9dc"
          roughness={0.8}
          metalness={0}
        />
      </mesh>

      <mesh
        position={[0, 0.04, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[9.8, 4.9]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.75}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

/* =====================================================
   PHYSICAL BREADBOARD GEOMETRY

   The texture shows 30 signal columns with 5 holes in
   each vertical group. Components are snapped to these
   same coordinates.
===================================================== */

const COLUMN_COUNT = 30;
const X_MIN = -4.06;
const X_PITCH = 0.28;
const X_MAX = X_MIN + (COLUMN_COUNT - 1) * X_PITCH;
const Z_PITCH = 0.27;

const SIGNAL_ROWS = [
  -1.35,
  -1.08,
  -0.81,
  -0.54,
  -0.27,
   0.27,
   0.54,
   0.81,
   1.08,
   1.35,
];

const BOARD_Y = 0.055;
const BOARD_Z_MIN = -1.55;
const BOARD_Z_MAX = 1.55;

const RESISTOR_SPAN_COLUMNS = 4;
const RESISTOR_PIN_SPAN = RESISTOR_SPAN_COLUMNS * X_PITCH;

const COMPACT_SOURCE_SPAN_COLUMNS = 2;
const COMPACT_SOURCE_SPAN = COMPACT_SOURCE_SPAN_COLUMNS * X_PITCH;

const COMPONENT_TYPES = {
  RESISTOR: "resistor",
  LOAD: "load-resistor",
  VOLTAGE: "voltage-source",
  CURRENT: "current-source",
  VOLTMETER: "voltmeter",
  AMMETER: "ammeter",
  VCVS: "vcvs",
  VCCS: "vccs",
  CCVS: "ccvs",
  CCCS: "cccs",
};

const componentSpanColumns = (type) => {
  if (
    type === COMPONENT_TYPES.RESISTOR ||
    type === COMPONENT_TYPES.LOAD
  ) {
    return RESISTOR_SPAN_COLUMNS;
  }
  return COMPACT_SOURCE_SPAN_COLUMNS;
};

function nearestRow(z) {
  let best = SIGNAL_ROWS[0];
  let bestDistance = Math.abs(z - best);

  for (let i = 1; i < SIGNAL_ROWS.length; i += 1) {
    const distance = Math.abs(z - SIGNAL_ROWS[i]);
    if (distance < bestDistance) {
      best = SIGNAL_ROWS[i];
      bestDistance = distance;
    }
  }

  return best;
}

function boardPointFromEvent(event, y = BOARD_Y) {
  const plane = new THREE.Plane(
    new THREE.Vector3(0, 1, 0),
    -y
  );
  const point = new THREE.Vector3();
  const hit = event?.ray?.intersectPlane(plane, point);

  return hit ? point : null;
}

function clampBoardPoint(point, type) {
  const spanColumns = componentSpanColumns(type);
  const span = spanColumns * X_PITCH;
  const halfSpan = span / 2;

  return {
    x: THREE.MathUtils.clamp(point.x, X_MIN + halfSpan, X_MAX - halfSpan),
    z: THREE.MathUtils.clamp(point.z, BOARD_Z_MIN, BOARD_Z_MAX),
  };
}

function snapComponent(point, type, rotation = 0) {
  const normalizedRotation = THREE.MathUtils.euclideanModulo(rotation, Math.PI * 2);
  const quarterTurn = Math.abs(normalizedRotation - Math.PI / 2) < 0.001 ||
    Math.abs(normalizedRotation - (Math.PI * 1.5)) < 0.001;

  if (
    type === COMPONENT_TYPES.VCVS ||
    type === COMPONENT_TYPES.VCCS ||
    type === COMPONENT_TYPES.CCVS ||
    type === COMPONENT_TYPES.CCCS
  ) {
    // Four-terminal controlled source: its terminals occupy a 2 x 2 hole block.
    const leftColumn = THREE.MathUtils.clamp(
      Math.round((point.x - X_MIN) / X_PITCH),
      1,
      COLUMN_COUNT - 2,
    );

    const rowCandidates = [];
    for (let i = 0; i < SIGNAL_ROWS.length - 1; i += 1) {
      rowCandidates.push({
        centerZ: (SIGNAL_ROWS[i] + SIGNAL_ROWS[i + 1]) / 2,
        rowIndex: i,
      });
    }

    let best = rowCandidates[0];
    let bestDistance = Infinity;
    rowCandidates.forEach((candidate) => {
      const distance = Math.abs(point.z - candidate.centerZ);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    });

    return {
      x: X_MIN + leftColumn * X_PITCH,
      z: best.centerZ,
      leftX: X_MIN + leftColumn * X_PITCH,
      rightX: X_MIN + (leftColumn + 2) * X_PITCH,
      rowZ: best.centerZ,
      rowIndex: best.rowIndex,
    };
  }

  const spanColumns = componentSpanColumns(type);
  const spanX = spanColumns * X_PITCH;

  if (quarterTurn) {
    const topRowIndex = THREE.MathUtils.clamp(
      Math.round((point.z - SIGNAL_ROWS[0]) / Z_PITCH),
      0,
      SIGNAL_ROWS.length - 1 - spanColumns,
    );

    const topZ = SIGNAL_ROWS[topRowIndex];
    const bottomZ = topZ + spanColumns * Z_PITCH;

    const column = THREE.MathUtils.clamp(
      Math.round((point.x - X_MIN) / X_PITCH),
      0,
      COLUMN_COUNT - 1,
    );

    return {
      x: X_MIN + column * X_PITCH,
      z: (topZ + bottomZ) / 2,
      leftX: X_MIN + column * X_PITCH,
      rightX: X_MIN + column * X_PITCH,
      rowZ: (topZ + bottomZ) / 2,
      rowIndex: topRowIndex,
    };
  }

  const rawLeftColumn = Math.round((point.x - X_MIN) / X_PITCH);
  const maxLeftColumn = COLUMN_COUNT - 1 - spanColumns;
  const leftColumn = THREE.MathUtils.clamp(
    rawLeftColumn,
    0,
    maxLeftColumn,
  );

  const leftX = X_MIN + leftColumn * X_PITCH;
  const rightX = leftX + spanX;

  return {
    x: (leftX + rightX) / 2,
    z: nearestRow(point.z),
    leftX,
    rightX,
    rowZ: nearestRow(point.z),
  };
}

function clampComponentPosition(point, type, rotation = 0) {
  const normalizedRotation = THREE.MathUtils.euclideanModulo(rotation, Math.PI * 2);
  const quarterTurn = Math.abs(normalizedRotation - Math.PI / 2) < 0.001 || Math.abs(normalizedRotation - Math.PI * 1.5) < 0.001;
  const spanColumns = componentSpanColumns(type);
  const xHalf = quarterTurn ? 0 : (spanColumns * X_PITCH) / 2;
  const zHalf = quarterTurn ? (spanColumns * Z_PITCH) / 2 : 0;
  return {
    x: THREE.MathUtils.clamp(point.x, X_MIN + xHalf, X_MAX - xHalf),
    z: THREE.MathUtils.clamp(point.z, BOARD_Z_MIN + zHalf, BOARD_Z_MAX - zHalf),
  };
}

function rotateLocalPoint(localPoint, rotation = 0) {
  const vector = new THREE.Vector3(...localPoint);
  vector.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
  return vector;
}

function terminalPositions(position, type, rotation = 0) {
  const normalizedRotation = THREE.MathUtils.euclideanModulo(rotation, Math.PI * 2);
  const quarterTurn = Math.abs(normalizedRotation - Math.PI / 2) < 0.001 ||
    Math.abs(normalizedRotation - (Math.PI * 1.5)) < 0.001;

  const spanColumns = componentSpanColumns(type);
  const span = quarterTurn
    ? spanColumns * Z_PITCH
    : spanColumns * X_PITCH;

  const local = [
    [-span / 2, BOARD_Y, 0],
    [span / 2, BOARD_Y, 0],
  ];

  return local.map(([x, y, z]) => {
    const rotated = rotateLocalPoint([x, y, z], rotation);
    return [
      position[0] + rotated.x,
      BOARD_Y,
      position[2] + rotated.z,
    ];
  });
}

function dependentTerminalPositions(position, rotation = 0) {
  return [
    [-X_PITCH, BOARD_Y, -Z_PITCH],
    [ X_PITCH, BOARD_Y, -Z_PITCH],
    [-X_PITCH, BOARD_Y,  Z_PITCH],
    [ X_PITCH, BOARD_Y,  Z_PITCH],
  ].map((local) => {
    const rotated = rotateLocalPoint(local, rotation);
    return [position[0] + rotated.x, BOARD_Y, position[2] + rotated.z];
  });
}

/* =====================================================
   COMMON MATERIALS
===================================================== */

const metalMaterial = {
  color: "#aeb5bb",
  metalness: 0.93,
  roughness: 0.16,
};

/* =====================================================
   RESISTOR / LOAD RESISTOR

   Thin body + one continuous metal path on each side:
   body -> horizontal lead -> rounded bend -> vertical pin.
===================================================== */

function TerminalInsertion({ position, color = "#2a3035" }) {
  return (
    <group position={position} renderOrder={1750}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.030, 0.030, 0.008, 18]} />
        <meshStandardMaterial color={color} roughness={0.28} metalness={0.62} />
      </mesh>
      <mesh position={[0, -0.055, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.115, 14]} />
        <meshStandardMaterial color="#b9bec3" roughness={0.20} metalness={0.90} />
      </mesh>
    </group>
  );
}

function ResistorModel({
  type,
  position,
  selected,
  rotation = 0,
  onSelect,
  onDragStart,
  onTerminalClick,
}) {
  const bodyLength = 0.52;
  const bodyRadius = 0.060;
  const normalizedRotation = THREE.MathUtils.euclideanModulo(rotation, Math.PI * 2);
  const quarterTurn = Math.abs(normalizedRotation - Math.PI / 2) < 0.001 ||
    Math.abs(normalizedRotation - (Math.PI * 1.5)) < 0.001;
  const pinX = (quarterTurn
    ? RESISTOR_SPAN_COLUMNS * Z_PITCH
    : RESISTOR_PIN_SPAN) / 2;
  const leadLength = pinX - bodyLength / 2;
  const leadCenter = (pinX + bodyLength / 2) / 2;
  const bodyY = 0.175;
  const pinBottomY = -0.085;
  const pinLength = bodyY - pinBottomY;
  const pinCenterY = (bodyY + pinBottomY) / 2;

  const bands =
    type === COMPONENT_TYPES.LOAD
      ? [
          [-0.15, "#2e2e2e"],
          [-0.03, "#7b3f20"],
          [0.09, "#d4a72c"],
          [0.18, "#c7b77b"],
        ]
      : [
          [-0.15, "#5d3418"],
          [-0.03, "#111111"],
          [0.09, "#c72b2b"],
          [0.18, "#d4a72c"],
        ];

  const terminals = terminalPositions(position, type, rotation);

  return (
    <group
      position={position}
      rotation={[0, rotation, 0]}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
        onDragStart(event);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "grab";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      {selected && (
        <mesh
          position={[0, 0.058, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.40, 0.43, 48]} />
          <meshBasicMaterial
            color="#63b8ff"
            transparent
            opacity={0.40}
            depthWrite={false}
          />
        </mesh>
      )}

      <mesh
        position={[0, bodyY, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[bodyRadius, bodyRadius, bodyLength, 32]} />
        <meshStandardMaterial
          color="#c9965f"
          roughness={0.55}
          metalness={0.02}
        />
      </mesh>

      <mesh
        position={[-bodyLength / 2, bodyY, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[bodyRadius + 0.002, bodyRadius + 0.002, 0.02, 24]} />
        <meshStandardMaterial color="#d7ab73" roughness={0.5} />
      </mesh>

      <mesh
        position={[bodyLength / 2, bodyY, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[bodyRadius + 0.002, bodyRadius + 0.002, 0.02, 24]} />
        <meshStandardMaterial color="#d7ab73" roughness={0.5} />
      </mesh>

      {/* Left continuous lead */}
      <mesh
        position={[-leadCenter, bodyY, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.016, 0.016, leadLength, 16]} />
        <meshStandardMaterial {...metalMaterial} />
      </mesh>

      {/* Right continuous lead */}
      <mesh
        position={[leadCenter, bodyY, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.016, 0.016, leadLength, 16]} />
        <meshStandardMaterial {...metalMaterial} />
      </mesh>

      {/* Left vertical pin */}
      <mesh position={[-pinX, pinCenterY, 0]} castShadow>
        <cylinderGeometry args={[0.016, 0.016, pinLength, 16]} />
        <meshStandardMaterial {...metalMaterial} />
      </mesh>

      {/* Right vertical pin */}
      <mesh position={[pinX, pinCenterY, 0]} castShadow>
        <cylinderGeometry args={[0.016, 0.016, pinLength, 16]} />
        <meshStandardMaterial {...metalMaterial} />
      </mesh>

      {/* Soft metal bend at each corner */}
      <mesh position={[-pinX, bodyY, 0]}>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshStandardMaterial {...metalMaterial} />
      </mesh>
      <mesh position={[pinX, bodyY, 0]}>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshStandardMaterial {...metalMaterial} />
      </mesh>

      {bands.map(([x, color]) => (
        <mesh
          key={`${x}-${color}`}
          position={[x, bodyY, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <torusGeometry args={[bodyRadius + 0.002, 0.0105, 12, 28]} />
          <meshStandardMaterial
            color={color}
            metalness={color === "#d4a72c" ? 0.45 : 0.02}
            roughness={0.34}
          />
        </mesh>
      ))}

      {/* Large transparent grab target on the body */}
      <mesh position={[0, bodyY, 0]}>
        <boxGeometry args={[0.86, 0.24, 0.30]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Terminal targets */}
      {terminals.map((terminal, index) => (
        <mesh
          key={`terminal-${index}`}
          position={[
            terminal[0] - position[0],
            0.14,
            terminal[2] - position[2],
          ]}
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelect();
            onTerminalClick(terminal);
          }}
        >
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      ))}
    </group>
  );
}

/* =====================================================
   TWO-PIN PHYSICAL SOURCE
===================================================== */

function SourceModel({
  type,
  position,
  selected,
  rotation = 0,
  deactivated = false,
  onSelect,
  onDragStart,
  onTerminalClick,
}) {
  const normalizedRotation = THREE.MathUtils.euclideanModulo(rotation, Math.PI * 2);
  const quarterTurn = Math.abs(normalizedRotation - Math.PI / 2) < 0.001 ||
    Math.abs(normalizedRotation - (Math.PI * 1.5)) < 0.001;
  const span = quarterTurn
    ? COMPACT_SOURCE_SPAN_COLUMNS * Z_PITCH
    : COMPACT_SOURCE_SPAN;
  const pinX = span / 2;
  const bodyLength = 0.64;
  const bodyRadius = 0.13;
  const bodyY = 0.19;
  const pinBottomY = -0.085;
  const pinCenterY = (bodyY + pinBottomY) / 2;
  const pinLength = bodyY - pinBottomY;

  const isVoltage = type === COMPONENT_TYPES.VOLTAGE;
  const isCurrent = type === COMPONENT_TYPES.CURRENT;

  const bodyColor = deactivated ? "#56606a" : (isVoltage ? "#285a8f" : "#7a4522");
  const label = isVoltage ? "V" : "I";
  const terminals = terminalPositions(position, type, rotation);

  return (
    <group
      position={position}
      rotation={[0, rotation, 0]}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
        onDragStart(event);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "grab";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      {selected && (
        <mesh
          position={[0, 0.060, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.34, 0.38, 48]} />
          <meshBasicMaterial
            color="#63b8ff"
            transparent
            opacity={0.40}
            depthWrite={false}
          />
        </mesh>
      )}

      <mesh
        position={[0, bodyY, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[bodyRadius, bodyRadius, bodyLength, 32]} />
        <meshStandardMaterial
          color={bodyColor}
          roughness={0.34}
          metalness={0.14}
          transparent={deactivated}
          opacity={deactivated ? 0.68 : 1}
        />
      </mesh>

      <mesh position={[-0.30, bodyY, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[bodyRadius + 0.008, bodyRadius + 0.008, 0.035, 24]} />
        <meshStandardMaterial color="#c9c9c9" metalness={0.7} roughness={0.25} />
      </mesh>

      <mesh position={[0.30, bodyY, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[bodyRadius + 0.008, bodyRadius + 0.008, 0.035, 24]} />
        <meshStandardMaterial color="#c9c9c9" metalness={0.7} roughness={0.25} />
      </mesh>

      <mesh position={[-pinX, pinCenterY - 0.035, 0]}>
        <cylinderGeometry args={[0.016, 0.016, pinLength + 0.070, 16]} />
        <meshStandardMaterial {...metalMaterial} />
      </mesh>
      <mesh position={[pinX, pinCenterY - 0.035, 0]}>
        <cylinderGeometry args={[0.016, 0.016, pinLength + 0.070, 16]} />
        <meshStandardMaterial {...metalMaterial} />
      </mesh>
      <TerminalInsertion position={[-pinX, 0.058, 0]} />
      <TerminalInsertion position={[pinX, 0.058, 0]} />

      <mesh position={[0, bodyY + 0.055, 0]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.082, 0.082, 0.012, 20]} />
        <meshStandardMaterial color="#f5f6f7" roughness={0.28} />
      </mesh>

      <mesh position={[0, bodyY + 0.066, 0]}>
        <torusGeometry args={[0.044, 0.009, 10, 24]} />
        <meshStandardMaterial
          color={isVoltage ? "#cf2f2f" : "#2a9d52"}
          roughness={0.28}
          metalness={0.12}
        />
      </mesh>

      <group position={[0, bodyY + 0.075, 0]}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.01, 0.01, 0.02]} />
          <meshBasicMaterial color="#252525" />
        </mesh>
      </group>

      <mesh position={[0, bodyY, 0]}>
        <boxGeometry args={[0.82, 0.25, 0.30]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {terminals.map((terminal, index) => (
        <mesh
          key={`source-terminal-${index}`}
          position={[
            terminal[0] - position[0],
            0.14,
            terminal[2] - position[2],
          ]}
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelect();
            onTerminalClick(terminal);
          }}
        >
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      ))}

      <mesh position={[0, bodyY + 0.095, 0]}>
        <boxGeometry args={[0.16, 0.045, 0.09]} />
        <meshStandardMaterial color="#f0f0f0" roughness={0.25} />
      </mesh>

      {deactivated && isVoltage && (
        <>
          <mesh position={[0, 0.055, 0]}>
            <boxGeometry args={[span * 0.90, 0.035, 0.035]} />
            <meshStandardMaterial color="#c7ccd1" metalness={0.88} roughness={0.16} />
          </mesh>
          <Text
            position={[0, bodyY + 0.18, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.060}
            color="#f2f4f6"
            anchorX="center"
            anchorY="middle"
          >
            SHORT
          </Text>
        </>
      )}

      {deactivated && isCurrent && (
        <>
          <mesh position={[0, 0.055, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[0.05, 0.05, 0.16]} />
            <meshStandardMaterial color="#15191d" roughness={0.35} />
          </mesh>
          <Text
            position={[0, bodyY + 0.18, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.060}
            color="#f2f4f6"
            anchorX="center"
            anchorY="middle"
          >
            OPEN
          </Text>
        </>
      )}

      {deactivated && (
        <Text
          position={[0, bodyY + 0.205, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.052}
          color={isVoltage ? "#d8e7f6" : "#e8d9d0"}
          anchorX="center"
          anchorY="middle"
        >
          {isVoltage ? "INDEPENDENT V: SHORTED" : "INDEPENDENT I: OPEN"}
        </Text>
      )}

      <group position={[0, bodyY + 0.12, 0]} scale={0.000001}>
        {/* Intentionally empty visual text slot; label remains in menu/type data. */}
      </group>
    </group>
  );
}

/* =====================================================
   DIGITAL VOLTMETER / AMMETER

   A small physical meter body with display, selector knob,
   banana sockets and two short probe leads.
===================================================== */

function MeterModel({
  type,
  position,
  selected,
  rotation = 0,
  onSelect,
  onDragStart,
  onTerminalClick,
}) {
  const isVolt = type === COMPONENT_TYPES.VOLTMETER;
  const span = COMPACT_SOURCE_SPAN;
  const terminals = terminalPositions(position, type, rotation);
  const bodyY = 0.19;

  const bodyX = 0.78;
  const bodyZ = 0.46;
  const bodyHeight = 0.23;

  return (
    <group
      position={position}
      rotation={[0, rotation, 0]}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
        onDragStart(event);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "grab";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      {selected && (
        <mesh
          position={[0, 0.060, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.45, 0.49, 48]} />
          <meshBasicMaterial
            color="#63b8ff"
            transparent
            opacity={0.40}
            depthWrite={false}
          />
        </mesh>
      )}

      <mesh position={[0, bodyY, 0]} castShadow>
        <boxGeometry args={[bodyX, bodyHeight, bodyZ]} />
        <meshStandardMaterial
          color="#2a3138"
          roughness={0.33}
          metalness={0.24}
        />
      </mesh>

      <mesh position={[0, bodyY + 0.125, -0.03]}>
        <boxGeometry args={[0.46, 0.08, 0.20]} />
        <meshStandardMaterial
          color="#192027"
          roughness={0.22}
          metalness={0.15}
        />
      </mesh>

      <mesh position={[0, bodyY + 0.126, -0.026]}>
        <boxGeometry args={[0.38, 0.05, 0.15]} />
        <meshStandardMaterial
          color="#85b7a0"
          emissive="#294237"
          emissiveIntensity={0.6}
          roughness={0.45}
        />
      </mesh>

      <mesh position={[0.26, bodyY + 0.085, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.065, 0.065, 0.026, 28]} />
        <meshStandardMaterial color="#15191d" roughness={0.25} metalness={0.45} />
      </mesh>

      <mesh position={[0.26, bodyY + 0.115, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.020, 0.020, 0.11, 16]} />
        <meshStandardMaterial color="#bfc4c9" metalness={0.8} roughness={0.18} />
      </mesh>

      {/* Front banana sockets */}
      <mesh position={[-0.18, bodyY, -0.235]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.025, 20]} />
        <meshStandardMaterial color="#22262b" metalness={0.55} roughness={0.2} />
      </mesh>
      <mesh position={[0.18, bodyY, -0.235]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.025, 20]} />
        <meshStandardMaterial color="#22262b" metalness={0.55} roughness={0.2} />
      </mesh>

      {/* Probe leads sitting just above the board */}
      <MeterLead start={[-0.18, bodyY - 0.01, -0.23]} end={[-span / 2, 0.075, 0.12]} color="#c93035" />
      <MeterLead start={[0.18, bodyY - 0.01, -0.23]} end={[span / 2, 0.075, 0.12]} color="#171717" />

      <mesh position={[0, bodyY, 0]}>
        <boxGeometry args={[0.98, 0.34, 0.56]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {terminals.map((terminal, index) => (
        <mesh
          key={`meter-terminal-${index}`}
          position={[
            terminal[0] - position[0],
            -0.095,
            terminal[2] - position[2],
          ]}
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelect();
            onTerminalClick(terminal);
          }}
        >
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      ))}

      {/* Small front identity marker */}
      <mesh position={[0, bodyY + 0.025, -0.292]}>
        <boxGeometry args={[0.18, 0.05, 0.015]} />
        <meshStandardMaterial
          color={isVolt ? "#d8ecff" : "#ffe1e1"}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

function MeterLead({ start, end, color }) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(...start),
    new THREE.Vector3(
      (start[0] + end[0]) / 2,
      Math.max(start[1], end[1]) + 0.07,
      (start[2] + end[2]) / 2,
    ),
    new THREE.Vector3(...end),
  ]);

  return (
    <mesh>
      <tubeGeometry args={[curve, 18, 0.016, 10, false]} />
      <meshStandardMaterial
        color={color}
        roughness={0.45}
        metalness={0.2}
      />
    </mesh>
  );
}

/* =====================================================
   DEPENDENT SOURCE

   Physical two-terminal source-style body with its
   dependent-source type stored in component data.
===================================================== */

function DependentSourceModel({
  type,
  position,
  selected,
  rotation = 0,
  onSelect,
  onDragStart,
  onTerminalClick,
}) {
  const bodyY = 0.23;
  const bodyW = 0.92;
  const bodyH = 0.30;
  const bodyD = 0.62;
  const pinTopY = bodyY - bodyH / 2 + 0.015;
  const pinBottomY = -0.085;
  const pinLength = pinTopY - pinBottomY;
  const pinCenterY = (pinTopY + pinBottomY) / 2;

  const typeInfo = {
    [COMPONENT_TYPES.VCVS]: {
      label: "VCVS",
      subtitle: "V controlled V",
      accent: "#2f70b8",
    },
    [COMPONENT_TYPES.VCCS]: {
      label: "VCCS",
      subtitle: "V controlled I",
      accent: "#218a76",
    },
    [COMPONENT_TYPES.CCVS]: {
      label: "CCVS",
      subtitle: "I controlled V",
      accent: "#b17924",
    },
    [COMPONENT_TYPES.CCCS]: {
      label: "CCCS",
      subtitle: "I controlled I",
      accent: "#9a4c94",
    },
  }[type] || {
    label: "CTRL",
    subtitle: "Controlled source",
    accent: "#5b6570",
  };

  const terminals = dependentTerminalPositions(position, rotation);

  const terminalColors = ["#d12f36", "#1f2328", "#d12f36", "#1f2328"];

  return (
    <group
      position={position}
      rotation={[0, rotation, 0]}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
        onDragStart(event);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "grab";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      {selected && (
        <mesh position={[0, 0.062, 0]}>
          <boxGeometry args={[1.14, 0.018, 0.84]} />
          <meshBasicMaterial
            color="#63b8ff"
            transparent
            opacity={0.12}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Realistic controlled-source instrument enclosure */}
      <mesh position={[0, bodyY, 0]} castShadow>
        <boxGeometry args={[bodyW, bodyH, bodyD]} />
        <meshStandardMaterial
          color="#4a535d"
          roughness={0.42}
          metalness={0.22}
        />
      </mesh>

      <mesh position={[-bodyW / 2 - 0.012, bodyY, 0]}>
        <boxGeometry args={[0.035, bodyH + 0.035, bodyD + 0.035]} />
        <meshStandardMaterial color={typeInfo.accent} roughness={0.30} metalness={0.25} />
      </mesh>
      <mesh position={[bodyW / 2 + 0.012, bodyY, 0]}>
        <boxGeometry args={[0.035, bodyH + 0.035, bodyD + 0.035]} />
        <meshStandardMaterial color={typeInfo.accent} roughness={0.30} metalness={0.25} />
      </mesh>

      {/* Front instrument plate */}
      <mesh position={[0, bodyY + 0.080, -bodyD / 2 - 0.018]}>
        <boxGeometry args={[0.76, 0.17, 0.028]} />
        <meshStandardMaterial color="#20262d" roughness={0.30} metalness={0.18} />
      </mesh>

      <Text
        position={[-0.31, bodyY + 0.108, -bodyD / 2 - 0.034]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.088}
        anchorX="left"
        anchorY="middle"
        color="#f3f6f8"
      >
        {typeInfo.label}
      </Text>

      <Text
        position={[-0.31, bodyY + 0.045, -bodyD / 2 - 0.034]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.035}
        anchorX="left"
        anchorY="middle"
        color="#b8c2cb"
      >
        {typeInfo.subtitle}
      </Text>

      {/* Gain/control knob */}
      <mesh position={[0.25, bodyY + 0.055, -bodyD / 2 - 0.050]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.028, 24]} />
        <meshStandardMaterial color="#12161a" roughness={0.22} metalness={0.5} />
      </mesh>
      <mesh position={[0.25, bodyY + 0.085, -bodyD / 2 - 0.050]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.078, 12]} />
        <meshStandardMaterial color="#c2c8cd" roughness={0.18} metalness={0.82} />
      </mesh>

      {/* Four physical binding posts */}
      {[[-0.25, -0.14], [0.25, -0.14], [-0.25, 0.14], [0.25, 0.14]].map(([x, z], index) => (
        <group key={`post-${index}`} position={[x, bodyY + 0.17, z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.034, 0.040, 0.045, 18]} />
            <meshStandardMaterial
              color={terminalColors[index]}
              roughness={0.22}
              metalness={0.62}
            />
          </mesh>
          <mesh position={[0, 0.027, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.052, 16]} />
            <meshStandardMaterial color="#d0d4d8" roughness={0.18} metalness={0.82} />
          </mesh>
        </group>
      ))}

      <Text
        position={[-0.41, bodyY + 0.178, -0.22]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.032}
        color="#d2d9df"
        anchorX="left"
        anchorY="middle"
      >
        CTRL
      </Text>
      <Text
        position={[-0.41, bodyY + 0.178, 0.15]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.032}
        color="#d2d9df"
        anchorX="left"
        anchorY="middle"
      >
        OUT
      </Text>

      {/* Four pins entering the breadboard */}
      {[
        [-X_PITCH, -Z_PITCH],
        [ X_PITCH, -Z_PITCH],
        [-X_PITCH,  Z_PITCH],
        [ X_PITCH,  Z_PITCH],
      ].map(([x, z], index) => (
        <group key={`pin-${index}`}>
          <mesh position={[x, pinCenterY - 0.035, z]}>
            <cylinderGeometry args={[0.015, 0.015, pinLength + 0.070, 14]} />
            <meshStandardMaterial {...metalMaterial} />
          </mesh>
          <TerminalInsertion position={[x, 0.058, z]} />
        </group>
      ))}

      {/* Large transparent grab target */}
      <mesh position={[0, bodyY, 0]}>
        <boxGeometry args={[1.03, 0.35, 0.72]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {terminals.map((terminal, index) => (
        <mesh
          key={`dependent-terminal-${index}`}
          position={[terminal[0] - position[0], 0.14, terminal[2] - position[2]]}
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelect();
            onTerminalClick(terminal);
          }}
        >
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      ))}
    </group>
  );
}

/* =====================================================
   CURVED PHYSICAL JUMPER WIRE
===================================================== */

function WirePlug({ point, color }) {
  return (
    <group position={[point[0], BOARD_Y - 0.028, point[2]]} renderOrder={90}>
      {/* Recessed contact collar: deliberately subtle, not a floating marker. */}
      <mesh position={[0, 0.034, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.043, 0.006, 12, 24]} />
        <meshStandardMaterial
          color="#1e2429"
          roughness={0.30}
          metalness={0.62}
        />
      </mesh>

      {/* Physical jumper pin penetrating below the board surface. */}
      <mesh position={[0, 0.005, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.20, 14]} />
        <meshStandardMaterial
          color="#b7bdc2"
          roughness={0.20}
          metalness={0.88}
        />
      </mesh>

      {/* Small insulated shoulder exactly where the jumper exits the hole. */}
      <mesh position={[0, 0.108, 0]}>
        <sphereGeometry args={[0.028, 14, 14]} />
        <meshStandardMaterial
          color={color}
          roughness={0.36}
          metalness={0.12}
        />
      </mesh>
    </group>
  );
}

const WIRE_COLORS = ["#c93237", "#2e73d2", "#2aa76b", "#db7a24", "#d1ad32", "#8d55bd"];

function Wire3D({
  start,
  end,
  color = "#2d6cdf",
  preview = false,
  selected = false,
  onSelect,
}) {
  // The cable starts at the exact hole center, rises through a short
  // vertical strain-relief, then follows a clean low-profile arc.
  const startTop = new THREE.Vector3(start[0], BOARD_Y + 0.045, start[2]);
  const endTop = new THREE.Vector3(end[0], BOARD_Y + 0.045, end[2]);
  const distance = startTop.distanceTo(endTop);

  const sag = preview
    ? Math.min(0.24, 0.045 + distance * 0.032)
    : Math.min(0.20, 0.040 + distance * 0.028);

  const horizontal = new THREE.Vector3(
    endTop.x - startTop.x,
    0,
    endTop.z - startTop.z,
  );

  const length = horizontal.length();
  const direction = length > 0.0001
    ? horizontal.clone().normalize()
    : new THREE.Vector3(1, 0, 0);

  const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
  const sideOffset = Math.min(0.08, length * 0.025);

  const control1 = startTop.clone().add(
    direction.clone().multiplyScalar(length * 0.28)
  );
  control1.y += sag;
  control1.add(perpendicular.clone().multiplyScalar(sideOffset));

  const control2 = endTop.clone().sub(
    direction.clone().multiplyScalar(length * 0.28)
  );
  control2.y += sag;
  control2.add(perpendicular.clone().multiplyScalar(-sideOffset));

  const curve = new THREE.CubicBezierCurve3(
    startTop,
    control1,
    control2,
    endTop,
  );

  const cableColor = selected ? "#f0b83f" : color;

  return (
    <>
      <WirePlug point={start} color={cableColor} />
      <WirePlug point={end} color={cableColor} />

      <mesh
        onPointerDown={(event) => {
          if (preview) return;
          event.stopPropagation();
          onSelect?.();
        }}
        renderOrder={selected ? 100 : 95}
      >
        <tubeGeometry
          args={[curve, 48, selected ? 0.030 : 0.022, 12, false]}
        />
        <meshStandardMaterial
          color={cableColor}
          roughness={0.40}
          metalness={0.08}
          transparent={preview}
          opacity={preview ? 0.58 : 1}
          emissive={selected ? "#4c3a05" : "#000000"}
          emissiveIntensity={selected ? 0.25 : 0}
        />
      </mesh>
    </>
  );
}

/* =====================================================
   INVISIBLE EXACT HOLE HIT TARGETS
===================================================== */

function BreadboardHoleTargets({ onHoleDown, onHoleMove }) {
  const targets = [];

  for (let row = 0; row < SIGNAL_ROWS.length; row += 1) {
    for (let column = 0; column < COLUMN_COUNT; column += 1) {
      const x = X_MIN + column * X_PITCH;
      const z = SIGNAL_ROWS[row];
      targets.push(
        <mesh
          key={`${row}-${column}`}
          position={[x, 0.095, z]}
          onPointerDown={(event) => {
            event.stopPropagation();
            onHoleDown([x, BOARD_Y, z]);
          }}
          onPointerMove={(event) => {
            event.stopPropagation();
            onHoleMove([x, BOARD_Y, z]);
          }}
        >
          <sphereGeometry args={[0.070, 10, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      );
    }
  }

  return <group renderOrder={1500}>{targets}</group>;
}


/* =====================================================
   OCCUPIED BREADBOARD HOLES

   Reference behavior:
   - untouched holes keep the original breadboard appearance
   - holes occupied by component pins glow green
   - wire endpoints are also marked as occupied
   - the marker sits directly over the real hole so the
     connection reads visually as "inserted into the board"
===================================================== */

function BreadboardHoleStatus({ components, wires }) {
  const occupied = new Map();

  const markPoint = (point, source = "component") => {
    if (!point) return;

    const nearest = nearestHoleData(
      new THREE.Vector3(point[0], BOARD_Y, point[2])
    );

    const distance = Math.hypot(
      point[0] - nearest.x,
      point[2] - nearest.z,
    );

    if (distance > 0.06) return;

    const key = `${nearest.column}:${nearest.rowIndex}`;
    occupied.set(key, {
      x: nearest.x,
      z: nearest.z,
      source,
    });
  };

  components.forEach((component) => {
    componentTerminalPoints(component).forEach((point) => {
      markPoint(point, "component");
    });
  });

  wires.forEach((wire) => {
    markPoint(wire.start, "wire");
    markPoint(wire.end, "wire");
  });

  return (
    <group renderOrder={1700}>
      {[...occupied.values()].map((hole) => (
        <group
          key={`${hole.x}-${hole.z}`}
          position={[hole.x, BOARD_Y + 0.003, hole.z]}
        >
          {/* The reference image has a colored occupied contact. Here it is
              recessed into the hole instead of drawn as a large neon ring. */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.027, 20]} />
            <meshStandardMaterial
              color={hole.source === "wire" ? "#4bcf80" : "#34b96a"}
              emissive={hole.source === "wire" ? "#174e30" : "#0f4528"}
              emissiveIntensity={0.45}
              roughness={0.30}
              metalness={0.05}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* =====================================================
   DRAG SURFACE

   KEY FIX FOR THE "MOVES AWAY FROM MOUSE" BUG:
   after pointer-down, this invisible surface is placed
   physically above every component. Pointer-move events
   therefore always use the same board ray/plane rather
   than jumping between component meshes.
===================================================== */

function DragSurface({ onMove, onEnd }) {
  return (
    <mesh
      position={[0, 0.75, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={999}
      onPointerMove={(event) => {
        event.stopPropagation();
        onMove(event);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        onEnd(event);
      }}
    >
      <planeGeometry args={[9.90, 4.94]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
        depthTest={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function WireSurface({ onPointerDown, onPointerMove }) {
  return (
    <mesh
      position={[0, 0.072, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={2000}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
    >
      <planeGeometry args={[9.95, 4.98]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
        depthTest={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}


/* =====================================================
   CIRCUIT ANALYSIS ENGINE
   Type 1 = independent sources + resistors only.
   Dependent-source circuits are detected separately so
   the UI can require the proper test-source method.
===================================================== */

const DEFAULT_RESISTANCE = 10;
const DEFAULT_LOAD_RESISTANCE = 100;
const DEFAULT_VOLTAGE = 12;
const DEFAULT_CURRENT = 2;
const DEFAULT_DEPENDENT_GAIN = 2;

function nearestHoleData(point) {
  const column = THREE.MathUtils.clamp(
    Math.round((point.x - X_MIN) / X_PITCH),
    0,
    COLUMN_COUNT - 1,
  );

  let bestRowIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < SIGNAL_ROWS.length; i += 1) {
    const d = Math.abs(point.z - SIGNAL_ROWS[i]);
    if (d < bestDistance) {
      bestDistance = d;
      bestRowIndex = i;
    }
  }

  return {
    column,
    rowIndex: bestRowIndex,
    x: X_MIN + column * X_PITCH,
    z: SIGNAL_ROWS[bestRowIndex],
  };
}

function breadboardNodeKey(point) {
  const hole = nearestHoleData(new THREE.Vector3(point[0], BOARD_Y, point[2]));
  // Standard breadboard behavior: five holes above the center gap share one
  // conductive strip, and five holes below the gap share another.
  const side = hole.rowIndex < 5 ? "A" : "B";
  return `${side}:${hole.column}`;
}

class DisjointSet {
  constructor() {
    this.parent = new Map();
  }

  add(x) {
    if (!this.parent.has(x)) this.parent.set(x, x);
  }

  find(x) {
    this.add(x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    while (this.parent.get(x) !== x) {
      const next = this.parent.get(x);
      this.parent.set(x, root);
      x = next;
    }
    return root;
  }

  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

function componentTerminalPoints(component) {
  if (
    component.type === COMPONENT_TYPES.VCVS ||
    component.type === COMPONENT_TYPES.VCCS ||
    component.type === COMPONENT_TYPES.CCVS ||
    component.type === COMPONENT_TYPES.CCCS
  ) {
    return dependentTerminalPositions(component.position, component.rotation || 0);
  }

  if (
    component.type === COMPONENT_TYPES.RESISTOR ||
    component.type === COMPONENT_TYPES.LOAD ||
    component.type === COMPONENT_TYPES.VOLTAGE ||
    component.type === COMPONENT_TYPES.CURRENT
  ) {
    return terminalPositions(component.position, component.type, component.rotation || 0);
  }

  return [];
}

function getComponentResistance(component) {
  return Number(component.resistance ?? (
    component.type === COMPONENT_TYPES.LOAD
      ? DEFAULT_LOAD_RESISTANCE
      : DEFAULT_RESISTANCE
  ));
}

function getComponentVoltage(component) {
  return Number(component.voltage ?? DEFAULT_VOLTAGE);
}

function getComponentCurrent(component) {
  return Number(component.current ?? DEFAULT_CURRENT);
}

function getDependentGain(component) {
  return Number(component.gain ?? DEFAULT_DEPENDENT_GAIN);
}

function getDependentControlType(component) {
  return component.controlType ?? (
    component.type === COMPONENT_TYPES.VCVS || component.type === COMPONENT_TYPES.VCCS
      ? "voltage"
      : "current"
  );
}

function createTopology(components, wires, sourcesDeactivated, excludedIds = new Set()) {
  const dsu = new DisjointSet();
  const registerPoint = (point) => {
    const key = breadboardNodeKey(point);
    dsu.add(key);
    return key;
  };

  wires.forEach((wire) => {
    const a = registerPoint(wire.start);
    const b = registerPoint(wire.end);
    dsu.union(a, b);
  });

  components.forEach((component) => {
    if (excludedIds.has(component.id)) return;
    const points = componentTerminalPoints(component);
    points.forEach(registerPoint);

    if (
      sourcesDeactivated &&
      component.type === COMPONENT_TYPES.VOLTAGE &&
      points.length === 2
    ) {
      // 0 V independent source = ideal short.
      dsu.union(registerPoint(points[0]), registerPoint(points[1]));
    }
  });

  const rootOfPoint = (point) => dsu.find(breadboardNodeKey(point));

  return { dsu, rootOfPoint, registerPoint };
}

function reachableRoots(edges, start) {
  const graph = new Map();
  const addEdge = (a, b) => {
    if (a == null || b == null) return;
    if (!graph.has(a)) graph.set(a, []);
    if (!graph.has(b)) graph.set(b, []);
    graph.get(a).push(b);
    graph.get(b).push(a);
  };
  edges.forEach((edge) => addEdge(edge.a, edge.b));

  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const node = queue.shift();
    for (const next of graph.get(node) || []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

function solveLinearSystem(matrix, rhs) {
  const n = matrix.length;
  if (!n) return [];
  const a = matrix.map((row, i) => [...row, rhs[i]]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    let max = Math.abs(a[col][col]);
    for (let r = col + 1; r < n; r += 1) {
      const value = Math.abs(a[r][col]);
      if (value > max) {
        max = value;
        pivot = r;
      }
    }

    if (max < 1e-10) return null;

    if (pivot !== col) {
      const tmp = a[col];
      a[col] = a[pivot];
      a[pivot] = tmp;
    }

    for (let r = col + 1; r < n; r += 1) {
      const factor = a[r][col] / a[col][col];
      if (Math.abs(factor) < 1e-14) continue;
      for (let c = col; c <= n; c += 1) {
        a[r][c] -= factor * a[col][c];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    let sum = a[i][n];
    for (let j = i + 1; j < n; j += 1) sum -= a[i][j] * x[j];
    x[i] = sum / a[i][i];
  }
  return x;
}

function solveCircuitVoltage({
  components,
  wires,
  terminals,
  sourcesDeactivated,
  testCurrent = null,
}) {
  const excludedIds = new Set(
    components
      .filter((component) =>
        component.type === COMPONENT_TYPES.LOAD ||
        component.type === COMPONENT_TYPES.VOLTMETER ||
        component.type === COMPONENT_TYPES.AMMETER
      )
      .map((component) => component.id),
  );

  const topology = createTopology(
    components,
    wires,
    sourcesDeactivated,
    excludedIds,
  );

  const hasDependent = components.some((component) =>
    [
      COMPONENT_TYPES.VCVS,
      COMPONENT_TYPES.VCCS,
      COMPONENT_TYPES.CCVS,
      COMPONENT_TYPES.CCCS,
    ].includes(component.type)
  );

  const positiveRoot = topology.rootOfPoint(terminals[0]);
  const negativeRoot = topology.rootOfPoint(terminals[1]);

  const connectionEdges = [];
  const resistors = [];
  const voltageSources = [];
  const currentSources = [];

  components.forEach((component) => {
    if (excludedIds.has(component.id)) return;
    const points = componentTerminalPoints(component);
    if (points.length < 2) return;
    const a = topology.rootOfPoint(points[0]);
    const b = topology.rootOfPoint(points[1]);
    if (a === b) return;

    if (
      component.type === COMPONENT_TYPES.RESISTOR ||
      component.type === COMPONENT_TYPES.LOAD
    ) {
      resistors.push({
        a,
        b,
        r: Math.max(1e-9, getComponentResistance(component)),
        label: component.type === COMPONENT_TYPES.LOAD ? "RL" : `R${resistors.length + 1}`,
      });
      connectionEdges.push({ a, b });
    } else if (component.type === COMPONENT_TYPES.VOLTAGE) {
      if (!sourcesDeactivated) {
        voltageSources.push({ a, b, value: getComponentVoltage(component), label: `Vs${voltageSources.length + 1}` });
        connectionEdges.push({ a, b });
      }
    } else if (component.type === COMPONENT_TYPES.CURRENT) {
      if (!sourcesDeactivated) {
        currentSources.push({ a, b, value: getComponentCurrent(component), label: `Is${currentSources.length + 1}` });
        connectionEdges.push({ a, b });
      }
    }
  });

  if (testCurrent) {
    connectionEdges.push({ a: positiveRoot, b: negativeRoot });
  }

  const reachable = reachableRoots(connectionEdges, negativeRoot);
  if (!reachable.has(positiveRoot)) {
    return {
      ok: false,
      error: "The two load terminals are electrically disconnected.",
      hasDependent,
    };
  }

  const unknownRoots = [...reachable].filter((root) => root !== negativeRoot);
  const nodeIndex = new Map(unknownRoots.map((root, index) => [root, index]));
  const size = unknownRoots.length + voltageSources.length;

  if (size === 0) {
    return { ok: true, value: 0, hasDependent };
  }

  const matrix = Array.from({ length: size }, () => new Array(size).fill(0));
  const rhs = new Array(size).fill(0);

  const addConductance = (a, b, g) => {
    if (a !== negativeRoot && nodeIndex.has(a)) {
      const i = nodeIndex.get(a);
      matrix[i][i] += g;
    }
    if (b !== negativeRoot && nodeIndex.has(b)) {
      const j = nodeIndex.get(b);
      matrix[j][j] += g;
    }
    if (a !== negativeRoot && b !== negativeRoot && nodeIndex.has(a) && nodeIndex.has(b)) {
      const i = nodeIndex.get(a);
      const j = nodeIndex.get(b);
      matrix[i][j] -= g;
      matrix[j][i] -= g;
    }
  };

  const addCurrent = (from, to, current) => {
    if (from !== negativeRoot && nodeIndex.has(from)) rhs[nodeIndex.get(from)] -= current;
    if (to !== negativeRoot && nodeIndex.has(to)) rhs[nodeIndex.get(to)] += current;
  };

  resistors.forEach((resistor) => {
    if (!reachable.has(resistor.a) || !reachable.has(resistor.b)) return;
    addConductance(resistor.a, resistor.b, 1 / resistor.r);
  });

  if (!sourcesDeactivated) {
    currentSources.forEach((source) => addCurrent(source.a, source.b, source.value));
  }

  if (testCurrent) addCurrent(positiveRoot, negativeRoot, testCurrent);

  voltageSources.forEach((source, index) => {
    const k = unknownRoots.length + index;
    if (source.a !== negativeRoot && nodeIndex.has(source.a)) {
      const i = nodeIndex.get(source.a);
      matrix[i][k] += 1;
      matrix[k][i] += 1;
    }
    if (source.b !== negativeRoot && nodeIndex.has(source.b)) {
      const j = nodeIndex.get(source.b);
      matrix[j][k] -= 1;
      matrix[k][j] -= 1;
    }
    rhs[k] += source.value;
  });

  const solution = solveLinearSystem(matrix, rhs);
  if (!solution) {
    return {
      ok: false,
      error: "The circuit is floating or does not have a solvable DC operating point.",
      hasDependent,
    };
  }

  const positiveVoltage = positiveRoot === negativeRoot
    ? 0
    : solution[nodeIndex.get(positiveRoot)];

  return {
    ok: true,
    value: Number.isFinite(positiveVoltage) ? positiveVoltage : 0,
    hasDependent,
  };
}

function pruneDanglingEdges(edges, terminalA, terminalB) {
  let current = [...edges];
  let changed = true;

  while (changed) {
    changed = false;
    const degree = new Map();
    current.forEach((edge) => {
      degree.set(edge.a, (degree.get(edge.a) || 0) + 1);
      degree.set(edge.b, (degree.get(edge.b) || 0) + 1);
    });

    const removableNodes = [...degree.keys()].filter(
      (node) => degree.get(node) === 1 && node !== terminalA && node !== terminalB
    );

    if (!removableNodes.length) break;
    current = current.filter(
      (edge) => !removableNodes.includes(edge.a) && !removableNodes.includes(edge.b)
    );
    changed = true;
  }

  return current;
}

function reduceSeriesParallelResistors({ components, wires, terminals }) {
  const topology = createTopology(components, wires, true, new Set(
    components
      .filter((component) =>
        [COMPONENT_TYPES.LOAD, COMPONENT_TYPES.VOLTMETER, COMPONENT_TYPES.AMMETER].includes(component.type)
      )
      .map((component) => component.id),
  ));

  const terminalA = topology.rootOfPoint(terminals[0]);
  const terminalB = topology.rootOfPoint(terminals[1]);

  if (terminalA === terminalB) {
    return { ok: true, value: 0, steps: ["A direct short exists between the two terminals → Rth = 0 Ω."] };
  }

  let edgeIndex = 0;
  let edges = [];
  components.forEach((component) => {
    if (component.type !== COMPONENT_TYPES.RESISTOR) return;
    const points = componentTerminalPoints(component);
    const a = topology.rootOfPoint(points[0]);
    const b = topology.rootOfPoint(points[1]);
    if (a === b) return;
    edges.push({
      id: `e${edgeIndex++}`,
      a,
      b,
      r: getComponentResistance(component),
      label: `R${edges.length + 1}`,
    });
  });

  edges = pruneDanglingEdges(edges, terminalA, terminalB);
  const steps = [];
  let guard = 0;

  const pairKey = (a, b) => [a, b].sort().join("|");

  while (guard < 500) {
    guard += 1;
    let changed = false;

    // Parallel reduction.
    const groups = new Map();
    edges.forEach((edge) => {
      const key = pairKey(edge.a, edge.b);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(edge);
    });

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const rEq = 1 / group.reduce((sum, edge) => sum + 1 / edge.r, 0);
      const keepA = group[0].a;
      const keepB = group[0].b;
      const label = `(${group.map((edge) => edge.label).join(" || ")})`;
      edges = edges.filter((edge) => !group.includes(edge));
      edges.push({
        id: `e${edgeIndex++}`,
        a: keepA,
        b: keepB,
        r: rEq,
        label,
      });
      steps.push(`Parallel: ${group.map((edge) => edge.label).join(" || ")} = ${rEq.toFixed(2)} Ω`);
      changed = true;
      break;
    }

    if (changed) continue;

    // Series reduction at any non-terminal node with degree 2.
    const degree = new Map();
    edges.forEach((edge) => {
      degree.set(edge.a, (degree.get(edge.a) || 0) + 1);
      degree.set(edge.b, (degree.get(edge.b) || 0) + 1);
    });

    const seriesNode = [...degree.keys()].find(
      (node) => degree.get(node) === 2 && node !== terminalA && node !== terminalB
    );

    if (seriesNode == null) break;

    const connected = edges.filter(
      (edge) => edge.a === seriesNode || edge.b === seriesNode
    );
    const e1 = connected[0];
    const e2 = connected[1];
    const other1 = e1.a === seriesNode ? e1.b : e1.a;
    const other2 = e2.a === seriesNode ? e2.b : e2.a;

    if (other1 === other2) break;

    const rEq = e1.r + e2.r;
    edges = edges.filter((edge) => edge !== e1 && edge !== e2);
    edges.push({
      id: `e${edgeIndex++}`,
      a: other1,
      b: other2,
      r: rEq,
      label: `(${e1.label} + ${e2.label})`,
    });
    steps.push(`Series: ${e1.label} + ${e2.label} = ${rEq.toFixed(2)} Ω`);
    changed = true;

    if (!changed) break;
  }

  edges = pruneDanglingEdges(edges, terminalA, terminalB);
  if (
    edges.length === 1 &&
    ((edges[0].a === terminalA && edges[0].b === terminalB) ||
      (edges[0].a === terminalB && edges[0].b === terminalA))
  ) {
    return { ok: true, value: edges[0].r, steps };
  }

  return { ok: false, value: null, steps };
}

function calculateRth({ components, wires, terminals }) {
  const hasDependent = components.some((component) =>
    [
      COMPONENT_TYPES.VCVS,
      COMPONENT_TYPES.VCCS,
      COMPONENT_TYPES.CCVS,
      COMPONENT_TYPES.CCCS,
    ].includes(component.type)
  );

  if (hasDependent) {
    return {
      ok: false,
      dependent: true,
      message: "A dependent source is present. Type 2 circuits require the test-source method; independent sources are deactivated, but dependent sources remain active.",
    };
  }

  const reduced = reduceSeriesParallelResistors({ components, wires, terminals });
  const solved = solveCircuitVoltage({
    components,
    wires,
    terminals,
    sourcesDeactivated: true,
    testCurrent: 1,
  });

  if (!solved.ok) {
    return {
      ok: false,
      dependent: false,
      message: solved.error,
      steps: reduced.steps || [],
    };
  }

  const value = Math.abs(solved.value);
  return {
    ok: true,
    value,
    steps:
      reduced.ok
        ? reduced.steps
        : [...(reduced.steps || []), "Series/parallel reduction is not sufficient for this topology; a 1 A test-source calculation was used."],
    method: reduced.ok ? "series-parallel" : "1 A test source",
  };
}

function calculateVth({ components, wires, terminals }) {
  const result = solveCircuitVoltage({
    components,
    wires,
    terminals,
    sourcesDeactivated: false,
  });

  if (result.hasDependent) {
    return {
      ok: false,
      dependent: true,
      message: "A dependent source is present. Type 2 Vth calculation will use the complete dependent-source model once source-control values are configured.",
    };
  }

  if (!result.ok) return result;

  return { ok: true, value: result.value };
}

function formatOhms(value) {
  if (value === Infinity) return "∞ Ω";
  return `${Number(value).toFixed(2)} Ω`;
}

function formatVolts(value) {
  return `${Number(value).toFixed(3)} V`;
}

/* =====================================================
   3D ANALYSIS INDICATORS
===================================================== */

function OpenTerminalMarker({ point, label, color = "#ff6b6b" }) {
  return (
    <group position={[point[0], 0, point[2]]} renderOrder={120}>
      <mesh position={[0, 0.060, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.070, 0.012, 12, 28]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 0.020, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.15, 12]} />
        <meshStandardMaterial color="#c9cfd5" metalness={0.82} roughness={0.18} />
      </mesh>
      <Text
        position={[0, 0.16, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.075}
        anchorX="center"
        anchorY="middle"
        color={color}
      >
        {label}
      </Text>
    </group>
  );
}

function AnalysisVoltmeter({ terminals, value }) {
  if (!terminals || terminals.length < 2) return null;

  const meterPos = [-3.65, 0.30, -1.93];
  const leadStartA = [meterPos[0] - 0.18, 0.105, meterPos[2] + 0.03];
  const leadStartB = [meterPos[0] + 0.18, 0.105, meterPos[2] + 0.03];

  const lead = (start, end, color) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(...start),
      new THREE.Vector3(start[0], 0.32, (start[2] + end[2]) / 2),
      new THREE.Vector3(end[0], 0.18, end[2]),
      new THREE.Vector3(...end),
    ]);
    return (
      <mesh key={`${color}-${end[0]}-${end[2]}`} renderOrder={96}>
        <tubeGeometry args={[curve, 34, 0.020, 10, false]} />
        <meshStandardMaterial color={color} roughness={0.36} metalness={0.20} />
      </mesh>
    );
  };

  return (
    <group renderOrder={95}>
      {lead(leadStartA, [terminals[0][0], 0.118, terminals[0][2]], "#c83232")}
      {lead(leadStartB, [terminals[1][0], 0.118, terminals[1][2]], "#171717")}
      <WirePlug point={terminals[0]} color="#c83232" />
      <WirePlug point={terminals[1]} color="#171717" />

      <group position={meterPos}>
        <mesh castShadow>
          <boxGeometry args={[0.82, 0.36, 0.52]} />
          <meshStandardMaterial color="#2c3339" roughness={0.32} metalness={0.24} />
        </mesh>
        <mesh position={[0, 0.20, 0]}>
          <boxGeometry args={[0.46, 0.09, 0.19]} />
          <meshStandardMaterial color="#1a2025" roughness={0.22} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0.205, 0.005]}>
          <boxGeometry args={[0.38, 0.055, 0.14]} />
          <meshStandardMaterial color="#87c6a6" emissive="#2e5744" emissiveIntensity={0.75} />
        </mesh>
        <Text
          position={[0, 0.236, 0.018]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.070}
          anchorX="center"
          anchorY="middle"
          color="#07100d"
        >
          {formatVolts(value)}
        </Text>
        <Text
          position={[0, 0.0, -0.27]}
          rotation={[0, 0, 0]}
          fontSize={0.085}
          anchorX="center"
          anchorY="middle"
          color="#f3f5f7"
        >
          VTH VOLTMETER
        </Text>
        <mesh position={[-0.19, 0.02, 0.27]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.028, 18]} />
          <meshStandardMaterial color="#cb3138" metalness={0.58} roughness={0.22} />
        </mesh>
        <mesh position={[0.19, 0.02, 0.27]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.028, 18]} />
          <meshStandardMaterial color="#17191b" metalness={0.58} roughness={0.22} />
        </mesh>
      </group>
    </group>
  );
}

/* =====================================================
   CREATE CIRCUIT
===================================================== */

export default function CreateCircuit() {
  const [components, setComponents] = useState([]);
  const [showComponentMenu, setShowComponentMenu] = useState(false);
  const [showDependentMenu, setShowDependentMenu] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [draggingComponent, setDraggingComponent] = useState(null);
  const [wireMode, setWireMode] = useState(false);
  const [wireStart, setWireStart] = useState(null);
  const [wirePreviewEnd, setWirePreviewEnd] = useState(null);
  const [wires, setWires] = useState([]);
  const [wireCursor, setWireCursor] = useState({ x: 0, y: 0 });
  const [selectedWire, setSelectedWire] = useState(null);
  const [sourcesDeactivated, setSourcesDeactivated] = useState(false);
  const [analysisPanel, setAnalysisPanel] = useState(null);
  const [analysisMode, setAnalysisMode] = useState(null);
  const [analysisTerminals, setAnalysisTerminals] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  const dragOffsetRef = useRef(new THREE.Vector3());
  const lastDragPointRef = useRef(null);
  const draggingTypeRef = useRef(null);
  const draggingComponentRef = useRef(null);
  const wirePreviewEndRef = useRef(null);
  const wireStartRef = useRef(null);
  const finishDragRef = useRef(null);
  const commitWireRef = useRef(null);
  const historyRef = useRef([]);

  const cloneState = () => ({
    components: JSON.parse(JSON.stringify(components)),
    wires: JSON.parse(JSON.stringify(wires)),
    sourcesDeactivated,
    selectedComponent,
    selectedWire,
    analysisPanel,
    analysisMode,
    analysisTerminals: analysisTerminals ? JSON.parse(JSON.stringify(analysisTerminals)) : null,
    analysisResult: analysisResult ? JSON.parse(JSON.stringify(analysisResult)) : null,
  });

  const recordHistory = () => {
    historyRef.current.push(cloneState());
    if (historyRef.current.length > 50) historyRef.current.shift();
  };

  const undoLastAction = () => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    setComponents(previous.components);
    setWires(previous.wires);
    setSourcesDeactivated(previous.sourcesDeactivated);
    setSelectedComponent(previous.selectedComponent);
    setSelectedWire(previous.selectedWire);
    setAnalysisPanel(previous.analysisPanel);
    setAnalysisMode(previous.analysisMode);
    setAnalysisTerminals(previous.analysisTerminals);
    setAnalysisResult(previous.analysisResult);
    setDraggingComponent(null);
    draggingComponentRef.current = null;
    setWireStart(null);
    setWirePreviewEnd(null);
    wireStartRef.current = null;
    wirePreviewEndRef.current = null;
  };

  useEffect(() => {
    draggingComponentRef.current = draggingComponent;
  }, [draggingComponent]);

  useEffect(() => {
    wirePreviewEndRef.current = wirePreviewEnd;
  }, [wirePreviewEnd]);

  useEffect(() => {
    wireStartRef.current = wireStart;
  }, [wireStart]);

  const addComponent = (type) => {
    recordHistory();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const sameTypeCount = components.filter(
      (item) => item.type === type
    ).length;

    const seedColumn = [4, 10, 16, 20, 8, 14, 23][sameTypeCount % 7];
    const seedRow = [2, 4, 6, 3, 7, 1, 5][sameTypeCount % 7];

    const roughPoint = new THREE.Vector3(
      X_MIN + seedColumn * X_PITCH,
      BOARD_Y,
      SIGNAL_ROWS[seedRow]
    );

    const snapped = snapComponent(roughPoint, type, 0);

    setComponents((previous) => [
      ...previous,
      {
        id,
        type,
        position: [snapped.x, 0, snapped.z],
        rotation: 0,
        resistance:
          type === COMPONENT_TYPES.LOAD
            ? DEFAULT_LOAD_RESISTANCE
            : type === COMPONENT_TYPES.RESISTOR
              ? DEFAULT_RESISTANCE
              : undefined,
        voltage: type === COMPONENT_TYPES.VOLTAGE ? DEFAULT_VOLTAGE : undefined,
        current: type === COMPONENT_TYPES.CURRENT ? DEFAULT_CURRENT : undefined,
        gain: [
          COMPONENT_TYPES.VCVS,
          COMPONENT_TYPES.VCCS,
          COMPONENT_TYPES.CCVS,
          COMPONENT_TYPES.CCCS,
        ].includes(type)
          ? DEFAULT_DEPENDENT_GAIN
          : undefined,
        controlType: [
          COMPONENT_TYPES.VCVS,
          COMPONENT_TYPES.VCCS,
        ].includes(type)
          ? "voltage"
          : [
              COMPONENT_TYPES.CCVS,
              COMPONENT_TYPES.CCCS,
            ].includes(type)
            ? "current"
            : undefined,
        controlReference: [
          COMPONENT_TYPES.VCVS,
          COMPONENT_TYPES.VCCS,
          COMPONENT_TYPES.CCVS,
          COMPONENT_TYPES.CCCS,
        ].includes(type)
          ? ""
          : undefined,
        polarity: [
          COMPONENT_TYPES.VCVS,
          COMPONENT_TYPES.VCCS,
          COMPONENT_TYPES.CCVS,
          COMPONENT_TYPES.CCCS,
        ].includes(type)
          ? 1
          : undefined,
      },
    ]);

    setSelectedComponent(id);
    setSelectedWire(null);
    setAnalysisPanel(null);
    setShowComponentMenu(false);
    setShowDependentMenu(false);
  };

  const addResistor = () => addComponent(COMPONENT_TYPES.RESISTOR);
  const addLoadResistor = () => addComponent(COMPONENT_TYPES.LOAD);
  const addVoltageSource = () => addComponent(COMPONENT_TYPES.VOLTAGE);
  const addCurrentSource = () => addComponent(COMPONENT_TYPES.CURRENT);
  const addVoltmeter = () => addComponent(COMPONENT_TYPES.VOLTMETER);
  const addAmmeter = () => addComponent(COMPONENT_TYPES.AMMETER);

  const startDrag = (event, component) => {
    if (wireMode) return;
    recordHistory();

    const point = boardPointFromEvent(event);
    if (!point) return;

    const current = new THREE.Vector3(...component.position);

    // Preserve the exact mouse-to-component offset. No release snap is used.
    dragOffsetRef.current.copy(current).sub(point);
    lastDragPointRef.current = point.clone();
    draggingTypeRef.current = component.type;

    setSelectedComponent(component.id);
    setSelectedWire(null);
    setAnalysisPanel(null);
    setDraggingComponent(component.id);
    draggingComponentRef.current = component.id;
    document.body.style.cursor = "grabbing";
  };

  const moveDraggingComponent = (event) => {
    if (!draggingComponentRef.current) return;
    const point = boardPointFromEvent(event);
    if (!point) return;

    lastDragPointRef.current = point.clone();
    const draggingType = draggingTypeRef.current || COMPONENT_TYPES.RESISTOR;
    const draggingComponentData = components.find((component) => component.id === draggingComponentRef.current);
    const rotation = draggingComponentData?.rotation || 0;
    const desired = point.clone().add(dragOffsetRef.current);
    const clamped = clampComponentPosition(desired, draggingType, rotation);

    setComponents((previous) => previous.map((component) =>
      component.id === draggingComponentRef.current
        ? { ...component, position: [clamped.x, 0, clamped.z] }
        : component
    ));
  };

  const finishDrag = () => {
    if (!draggingComponentRef.current) return;
    const id = draggingComponentRef.current;
    const current = components.find((component) => component.id === id);

    /*
       Do NOT forcibly move the component to a distant grid location on
       mouse-up. That was the source of the "I release it here, but it jumps
       somewhere else" behaviour.

       We only apply magnetic hole snapping when the final component center is
       already very close to a valid hole-pair position. This keeps placement
       1:1 with the user's drag while still giving a small physical breadboard
       snap when the user intentionally drops near a hole.
    */
    if (current) {
      const currentPoint = new THREE.Vector3(
        current.position[0],
        BOARD_Y,
        current.position[2],
      );

      const snapped = snapComponent(
        currentPoint,
        current.type,
        current.rotation || 0,
      );

      const dx = snapped.x - currentPoint.x;
      const dz = snapped.z - currentPoint.z;
      const snapDistance = Math.hypot(dx, dz);
      const SNAP_THRESHOLD = 0.14;

      if (snapDistance <= SNAP_THRESHOLD) {
        setComponents((previous) => previous.map((component) =>
          component.id === id
            ? { ...component, position: [snapped.x, 0, snapped.z] }
            : component
        ));
      }
    }

    setDraggingComponent(null);
    draggingComponentRef.current = null;
    draggingTypeRef.current = null;
    lastDragPointRef.current = null;
    document.body.style.cursor = "default";
  };

  const boardHoleFromPoint = (point) => {
    const column = THREE.MathUtils.clamp(
      Math.round((point.x - X_MIN) / X_PITCH),
      0,
      COLUMN_COUNT - 1
    );

    let bestRowIndex = 0;
    let bestRowDistance = Infinity;
    for (let i = 0; i < SIGNAL_ROWS.length; i += 1) {
      const distance = Math.abs(point.z - SIGNAL_ROWS[i]);
      if (distance < bestRowDistance) {
        bestRowDistance = distance;
        bestRowIndex = i;
      }
    }

    return [X_MIN + column * X_PITCH, BOARD_Y, SIGNAL_ROWS[bestRowIndex]];
  };

  const updateWirePreviewFromEvent = (event) => {
    if (!wireMode) return;
    const point = boardPointFromEvent(event);
    if (!point) return;

    const hole = boardHoleFromPoint(point);
    setWirePreviewEnd(hole);
    wirePreviewEndRef.current = hole;
  };

  const handleBoardWirePoint = (point) => {
    if (!wireMode) return;
    const hole = boardHoleFromPoint(point);

    if (!wireStartRef.current) {
      setWireStart(hole);
      wireStartRef.current = hole;
      setWirePreviewEnd(hole);
      wirePreviewEndRef.current = hole;
      return;
    }

    setWirePreviewEnd(hole);
    wirePreviewEndRef.current = hole;
  };

  const handleWirePointerMove = (event) => {
    if (!wireMode) return;
    event.stopPropagation();
    updateWirePreviewFromEvent(event);
  };

  const handleWirePointerDown = (event) => {
    if (!wireMode) return;
    event.stopPropagation();

    const point = boardPointFromEvent(event);
    if (!point) return;
    handleBoardWirePoint(point);
  };

  const handleTerminalClick = (terminal) => {
    if (!wireMode) return;

    const point = new THREE.Vector3(terminal[0], BOARD_Y, terminal[2]);
    const hole = boardHoleFromPoint(point);

    if (!wireStartRef.current) {
      setWireStart(hole);
      wireStartRef.current = hole;
      setWirePreviewEnd(hole);
      wirePreviewEndRef.current = hole;
      return;
    }

    setWirePreviewEnd(hole);
    wirePreviewEndRef.current = hole;
  };

  const commitWire = () => {
    if (!wireMode) return;
    const startPoint = wireStartRef.current;
    const endPoint = wirePreviewEndRef.current;

    if (!startPoint || !endPoint) return;
    if (
      Math.abs(startPoint[0] - endPoint[0]) < 0.0001 &&
      Math.abs(startPoint[2] - endPoint[2]) < 0.0001
    ) {
      return;
    }

    recordHistory();
    setWires((previous) => [
      ...previous,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        start: [...startPoint],
        end: [...endPoint],
        color: WIRE_COLORS[previous.length % WIRE_COLORS.length],
      },
    ]);

    setSelectedWire(null);
    setSelectedComponent(null);
    setWireStart(null);
    setWirePreviewEnd(null);
    wireStartRef.current = null;
    wirePreviewEndRef.current = null;
  };

  const deleteSelected = () => {
    if (selectedWire) {
      recordHistory();
      setWires((previous) =>
        previous.filter((wire) => wire.id !== selectedWire)
      );
      setSelectedWire(null);
      return;
    }

    if (!selectedComponent) return;

    recordHistory();
    const selected = components.find((component) => component.id === selectedComponent);
    if (selected?.type === COMPONENT_TYPES.LOAD) {
      const terminals = terminalPositions(
        selected.position,
        COMPONENT_TYPES.LOAD,
        selected.rotation || 0,
      ).map((terminal) =>
        boardHoleFromPoint(new THREE.Vector3(terminal[0], BOARD_Y, terminal[2]))
      );
      setAnalysisTerminals(terminals);
      setAnalysisMode("open");
      setAnalysisResult(null);
    }

    setComponents((previous) =>
      previous.filter((component) => component.id !== selectedComponent)
    );

    setSelectedComponent(null);
  };

  const nearestWireHoleDistance = (wirePoint, targetPoint) => {
    if (!wirePoint || !targetPoint) return Infinity;
    return Math.hypot(
      wirePoint[0] - targetPoint[0],
      wirePoint[2] - targetPoint[2]
    );
  };

  const prepareOpenCircuit = () => {
    let terminals = analysisTerminals ? analysisTerminals.map((point) => [...point]) : null;
    let nextComponents = components;
    let nextWires = wires;

    const loads = components.filter(
      (component) => component.type === COMPONENT_TYPES.LOAD
    );

    if (loads.length) {
      const load = loads[0];
      terminals = terminalPositions(
        load.position,
        COMPONENT_TYPES.LOAD,
        load.rotation || 0,
      ).map((terminal) =>
        boardHoleFromPoint(new THREE.Vector3(terminal[0], BOARD_Y, terminal[2]))
      );

      const loadPorts = terminals.map((point) => [...point]);
      nextComponents = components.filter(
        (component) => component.type !== COMPONENT_TYPES.LOAD
      );
      nextWires = wires.filter((wire) =>
        !loadPorts.some((port) =>
          nearestWireHoleDistance(wire.start, port) < X_PITCH * 0.55 ||
          nearestWireHoleDistance(wire.end, port) < X_PITCH * 0.55
        )
      );
    }

    return { terminals, nextComponents, nextWires };
  };

  const removeLoad = () => {
    recordHistory();
    const prepared = prepareOpenCircuit();
    if (!prepared.terminals) {
      setAnalysisPanel({
        title: "Remove Load",
        message: "No Load Resistor is currently placed in the circuit.",
      });
      return;
    }

    setAnalysisTerminals(prepared.terminals);
    setComponents(prepared.nextComponents);
    setWires(prepared.nextWires);
    setSelectedComponent(null);
    setSelectedWire(null);
    setAnalysisMode("open");
    setAnalysisResult(null);
    setAnalysisPanel({
      title: "Load Removed",
      message: "The load is now open. The two marked terminals are the exact terminals from which Vth and Rth are determined.",
    });
  };

  const deactivateIndependentSources = () => {
    recordHistory();
    setSourcesDeactivated((previous) => {
      const next = !previous;
      if (next) {
        setAnalysisPanel({
          title: "Sources Deactivated",
          message: "Independent voltage sources are treated as shorts and independent current sources as opens. Dependent sources remain active.",
        });
      } else {
        setAnalysisPanel({
          title: "Sources Reactivated",
          message: "Independent voltage and current sources are active again. Dependent sources were unchanged.",
        });
      }
      return next;
    });
  };

  const findVth = () => {
    const prepared = prepareOpenCircuit();
    if (!prepared.terminals) {
      setAnalysisPanel({
        title: "Find Vth",
        message: "Place a Load Resistor first so the simulator knows which two terminals are the Thevenin output terminals.",
      });
      return;
    }

    const nextSourcesDeactivated = false;
    const result = calculateVth({
      components: prepared.nextComponents,
      wires: prepared.nextWires,
      terminals: prepared.terminals,
    });

    setComponents(prepared.nextComponents);
    setWires(prepared.nextWires);
    setAnalysisTerminals(prepared.terminals);
    setSourcesDeactivated(nextSourcesDeactivated);
    setAnalysisMode("vth");
    setAnalysisResult(result);

    if (result.ok) {
      setAnalysisPanel({
        title: "Vth Calculated",
        message: `Load is open, all independent sources are active again, and the voltmeter is placed across the exact two load terminals. Vth = ${formatVolts(result.value)}.`,
      });
    } else {
      setAnalysisPanel({
        title: "Vth Calculation",
        message: result.message || result.error || "Unable to calculate Vth for the current topology.",
      });
    }
  };

  const findRth = () => {
    const prepared = prepareOpenCircuit();
    if (!prepared.terminals) {
      setAnalysisPanel({
        title: "Find Rth",
        message: "Place a Load Resistor first so the simulator can identify the two terminals from which Rth is viewed.",
      });
      return;
    }

    setSourcesDeactivated(true);

    const result = calculateRth({
      components: prepared.nextComponents,
      wires: prepared.nextWires,
      terminals: prepared.terminals,
    });

    setComponents(prepared.nextComponents);
    setWires(prepared.nextWires);
    setAnalysisTerminals(prepared.terminals);
    setAnalysisMode("rth");
    setAnalysisResult(result);

    if (result.ok) {
      setAnalysisPanel({
        title: "Rth Calculated",
        message: `All independent voltage sources are shorted, independent current sources are opened, and the dependent-source rule is preserved. Rth = ${formatOhms(result.value)}.`,
      });
    } else {
      setAnalysisPanel({
        title: result.dependent ? "Type 2 Rth Circuit" : "Rth Calculation",
        message: result.message || "Unable to calculate Rth for the current topology.",
      });
    }
  };

  const updateSelectedComponentField = (field, value) => {
    if (!selectedComponent) return;

    setComponents((previous) =>
      previous.map((component) =>
        component.id === selectedComponent
          ? { ...component, [field]: value }
          : component
      )
    );
    setAnalysisPanel(null);
    setAnalysisResult(null);
  };

  const updateSelectedNumericField = (field, rawValue, fallback = 0) => {
    const parsed = Number(rawValue);
    updateSelectedComponentField(
      field,
      Number.isFinite(parsed) ? parsed : fallback
    );
  };

  const selectedComponentData = selectedComponent
    ? components.find((component) => component.id === selectedComponent)
    : null;

  const isDependentType = (type) =>
    [
      COMPONENT_TYPES.VCVS,
      COMPONENT_TYPES.VCCS,
      COMPONENT_TYPES.CCVS,
      COMPONENT_TYPES.CCCS,
    ].includes(type);

  const rotateSelectedComponent = (direction) => {
    if (!selectedComponent) return;
    recordHistory();
    setComponents((previous) =>
      previous.map((component) =>
        component.id === selectedComponent
          ? {
              ...component,
              rotation: THREE.MathUtils.euclideanModulo(
                (component.rotation || 0) + direction * (Math.PI / 2),
                Math.PI * 2,
              ),
            }
          : component
      )
    );
    setAnalysisPanel(null);
  };

  const resetAnalysis = () => {
    setAnalysisPanel(null);
  };

  finishDragRef.current = finishDrag;
  commitWireRef.current = commitWire;

  const resetCircuit = () => {
    recordHistory();
    setComponents([]);
    setWires([]);
    setSelectedComponent(null);
    setDraggingComponent(null);
    setWireMode(false);
    setWireStart(null);
    setWirePreviewEnd(null);
    setSelectedWire(null);
    setSourcesDeactivated(false);
    setAnalysisPanel(null);
    setAnalysisMode(null);
    setAnalysisTerminals(null);
    setAnalysisResult(null);
    wireStartRef.current = null;
    wirePreviewEndRef.current = null;
    setShowComponentMenu(false);
    setShowDependentMenu(false);
  };

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (draggingComponentRef.current) {
        finishDragRef.current?.();
      }
    };

    const handleWindowPointerMove = (event) => {
      if (wireMode) {
        setWireCursor({ x: event.clientX, y: event.clientY });
      }
    };

    const handleGlobalContextMenu = (event) => {
      if (!wireMode) return;
      event.preventDefault();
      commitWireRef.current?.();
    };

    const handleKeyDown = (event) => {
      const target = event.target;
      const editingField = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !editingField) {
        event.preventDefault();
        undoLastAction();
        return;
      }
      if (event.key === "Escape" && wireMode) {
        setWireStart(null);
        setWirePreviewEnd(null);
        wireStartRef.current = null;
        wirePreviewEndRef.current = null;
      }
    };

    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("contextmenu", handleGlobalContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("contextmenu", handleGlobalContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.cursor = "default";
    };
  }, [wireMode]);

  const toggleComponentMenu = () => {
    setShowComponentMenu((previous) => !previous);
    setShowDependentMenu(false);
  };

  const toggleDependentMenu = () => {
    setShowDependentMenu((previous) => !previous);
    setShowComponentMenu(false);
  };

  const selectedComponentName = (type) => {
    const names = {
      [COMPONENT_TYPES.RESISTOR]: "Resistor",
      [COMPONENT_TYPES.LOAD]: "Load Resistor",
      [COMPONENT_TYPES.VOLTAGE]: "DC Voltage Source",
      [COMPONENT_TYPES.CURRENT]: "DC Current Source",
      [COMPONENT_TYPES.VOLTMETER]: "Voltmeter",
      [COMPONENT_TYPES.AMMETER]: "Ammeter",
      [COMPONENT_TYPES.VCVS]: "VCVS",
      [COMPONENT_TYPES.VCCS]: "VCCS",
      [COMPONENT_TYPES.CCVS]: "CCVS",
      [COMPONENT_TYPES.CCCS]: "CCCS",
    };
    return names[type] || "Component";
  };

  return (
    <div
      className="circuit-page"
      style={{
        width: "100%",
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      <div className="circuit-toolbar">
        <button className="tool-btn" onClick={toggleComponentMenu}>
          <span className="tool-icon">🔧</span>
          <span>Components</span>
        </button>

        <button className="tool-btn" onClick={toggleDependentMenu}>
          <span className="tool-icon">⚡</span>
          <span>Dependent Sources</span>
        </button>

        <button className="tool-btn" onClick={deleteSelected}>
          <span className="tool-icon">🗑️</span>
          <span>{selectedWire ? "Delete Wire" : "Delete"}</span>
        </button>

        <button
          className="tool-btn"
          onClick={() => {
            setSelectedWire(null);
            setWireMode((previous) => {
              const next = !previous;
              if (!next) {
                setWireStart(null);
                setWirePreviewEnd(null);
                wireStartRef.current = null;
                wirePreviewEndRef.current = null;
              }
              return next;
            });
          }}
        >
          <span className="tool-icon">🔌</span>
          <span>{wireMode ? "Wire On" : "Wire"}</span>
        </button>

        <button className="tool-btn" onClick={removeLoad}>
          <span className="tool-icon">✂️</span>
          <span>Remove Load</span>
        </button>

        <button className="tool-btn" onClick={deactivateIndependentSources}>
          <span className="tool-icon">⛔</span>
          <span>{sourcesDeactivated ? "Reactivate" : "Deactivate"}</span>
        </button>

        <button className="tool-btn" onClick={findVth}>
          <span className="tool-icon">V</span>
          <span>Find Vth</span>
        </button>

        <button className="tool-btn" onClick={findRth}>
          <span className="tool-icon">R</span>
          <span>Find Rth</span>
        </button>

        <button className="tool-btn">
          <span className="tool-icon">⚙️</span>
          <span>Thevenin</span>
        </button>

        <button className="tool-btn">
          <span className="tool-icon">📊</span>
          <span>Data Table</span>
        </button>

        <button className="tool-btn" onClick={undoLastAction} disabled={historyRef.current.length === 0}>
          <span className="tool-icon">↶</span>
          <span>Undo</span>
        </button>

        <button className="tool-btn" onClick={resetCircuit}>
          <span className="tool-icon">🔄</span>
          <span>Reset</span>
        </button>
      </div>

      {showComponentMenu ? (
        <div
          style={{
            position: "absolute",
            top: "80px",
            left: "20px",
            zIndex: 110,
            width: "280px",
            padding: "6px 0",
            background: "rgba(15, 23, 42, 0.98)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "10px",
            boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              color: "#9ca3af",
              fontSize: "12px",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Components
          </div>
          <ComponentMenuButton icon="🟤" label="Resistor" onClick={addResistor} />
          <ComponentMenuButton icon="🔋" label="Voltage Source" onClick={addVoltageSource} />
          <ComponentMenuButton icon="⚡" label="Current Source" onClick={addCurrentSource} />
          <ComponentMenuButton icon="📟" label="Voltmeter" onClick={addVoltmeter} />
          <ComponentMenuButton icon="📟" label="Ammeter" onClick={addAmmeter} />
          <ComponentMenuButton icon="🟤" label="Load Resistor" onClick={addLoadResistor} />
        </div>
      ) : null}

      {showDependentMenu ? (
        <div
          style={{
            position: "absolute",
            top: "80px",
            left: "145px",
            zIndex: 110,
            width: "310px",
            padding: "6px 0",
            background: "rgba(15, 23, 42, 0.98)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "10px",
            boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              color: "#9ca3af",
              fontSize: "12px",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Dependent Sources
          </div>
          <ComponentMenuButton icon="▱" label="VCVS — Voltage Controlled Voltage Source" onClick={() => addComponent(COMPONENT_TYPES.VCVS)} />
          <ComponentMenuButton icon="▱" label="VCCS — Voltage Controlled Current Source" onClick={() => addComponent(COMPONENT_TYPES.VCCS)} />
          <ComponentMenuButton icon="▱" label="CCVS — Current Controlled Voltage Source" onClick={() => addComponent(COMPONENT_TYPES.CCVS)} />
          <ComponentMenuButton icon="▱" label="CCCS — Current Controlled Current Source" onClick={() => addComponent(COMPONENT_TYPES.CCCS)} />
        </div>
      ) : null}

      <div
        className="circuit-workspace"
        style={{
          flex: "1 1 auto",
          width: "100%",
          minWidth: 0,
          height: "calc(100vh - 266px)",
          minHeight: 520,
          marginLeft: 0,
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "stretch",
          overflow: "visible",
          cursor: wireMode ? "crosshair" : "default",
        }}
        onContextMenu={(event) => {
          if (wireMode) {
            event.preventDefault();
            commitWireRef.current?.();
          }
        }}
      >
        <Canvas
          shadows
          style={{ width: "100%", height: "100%", display: "block" }}
          camera={{
            position: [0, 7.2, 11.5],
            fov: 50,
          }}
        >
          <color attach="background" args={["#07101c"]} />

          <ambientLight intensity={1.35} />
          <directionalLight position={[5, 8, 5]} intensity={2.6} castShadow />
          <directionalLight position={[-5, 4, -5]} intensity={1.25} />

          <Breadboard />

          <BreadboardHoleStatus
            components={components}
            wires={wires}
          />

          {wires.map((wire) => (
            <Wire3D
              key={wire.id}
              start={wire.start}
              end={wire.end}
              color={wire.color || WIRE_COLORS[0]}
              selected={selectedWire === wire.id}
              onSelect={() => {
                if (wireMode) return;
                setSelectedWire(wire.id);
                setSelectedComponent(null);
                setAnalysisPanel(null);
              }}
            />
          ))}

          {wireMode && wireStart && wirePreviewEnd ? (
            <Wire3D
              start={wireStart}
              end={wirePreviewEnd}
              color="#7ab7ff"
              preview
            />
          ) : null}

          {wireMode && wirePreviewEnd ? (
            <group position={[wirePreviewEnd[0], BOARD_Y + 0.010, wirePreviewEnd[2]]} renderOrder={1900}>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.034, 0.043, 24]} />
                <meshBasicMaterial color="#d9f0ff" transparent opacity={0.72} depthWrite={false} />
              </mesh>
            </group>
          ) : null}

          {wireMode ? (
            <WireSurface
              onPointerDown={handleWirePointerDown}
              onPointerMove={handleWirePointerMove}
            />
          ) : null}

          {draggingComponent ? (
            <DragSurface onMove={moveDraggingComponent} onEnd={finishDrag} />
          ) : null}

          {components.map((component) => {
            const commonProps = {
              key: component.id,
              position: component.position,
              rotation: component.rotation || 0,
              selected: selectedComponent === component.id,
              onSelect: () => {
                setSelectedComponent(component.id);
                setSelectedWire(null);
                setAnalysisPanel(null);
              },
              onDragStart: (event) => startDrag(event, component),
              onTerminalClick: handleTerminalClick,
            };

            if (
              component.type === COMPONENT_TYPES.RESISTOR ||
              component.type === COMPONENT_TYPES.LOAD
            ) {
              return <ResistorModel type={component.type} {...commonProps} />;
            }

            if (
              component.type === COMPONENT_TYPES.VOLTAGE ||
              component.type === COMPONENT_TYPES.CURRENT
            ) {
              return (
                <SourceModel
                  type={component.type}
                  deactivated={sourcesDeactivated}
                  {...commonProps}
                />
              );
            }

            if (
              component.type === COMPONENT_TYPES.VOLTMETER ||
              component.type === COMPONENT_TYPES.AMMETER
            ) {
              return <MeterModel type={component.type} {...commonProps} />;
            }

            return <DependentSourceModel type={component.type} {...commonProps} />;
          })}


          {analysisTerminals ? (
            <>
              <OpenTerminalMarker point={analysisTerminals[0]} label="A" color="#ff6b6b" />
              <OpenTerminalMarker point={analysisTerminals[1]} label="B" color="#6aa8ff" />
            </>
          ) : null}

          {analysisMode === "vth" && analysisResult?.ok && analysisTerminals ? (
            <AnalysisVoltmeter
              terminals={analysisTerminals}
              value={analysisResult.value}
            />
          ) : null}

          <OrbitControls
            enabled={draggingComponent === null && !wireMode}
            enablePan={false}
            enableZoom
            enableRotate
            minDistance={3.2}
            maxDistance={18}
            target={[0, 0, 0]}
          />
        </Canvas>

        {selectedComponent && !wireMode ? (
          <div
            style={{
              position: "absolute",
              top: "14px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 120,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 10px",
              borderRadius: "9px",
              background: "rgba(12,18,28,0.94)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
              color: "#e5e7eb",
            }}
          >
            <span style={{ fontSize: "12px", color: "#c7d0d9", marginRight: "2px" }}>
              Rotate component
            </span>
            <button onClick={() => setSelectedComponent(null)} aria-label="Close rotation controls" style={{ width: "24px", height: "24px", padding: 0, borderRadius: "5px", border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.045)", color: "#cbd5e1", cursor: "pointer", fontSize: "16px", lineHeight: "22px" }}>×</button>
            <button
              onClick={() => rotateSelectedComponent(-1)}
              style={{
                padding: "7px 10px",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "#f3f4f6",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              ↺ Rotate Left
            </button>
            <button
              onClick={() => rotateSelectedComponent(1)}
              style={{
                padding: "7px 10px",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "#f3f4f6",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              ↻ Rotate Right
            </button>
          </div>
        ) : null}

        {selectedComponentData && !wireMode ? (
          <div
            style={{
              position: "absolute",
              top: "62px",
              right: "18px",
              zIndex: 130,
              width: "300px",
              padding: "14px",
              borderRadius: "12px",
              background: "rgba(12,18,28,0.96)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 12px 28px rgba(0,0,0,0.30)",
              color: "#e5e7eb",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "2px" }}>
              <div style={{ fontWeight: 700, fontSize: "14px" }}>
                {selectedComponentName(selectedComponentData.type)}
              </div>
              <button onClick={() => setSelectedComponent(null)} aria-label="Close component values" style={{ width: "24px", height: "24px", padding: 0, borderRadius: "5px", border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.045)", color: "#cbd5e1", cursor: "pointer", fontSize: "16px", lineHeight: "22px" }}>×</button>
            </div>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "12px" }}>
              Component values
            </div>

            {(selectedComponentData.type === COMPONENT_TYPES.RESISTOR ||
              selectedComponentData.type === COMPONENT_TYPES.LOAD) ? (
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#cbd5e1", marginBottom: "5px" }}>
                  Resistance (Ω)
                </label>
                <input
                  type="number"
                  min="0.000001"
                  step="0.1"
                  value={selectedComponentData.resistance ?? (selectedComponentData.type === COMPONENT_TYPES.LOAD ? DEFAULT_LOAD_RESISTANCE : DEFAULT_RESISTANCE)}
                  onChange={(event) =>
                    updateSelectedNumericField("resistance", event.target.value, 0.1)
                  }
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 9px",
                    borderRadius: "7px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                    color: "#f8fafc",
                    outline: "none",
                  }}
                />
              </div>
            ) : null}

            {selectedComponentData.type === COMPONENT_TYPES.VOLTAGE ? (
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#cbd5e1", marginBottom: "5px" }}>
                  Source Voltage (V)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedComponentData.voltage ?? DEFAULT_VOLTAGE}
                  onChange={(event) =>
                    updateSelectedNumericField("voltage", event.target.value, 0)
                  }
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 9px",
                    borderRadius: "7px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                    color: "#f8fafc",
                    outline: "none",
                  }}
                />
              </div>
            ) : null}

            {selectedComponentData.type === COMPONENT_TYPES.CURRENT ? (
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#cbd5e1", marginBottom: "5px" }}>
                  Source Current (A)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedComponentData.current ?? DEFAULT_CURRENT}
                  onChange={(event) =>
                    updateSelectedNumericField("current", event.target.value, 0)
                  }
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 9px",
                    borderRadius: "7px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                    color: "#f8fafc",
                    outline: "none",
                  }}
                />
              </div>
            ) : null}

            {isDependentType(selectedComponentData.type) ? (
              <div style={{ display: "grid", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "#cbd5e1", marginBottom: "5px" }}>
                    Dependent Gain / Coefficient
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedComponentData.gain ?? DEFAULT_DEPENDENT_GAIN}
                    onChange={(event) =>
                      updateSelectedNumericField("gain", event.target.value, DEFAULT_DEPENDENT_GAIN)
                    }
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "8px 9px",
                      borderRadius: "7px",
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.06)",
                      color: "#f8fafc",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "#cbd5e1", marginBottom: "5px" }}>
                    Control Quantity
                  </label>
                  <select
                    value={getDependentControlType(selectedComponentData)}
                    onChange={(event) =>
                      updateSelectedComponentField("controlType", event.target.value)
                    }
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "8px 9px",
                      borderRadius: "7px",
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "#111827",
                      color: "#f8fafc",
                      outline: "none",
                    }}
                  >
                    <option value="voltage">Controlling Voltage</option>
                    <option value="current">Controlling Current</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "#cbd5e1", marginBottom: "5px" }}>
                    Control Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. V1 or I1"
                    value={selectedComponentData.controlReference ?? ""}
                    onChange={(event) =>
                      updateSelectedComponentField("controlReference", event.target.value)
                    }
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "8px 9px",
                      borderRadius: "7px",
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.06)",
                      color: "#f8fafc",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "#cbd5e1", marginBottom: "5px" }}>
                    Polarity / Direction
                  </label>
                  <select
                    value={selectedComponentData.polarity ?? 1}
                    onChange={(event) =>
                      updateSelectedNumericField("polarity", event.target.value, 1)
                    }
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "8px 9px",
                      borderRadius: "7px",
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "#111827",
                      color: "#f8fafc",
                      outline: "none",
                    }}
                  >
                    <option value={1}>Normal (+ → −)</option>
                    <option value={-1}>Reversed (− → +)</option>
                  </select>
                </div>

                <div style={{ fontSize: "10px", lineHeight: 1.45, color: "#93a3b8" }}>
                  These values are stored with the dependent source. The complete dependent-source test-source solver will use the configured control relationship in the Type 2 analysis stage.
                </div>
              </div>
            ) : null}

            {(selectedComponentData.type === COMPONENT_TYPES.VOLTMETER ||
              selectedComponentData.type === COMPONENT_TYPES.AMMETER) ? (
              <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.45 }}>
                This instrument is configured by placing its terminals on the circuit nodes to be measured.
              </div>
            ) : null}
          </div>
        ) : null}

        {analysisPanel ? (
          <div
            style={{
              position: "fixed",
              top: "278px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 5000,
              width: "min(520px, calc(100vw - 32px))",
              maxHeight: "min(240px, calc(100vh - 310px))",
              overflowY: "auto",
              padding: "14px 16px",
              borderRadius: "10px",
              background: "rgba(12,18,28,0.96)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
              color: "#e5e7eb",
              pointerEvents: "auto",
              boxSizing: "border-box",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>
              {analysisPanel.title}
            </div>
            <div style={{ fontSize: "12px", lineHeight: 1.5, color: "#c7d0d9" }}>
              {analysisPanel.message}
            </div>

            {analysisResult?.ok && analysisMode === "rth" ? (
              <div style={{ marginTop: "12px", padding: "10px 11px", borderRadius: "8px", background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: "16px", fontWeight: 800, color: "#f6c945", marginBottom: "5px" }}>
                  Rth = {formatOhms(analysisResult.value)}
                </div>
                <div style={{ fontSize: "11px", color: "#aeb8c2", marginBottom: "6px" }}>
                  Open terminals: A ↔ B · Method: {analysisResult.method === "series-parallel" ? "series / parallel reduction" : "1 A test source"}
                </div>
                {(analysisResult.steps || []).map((step, index) => (
                  <div key={index} style={{ fontSize: "11px", color: "#d6dce1", marginTop: "4px" }}>
                    {index + 1}. {step}
                  </div>
                ))}
              </div>
            ) : null}

            {analysisResult?.ok && analysisMode === "vth" ? (
              <div style={{ marginTop: "12px", padding: "10px 11px", borderRadius: "8px", background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: "16px", fontWeight: 800, color: "#8fe0be" }}>
                  Vth = {formatVolts(analysisResult.value)}
                </div>
                <div style={{ fontSize: "11px", color: "#aeb8c2", marginTop: "4px" }}>
                  The load remains open and the virtual voltmeter is connected directly across terminals A and B.
                </div>
              </div>
            ) : null}

            <button
              onClick={resetAnalysis}
              style={{
                marginTop: "10px",
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "#e5e7eb",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {wireMode ? (
          <>
            <div
              style={{
                position: "absolute",
                right: "18px",
                bottom: "18px",
                zIndex: 20,
                padding: "9px 12px",
                borderRadius: "7px",
                background: "rgba(12,18,28,0.90)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#e5e7eb",
                fontSize: "12px",
                lineHeight: 1.45,
                pointerEvents: "none",
              }}
            >
              {wireStart
                ? "Move over the target hole; the cable snaps to that exact hole. Right-click to fix it."
                : "Click the exact breadboard hole to start, move over the next hole, then right-click."}
            </div>

            <div
              style={{
                position: "fixed",
                left: `${wireCursor.x}px`,
                top: `${wireCursor.y}px`,
                width: "18px",
                height: "18px",
                transform: "translate(-50%, -50%)",
                zIndex: 10000,
                pointerEvents: "none",
                color: "#f4f7fa",
                fontSize: "20px",
                lineHeight: "18px",
                fontWeight: 700,
                textShadow: "0 1px 5px rgba(0,0,0,0.70)",
              }}
            >
              +
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ComponentMenuButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: "42px",
        padding: "8px 14px",
        border: "none",
        borderRadius: 0,
        background: "transparent",
        color: "#f3f4f6",
        display: "flex",
        alignItems: "center",
        textAlign: "left",
        fontSize: "14px",
        cursor: "pointer",
        margin: 0,
        lineHeight: 1.25,
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = "rgba(255,255,255,0.07)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = "transparent";
      }}
    >
      <span
        style={{
          width: "28px",
          flex: "0 0 28px",
          marginRight: "8px",
          fontSize: "17px",
        }}
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
