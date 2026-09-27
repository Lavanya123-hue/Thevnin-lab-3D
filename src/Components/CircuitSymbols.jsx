export function Resistor() {
  return (
    <svg width="120" height="40">
      <polyline
        points="0,20 15,20 25,5 35,35 45,5 55,35 65,5 75,35 85,20 120,20"
        stroke="black"
        strokeWidth="3"
        fill="none"
      />
    </svg>
  );
}

export function VoltageSource() {
  return (
    <svg width="80" height="80">
      <circle
        cx="40"
        cy="40"
        r="25"
        stroke="black"
        strokeWidth="3"
        fill="white"
      />
      <line x1="40" y1="25" x2="40" y2="55" stroke="black" />
      <line x1="30" y1="40" x2="50" y2="40" stroke="black" />
    </svg>
  );
}

export function CurrentSource() {
  return (
    <svg width="80" height="80">
      <circle
        cx="40"
        cy="40"
        r="25"
        stroke="black"
        strokeWidth="3"
        fill="white"
      />
      <line x1="40" y1="55" x2="40" y2="25" stroke="black" />
      <polygon
        points="35,30 45,30 40,20"
        fill="black"
      />
    </svg>
  );
}

export function Ammeter() {
  return (
    <svg width="80" height="80">
      <circle
        cx="40"
        cy="40"
        r="25"
        stroke="black"
        strokeWidth="3"
        fill="white"
      />
      <text
        x="40"
        y="48"
        textAnchor="middle"
        fontSize="20"
      >
        A
      </text>
    </svg>
  );
}

export function Voltmeter() {
  return (
    <svg width="80" height="80">
      <circle
        cx="40"
        cy="40"
        r="25"
        stroke="black"
        strokeWidth="3"
        fill="white"
      />
      <text
        x="40"
        y="48"
        textAnchor="middle"
        fontSize="20"
      >
        V
      </text>
    </svg>
  );
}