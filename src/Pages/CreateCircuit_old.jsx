import { TextureLoader } from "three";
import { useLoader } from "@react-three/fiber";
import breadboardImg from "../assets/Breadboard/Breadboard.png";
import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

function Breadboard() {
    const texture = useLoader(
        TextureLoader,
        breadboardImg
    );

    return (
        <mesh position={[0, 0, 0]}>
            <boxGeometry args={[8, 0.4, 4]} />
            <meshStandardMaterial map={texture} />
        </mesh>
    );
}

function Resistor({
    position,
    onClick
}) {
    return (
        <mesh
            position={position}
            onClick={onClick}
        >
            <boxGeometry args={[1, 0.25, 0.25]} />
            <meshStandardMaterial color="orange" />
        </mesh>
    );
}

function VoltageSource({ position }) {
    return (
        <mesh position={position}>
            <cylinderGeometry args={[0.3, 0.3, 1, 32]} />
            <meshStandardMaterial color="red" />
        </mesh>
    );
}

export default function CreateCircuit() {
    const [components, setComponents] = useState([]);
    const [selectedComponent, setSelectedComponent] =
        useState(null);

    const addResistor = () => {
        setComponents([
            ...components,
            {
                id: Date.now(),
                type: "resistor",
                value: 100,
                position: [0, 0.5, 0],
            },
        ]);
    };

    const addVoltage = () => {
        setComponents([
            ...components,
            {
                type: "voltage",
                position: [2, 0.5, 0],
            },
        ]);
    };

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                display: "flex",
            }}
        >
            {/* LEFT PANEL */}

            <div
                style={{
                    width: "250px",
                    background: "#08111f",
                    color: "white",
                    padding: "20px",
                }}
            >
                <h2>Components</h2>

                <button onClick={addResistor}>
                    Resistor
                </button>

                <br />
                <br />

                <button onClick={addVoltage}>
                    Voltage Source
                </button>
            </div>

            {/* 3D VIEW */}

            <div style={{ flex: 1 }}>
                <Canvas camera={{ position: [0, 5, 10] }}>
                    <ambientLight intensity={1} />

                    <directionalLight
                        position={[5, 5, 5]}
                        intensity={3}
                    />

                    {/* Breadboard */}

                    <Breadboard />

                    {/* Components */}

                    {components.map((comp, index) => {
                        if (comp.type === "resistor") {
                            return (
                                <Resistor
                                    key={index}
                                    position={comp.position}
                                    onClick={() =>
                                        setSelectedComponent(comp)
                                    }
                                />
                            );
                        }

                        if (comp.type === "voltage") {
                            return (
                                <VoltageSource
                                    key={index}
                                    position={comp.position}
                                />
                            );
                        }

                        return null;
                    })}

                    <OrbitControls />
                </Canvas>
            </div>

            {/* RIGHT PANEL */}

            <div
                style={{
                    width: "250px",
                    background: "#08111f",
                    color: "white",
                    padding: "20px",
                }}
            >
                <h2>Properties</h2>

                {selectedComponent ? (
                    <>
                        <p>
                            Type:
                            {" "}
                            {selectedComponent.type}
                        </p>

                        <p>
                            Value:
                            {" "}
                            {selectedComponent.value}
                            Ω
                        </p>
                    </>
                ) : (
                    <p>
                        Select component...
                    </p>
                )}
            </div>
        </div>
    );
}