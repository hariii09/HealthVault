import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import EmergencyPage from "./pages/EmergencyPage";
import "./App.css";

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask!");
      return;
    }
    const _provider = new ethers.providers.Web3Provider(window.ethereum);
    await _provider.send("eth_requestAccounts", []);
    const _signer = _provider.getSigner();
    const _account = await _signer.getAddress();
    setProvider(_provider);
    setSigner(_signer);
    setAccount(_account);
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", () => window.location.reload());
      window.ethereum.on("chainChanged", () => window.location.reload());
    }
  }, []);

  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="nav-brand">
            <span className="brand-icon">H</span>
            HealthVault
          </div>
          <div className="nav-links">
            <Link to="/">Patient</Link>
            <Link to="/doctor">Doctor</Link>
            <Link to="/emergency">Emergency</Link>
          </div>
          <div className="nav-wallet">
            {account ? (
              <span className="account-badge">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
            ) : (
              <button className="connect-btn" onClick={connectWallet}>
                Connect Wallet
              </button>
            )}
          </div>
        </nav>

        <main className="main-content">
          {!account ? (
            <div className="welcome">
              <div className="welcome-icon">H</div>
              <h1>HealthVault</h1>
              <p>Decentralized Medical Records on Blockchain</p>
              <button className="connect-btn-large" onClick={connectWallet}>
                Connect MetaMask to Continue
              </button>
              <div className="features">
                <div className="feature">Patient-controlled records</div>
                <div className="feature">Tamper-proof audit trail</div>
                <div className="feature">Smart contract access control</div>
                <div className="feature">IPFS encrypted storage</div>
              </div>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<PatientDashboard signer={signer} account={account} />} />
              <Route path="/doctor" element={<DoctorDashboard signer={signer} account={account} />} />
              <Route path="/emergency" element={<EmergencyPage signer={signer} account={account} />} />
            </Routes>
          )}
        </main>
      </div>
    </Router>
  );
}

export default App;