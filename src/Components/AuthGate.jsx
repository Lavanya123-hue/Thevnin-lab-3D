import { useEffect, useState } from "react";
import "./AuthGate.css";

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [showProfile, setShowProfile] = useState(false);

  /* =====================================================
     LOAD SAVED USER
  ===================================================== */

  useEffect(() => {
    const savedUser = localStorage.getItem("thevenin_user");

    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch (error) {
        localStorage.removeItem("thevenin_user");
      }
    }
  }, []);


  /* =====================================================
     LOGIN
  ===================================================== */

  const handleLogin = (event) => {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    const savedUser = localStorage.getItem("thevenin_user");

    let currentUser = null;

    if (savedUser) {
      try {
        currentUser = JSON.parse(savedUser);
      } catch {
        currentUser = null;
      }
    }


    /* =================================================
       CREATE NEW USER
    ================================================= */

    if (!currentUser) {
      currentUser = {
        email: cleanEmail,

        createdAt: new Date().toISOString(),

        circuitsSolved: 0,

        demoCircuits: 0,

        correctCircuits: 0,

        totalCircuits: 0,
      };
    } else {
      /*
        Keep existing statistics when the user logs in
        again.
      */

      currentUser.email = cleanEmail;

      currentUser.circuitsSolved =
        Number(currentUser.circuitsSolved || 0);

      currentUser.demoCircuits =
        Number(currentUser.demoCircuits || 0);

      currentUser.correctCircuits =
        Number(currentUser.correctCircuits || 0);

      currentUser.totalCircuits =
        Number(currentUser.totalCircuits || 0);
    }


    localStorage.setItem(
      "thevenin_user",
      JSON.stringify(currentUser)
    );

    setUser(currentUser);

    setEmail("");

    setError("");

    setShowProfile(false);
  };


  /* =====================================================
     GOOGLE SIGN-IN
     
     This is currently a visual entry point.
     Real Google OAuth will be connected separately.
  ===================================================== */

  const handleGoogleLogin = () => {
    setError(
      "Google sign-in will be connected when Google authentication is configured."
    );
  };


  /* =====================================================
     LOGOUT
  ===================================================== */

  const logout = () => {
    localStorage.removeItem("thevenin_user");

    setUser(null);

    setEmail("");

    setError("");

    setShowProfile(false);
  };


  /* =====================================================
     LOGIN SCREEN
  ===================================================== */

  if (!user) {
    return (
      <div className="auth-screen">

        <div className="auth-background-grid" />

        <div className="auth-glow auth-glow-one" />

        <div className="auth-glow auth-glow-two" />


        <div className="auth-card">

          {/* BRAND */}

          <div className="auth-brand">

            <div className="brand-mark">
              T
            </div>

            <div>

              <div className="brand-name">
                THEVENIN LAB
              </div>

              <div className="brand-subtitle">
                Virtual Circuit Laboratory
              </div>

            </div>

          </div>


          {/* HEADING */}

          <div className="auth-heading">

            Welcome to your

            <span>
              {" "}virtual electronics lab.
            </span>

          </div>


          <p className="auth-description">

            Build circuits, experiment with components,
            calculate Vth and Rth, and learn through
            interactive simulation.

          </p>


          {/* EMAIL LOGIN */}

          <form
            className="auth-form"
            onSubmit={handleLogin}
          >

            <label>
              Email address
            </label>

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
            />


            {error && (
              <div className="auth-error">
                {error}
              </div>
            )}


            <button
              type="submit"
              className="auth-submit"
            >

              Continue for Free

              <span>
                →
              </span>

            </button>

          </form>


          {/* DIVIDER */}

          <div className="auth-divider">

            <span />

            <div>
              OR
            </div>

            <span />

          </div>


          {/* GOOGLE */}

          <button
            type="button"
            className="google-login-button"
            onClick={handleGoogleLogin}
          >

            <span className="google-icon">
              G
            </span>

            <span>
              Continue with Google
            </span>

          </button>


          {/* BENEFITS */}

          <div className="auth-benefits">

            <div className="auth-free">
              <span>✓</span>
              Free to use
            </div>

            <div className="auth-free">
              <span>✓</span>
              Save your circuit progress
            </div>

            <div className="auth-free">
              <span>✓</span>
              Track your learning progress
            </div>

          </div>

        </div>

      </div>
    );
  }


  /* =====================================================
     AUTHENTICATED LAB
  ===================================================== */

  return (
    <div className="authenticated-app">

      {/* =================================================
          TOP ACCOUNT BAR
      ================================================= */}

      <div className="account-bar">

        <div className="account-brand">
          THEVENIN LAB
        </div>


        <div className="account-right">

          <button
            className="profile-button"
            onClick={() =>
              setShowProfile((previous) => !previous)
            }
          >

            <div className="profile-avatar">

              {user.email
                ? user.email.charAt(0).toUpperCase()
                : "U"}

            </div>


            <div className="profile-info">

              <span className="profile-label">
                MY PROFILE
              </span>

              <span className="profile-email">
                {user.email}
              </span>

            </div>


            <span className="profile-arrow">
              {showProfile ? "⌃" : "⌄"}
            </span>

          </button>


          {/* PROFILE DROPDOWN */}

          {showProfile && (
            <ProfileDropdown
              user={user}
              logout={logout}
            />
          )}

        </div>

      </div>


      {/* =================================================
          EXISTING 3D LAB
      ================================================= */}

      {children}

    </div>
  );
}


/* =====================================================
   PROFILE DROPDOWN
===================================================== */

function ProfileDropdown({
  user,
  logout,
}) {

  const solved =
    Number(user.circuitsSolved || 0);


  const demoCircuits =
    Number(user.demoCircuits || 0);


  const correct =
    Number(user.correctCircuits || 0);


  const total =
    Number(user.totalCircuits || 0);


  let accuracy = 0;

  if (total > 0) {
    accuracy = Math.round(
      (correct / total) * 100
    );
  }


  return (
    <div className="profile-dropdown">

      {/* HEADER */}

      <div className="profile-dropdown-header">

        <div className="profile-dropdown-avatar">

          {user.email
            ? user.email.charAt(0).toUpperCase()
            : "U"}

        </div>


        <div>

          <div className="profile-dropdown-title">
            My Profile
          </div>

          <div className="profile-dropdown-email">
            {user.email}
          </div>

        </div>

      </div>


      {/* EMAIL */}

      <div className="profile-email-section">

        <span>
          EMAIL
        </span>

        <strong>
          {user.email}
        </strong>

      </div>


      {/* STATISTICS */}

      <div className="profile-stat-grid">


        {/* CIRCUITS SOLVED */}

        <div className="profile-stat">

          <div className="profile-stat-icon">
            📐
          </div>

          <div>

            <span>
              CIRCUITS SOLVED
            </span>

            <strong>
              {solved}
            </strong>

          </div>

        </div>


        {/* DEMO CIRCUITS */}

        <div className="profile-stat">

          <div className="profile-stat-icon">
            🎓
          </div>

          <div>

            <span>
              DEMO CIRCUITS
            </span>

            <strong>
              {demoCircuits}
            </strong>

          </div>

        </div>


        {/* ACCURACY */}

        <div className="profile-stat">

          <div className="profile-stat-icon">
            🎯
          </div>

          <div>

            <span>
              ACCURACY
            </span>

            <strong>
              {total > 0
                ? `${accuracy}%`
                : "—"}
            </strong>

          </div>

        </div>

      </div>


      {/* ACCOUNT INFO */}

      <div className="profile-account-info">

        <span>
          MEMBER SINCE
        </span>

        <strong>

          {user.createdAt
            ? new Date(
                user.createdAt
              ).toLocaleDateString(
                undefined,
                {
                  month: "short",
                  year: "numeric",
                }
              )
            : "Recently"}

        </strong>

      </div>


      {/* LOGOUT */}

      <button
        className="profile-logout"
        onClick={logout}
      >

        <span>
          ↪
        </span>

        Sign out

      </button>

    </div>
  );
}