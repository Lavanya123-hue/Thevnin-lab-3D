import "./App.css";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
} from "react-router-dom";

import Dashboard from "./Pages/Dashboard";
import Demo from "./Pages/Demo";
import CreateCircuit from "./Pages/CreateCircuit";
import AuthGate from "./Components/AuthGate";


/* =====================================================
   HOME PAGE
   EXISTING DESIGN — DO NOT CHANGE
===================================================== */

function Home() {
  return (
    <div className="app">

      <div className="background-grid"></div>

      <header>
        <h1 className="main-title">
          THEVENIN LAB 3D
        </h1>

        <p className="tagline">
          Learn • Simulate • Verify
        </p>
      </header>


      <div className="cards">

        {/* =========================
            DEMO CIRCUIT
        ========================== */}

        <div className="mode-card demo-card">

          <div className="card-icon">
            🎓
          </div>

          <h2>
            Demo Mode
          </h2>

          <p>
            Interactive animated tutorials
            from beginner to advanced level.
          </p>

          <Link to="/demo">
            <button>
              ENTER LAB →
            </button>
          </Link>

        </div>


        {/* =========================
            CREATE CIRCUIT
        ========================== */}

        <div className="mode-card create-card">

          <div className="card-icon">
            ⚡
          </div>

          <h2>
            Virtual Laboratory
          </h2>

          <p>
            Build and verify your own
            Thevenin circuits in 3D.
          </p>

          <Link to="/create">
            <button>
              START BUILDING →
            </button>
          </Link>

        </div>

      </div>

    </div>
  );
}


/* =====================================================
   PROTECTED CREATE CIRCUIT
===================================================== */

function ProtectedCreateCircuit() {
  return (
    <AuthGate>
      <CreateCircuit />
    </AuthGate>
  );
}


/* =====================================================
   APP
===================================================== */

function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* HOME */}
        <Route
          path="/"
          element={<Home />}
        />

        {/* DASHBOARD */}
        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        {/* DEMO */}
        <Route
          path="/demo"
          element={<Demo />}
        />

        {/* CREATE CIRCUIT */}
        <Route
          path="/create"
          element={<ProtectedCreateCircuit />}
        />

        {/* UNKNOWN ROUTE */}
        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;