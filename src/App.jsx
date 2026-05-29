import React, { useState, useEffect } from "react";
import { auth } from "./config/firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { Html5Qrcode } from "html5-qrcode";
import {
  getStudentByStudentId,
  getClasses,
  getStudentPayments,
  activateClassForStudent,
  deactivateClassForStudent
} from "./db/firestoreService";
import "./App.css";

export default function App() {
  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // App data state
  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [searchId, setSearchId] = useState("");
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [scannedStudent, setScannedStudent] = useState(null);
  const [activeClassIds, setActiveClassIds] = useState([]);
  const [scannerActive, setScannerActive] = useState(false);
  const [actionInProgress, setActionInProgress] = useState("");

  // Listen to Auth State changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Class Catalog once user logs in
  useEffect(() => {
    if (user) {
      fetchCatalogClasses();
    } else {
      // Clear data on logout
      setClasses([]);
      setScannedStudent(null);
      setActiveClassIds([]);
      setScannerActive(false);
    }
  }, [user]);

  // QR Code Scanner effect
  useEffect(() => {
    let html5QrCode = null;
    let isMounted = true;

    if (user && scannerActive) {
      const qrEl = document.getElementById("qr-scanner-viewport");
      if (qrEl) {
        try {
          html5QrCode = new Html5Qrcode("qr-scanner-viewport");
          html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 }
            },
            (decodedText) => {
              if (!isMounted) return;
              
              // Stop scanning
              setScannerActive(false);

              // Parse student ID from QR
              const lines = decodedText.split("\n");
              let foundId = "";
              for (const line of lines) {
                if (line.startsWith("ID:")) {
                  foundId = line.replace("ID:", "").trim();
                  break;
                }
              }
              if (!foundId && decodedText.includes("SK")) {
                const match = decodedText.match(/SK\d+/);
                if (match) foundId = match[0];
              }
              const resultId = foundId || decodedText.trim();
              setSearchId(resultId);
              handleSearchStudent(resultId);
            },
            () => {
              // Parse errors are expected and ignored
            }
          ).catch((err) => {
            console.error("Unable to start scanning.", err);
          });
        } catch (err) {
          console.error("Failed to initialize Html5Qrcode", err);
        }
      }
    }

    return () => {
      isMounted = false;
      if (html5QrCode) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, [user, scannerActive]);

  // Fetch classes
  const fetchCatalogClasses = async () => {
    setLoadingClasses(true);
    try {
      const list = await getClasses();
      setClasses(list);
    } catch (e) {
      console.error(e);
      alert("Error fetching classes: " + e.message);
    } finally {
      setLoadingClasses(false);
    }
  };

  // Sign in
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      const msgs = {
        "auth/user-not-found": "මෙම Admin Email ලියාපදිංචි නොවී ඇත.",
        "auth/wrong-password": "Password නිවැරදි නොවේ.",
        "auth/invalid-credential": "Email හෝ Password වැරදිය.",
        "auth/network-request-failed": "Network සම්බන්ධතාව පරීක්ෂා කරන්න.",
      };
      setLoginError(msgs[err.code] || err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  // Sign out
  const handleLogout = () => {
    if (window.confirm("Admin ගිණුමෙන් ඉවත් වීමට අවශ්‍යද?")) {
      signOut(auth);
    }
  };

  // Search Student profile
  const handleSearchStudent = async (sid) => {
    const cleanId = sid || searchId;
    if (!cleanId) return;
    setSearchingStudent(true);
    setScannedStudent(null);
    setActiveClassIds([]);
    try {
      const student = await getStudentByStudentId(cleanId);
      if (student) {
        setScannedStudent(student);
        const paymentsLog = await getStudentPayments(student.id);
        const activeIds = paymentsLog
          .filter((p) => p.status === "approved")
          .map((p) => p.classId);
        setActiveClassIds(activeIds);
      } else {
        alert("මෙම ID එක සහිත ශිෂ්‍යයෙකු සොයාගත නොහැකි විය. (" + cleanId + ")");
      }
    } catch (e) {
      console.error(e);
      alert("ශිෂ්‍යයා සෙවීම අසාර්ථකයි.");
    } finally {
      setSearchingStudent(false);
    }
  };

  // Toggle activation
  const handleToggleActivation = async (classItem, isCurrentlyActive) => {
    if (!scannedStudent) return;
    setActionInProgress(classItem.id);
    try {
      if (isCurrentlyActive) {
        if (window.confirm(`මෙම ශිෂ්‍යයාට "${classItem.title}" පන්තිය අත්හිටුවීමට අවශ්‍යද?`)) {
          await deactivateClassForStudent(scannedStudent.id, classItem.id);
          setActiveClassIds((prev) => prev.filter((id) => id !== classItem.id));
          alert("පන්තිය අත්හිටුවන ලදී.");
        }
      } else {
        await activateClassForStudent(
          scannedStudent.id,
          `${scannedStudent.firstName} ${scannedStudent.lastName}`,
          scannedStudent.studentId,
          classItem.id,
          classItem.title,
          classItem.price
        );
        setActiveClassIds((prev) => [...prev, classItem.id]);
        alert("පන්තිය සාර්ථකව සක්‍රීය කරන ලදී!");
      }
    } catch (e) {
      console.error(e);
      alert("ක්‍රියාවලිය අසාර්ථකයි.");
    } finally {
      setActionInProgress("");
    }
  };

  if (authLoading) {
    return (
      <div className="login-wrapper">
        <div className="spinner" style={{ width: "2rem", height: "2rem", border: "3px solid #7c3aed", borderTopColor: "transparent" }}></div>
      </div>
    );
  }

  // 1. LOGIN SCREEN
  if (!user) {
    return (
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-accent-bar"></div>
          <div className="login-body">
            <div className="login-header">
              <div className="logo-icon">
                <svg className="w-5 h-5" style={{ width: "1.25rem", height: "1.25rem" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0a8 8 0 11-16 0 8 8 0 0116 0z" />
                </svg>
              </div>
              <div className="logo-text">
                <h1>SKCHEM.COM</h1>
                <p>QR class activator</p>
              </div>
            </div>

            <div className="login-title" style={{ marginBottom: "1.5rem" }}>
              <h2>Admin Sign In</h2>
              <p>Scan QR and activate class packages instantly.</p>
            </div>

            {loginError && (
              <div className="error-banner">
                <svg style={{ width: "1rem", height: "1rem" }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Admin Email</label>
                <input
                  type="email"
                  required
                  placeholder="admin@skchem.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: "1.75rem" }}>
                <label>Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                />
              </div>

              <button type="submit" disabled={loginLoading} className="btn-submit">
                {loginLoading ? <div className="spinner"></div> : "Sign In to Activator"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // 2. DASHBOARD / SCANNER SCREEN
  return (
    <div className="app-container">
      <header className="dashboard-header">
        <div className="dashboard-logo">
          <div className="dashboard-logo-icon">QR</div>
          <div className="dashboard-logo-text">
            <h1>SKCHEM Activator</h1>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-signout">
          Sign Out
        </button>
      </header>

      <main className="main-content">
        {/* Scanner Panel */}
        <div className="card">
          <h3 className="card-title">QR Scanner & Search</h3>
          <p className="card-desc">Scan a student's QR code or search by Student ID to view details.</p>

          <div className="scanner-actions">
            <button
              onClick={() => {
                setScannerActive(!scannerActive);
                setScannedStudent(null);
              }}
              className={`btn-scanner-toggle ${scannerActive ? "active" : ""}`}
            >
              <svg style={{ width: "1rem", height: "1rem" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              {scannerActive ? "Close Camera" : "Open QR Scanner"}
            </button>

            <div className="search-input-wrapper">
              <input
                type="text"
                placeholder="Enter Student ID (e.g. 2649204924)"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchStudent()}
              />
              <span className="search-icon-abs">🔍</span>
            </div>

            <button
              onClick={() => handleSearchStudent()}
              disabled={searchingStudent || !searchId}
              className="btn-submit"
              style={{ width: "auto", padding: "0.75rem 1rem", borderRadius: "0.75rem" }}
            >
              {searchingStudent ? <div className="spinner"></div> : "Search"}
            </button>
          </div>

          {scannerActive && (
            <div className="camera-container">
              <div className="camera-status">📷 CAMERA SCANNING ACTIVE</div>
              <div id="qr-scanner-viewport"></div>
            </div>
          )}
        </div>

        {/* Search Result Section */}
        {scannedStudent && (
          <div className="card" style={{ borderLeft: "5px solid var(--primary)" }}>
            <div className="profile-card">
              {scannedStudent.profileImage ? (
                <img src={scannedStudent.profileImage} alt="Profile" className="profile-avatar" />
              ) : (
                <div className="profile-avatar">
                  {scannedStudent.firstName?.[0]}
                  {scannedStudent.lastName?.[0]}
                </div>
              )}
              <div>
                <h4 className="profile-name">
                  {scannedStudent.firstName} {scannedStudent.lastName}
                </h4>
                <p className="profile-email">{scannedStudent.email}</p>
              </div>
            </div>

            <div className="student-meta-grid">
              <div className="student-meta-row">
                <span className="meta-label">Student ID</span>
                <span className="meta-val" style={{ color: "var(--primary)" }}>{scannedStudent.studentId}</span>
              </div>
              <div className="student-meta-row">
                <span className="meta-label">Batch</span>
                <span className="meta-val">{scannedStudent.batch || "N/A"}</span>
              </div>
              <div className="student-meta-row">
                <span className="meta-label">Mobile</span>
                <span className="meta-val">{scannedStudent.mobile || "N/A"}</span>
              </div>
              <div className="student-meta-row">
                <span className="meta-label">Verification Status</span>
                <span className="meta-val">
                  {scannedStudent.isProfileVerified && scannedStudent.isNICVerified ? (
                    <span className="badge badge-green">Verified Student</span>
                  ) : (
                    <span className="badge badge-red">Non-Verified Student</span>
                  )}
                </span>
              </div>
            </div>

            <div style={{ marginTop: "1.5rem" }}>
              <h3 className="card-title" style={{ fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                Class Package Activation
              </h3>

              {loadingClasses ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "1.5rem" }}>
                  <div className="spinner" style={{ border: "2px solid var(--primary)", borderTopColor: "transparent" }}></div>
                </div>
              ) : classes.length === 0 ? (
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>
                  පන්ති කිසිවක් Catalog එකේ නොමැත.
                </p>
              ) : (
                <div className="classes-list">
                  {classes.map((cls) => {
                    const isActive = activeClassIds.includes(cls.id);
                    const isProcessing = actionInProgress === cls.id;
                    return (
                      <div key={cls.id} className={`class-item ${isActive ? "active" : ""}`}>
                        <div className="class-info">
                          <h4>{cls.title}</h4>
                          <p>
                            Month: {cls.month} | Batch: {cls.batch} | Price: LKR {cls.price}
                          </p>
                        </div>
                        <button
                          onClick={() => handleToggleActivation(cls, isActive)}
                          disabled={isProcessing}
                          className={`btn-action ${isActive ? "btn-deactivate" : "btn-activate"}`}
                        >
                          {isProcessing ? (
                            <div className="spinner" style={{ border: `2px solid ${isActive ? "var(--danger)" : "white"}`, borderTopColor: "transparent" }}></div>
                          ) : isActive ? (
                            "Deactivate"
                          ) : (
                            "Activate"
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>SKCHEM.COM - Sajith K Kumara</p>
        <p>
          QR Class Activator Panel &copy; 2026 | Developer: <span className="copyright-accent">Theekshana Viduranga &lt;/&gt;</span>
        </p>
      </footer>
    </div>
  );
}
