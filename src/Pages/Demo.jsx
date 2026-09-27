import { useState } from "react";

function Demo() {
  const steps = [
    "Observe the original circuit.",
    "Identify the load terminals.",
    "Remove the load resistor.",
    "Measure open-circuit voltage (Vth).",
    "Deactivate all independent sources.",
    "Measure equivalent resistance (Rth).",
    "Build the Thevenin equivalent circuit.",
    "Compare both circuits."
  ];

  const [step, setStep] = useState(0);

  return (
    <div style={{ textAlign: "center", padding: "50px" }}>
      <h1>Thevenin Tutorial</h1>

      <h2>Step {step + 1}</h2>

      <p>{steps[step]}</p>

      <button
        onClick={() => setStep(step - 1)}
        disabled={step === 0}
      >
        Previous
      </button>

      <button
        onClick={() => setStep(step + 1)}
        disabled={step === steps.length - 1}
      >
        Next
      </button>
    </div>
  );
}

export default Demo;