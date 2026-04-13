import { useState } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES } from "../contracts/config";
import PatientRegistryABI from "../contracts/PatientRegistry.json";
import RecordRegistryABI from "../contracts/RecordRegistry.json";
import AccessControlABI from "../contracts/AccessControl.json";
import { uploadToIPFS, getIPFSUrl } from "../services/ipfs";

export default function PatientDashboard({ signer, account }) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [bloodType, setBloodType] = useState("O+");
  const [status, setStatus] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState("");
  const [recordType, setRecordType] = useState("0");
  const [uploading, setUploading] = useState(false);
  const [records, setRecords] = useState([]);

  const [pendingRequests, setPendingRequests] = useState([]);

  const getPatientRegistry = () => new ethers.Contract(
    CONTRACT_ADDRESSES.PatientRegistry,
    PatientRegistryABI.abi, signer
  );
  const getRecordRegistry = () => new ethers.Contract(
    CONTRACT_ADDRESSES.RecordRegistry,
    RecordRegistryABI.abi, signer
  );
  const getAccessControl = () => new ethers.Contract(
    CONTRACT_ADDRESSES.AccessControl,
    AccessControlABI.abi, signer
  );

  const registerPatient = async () => {
    try {
      setStatus("Registering... confirm in MetaMask");
      const contract = getPatientRegistry();
      const dobTimestamp = Math.floor(new Date(dob).getTime() / 1000);
      const tx = await contract.register(name, dobTimestamp, bloodType);
      setStatus("Waiting for confirmation...");
      await tx.wait();
      setStatus("Registered successfully!");
      setIsRegistered(true);
    } catch (err) {
      setStatus("Error: " + (err.reason || err.message));
    }
  };

  const checkRegistration = async () => {
    try {
      const contract = getPatientRegistry();
      const result = await contract.isRegistered(account);
      setIsRegistered(result);
      setStatus(result ? "You are registered!" : "Not registered yet.");
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) { setStatus("Please select a file first."); return; }
    if (!description)  { setStatus("Please add a description."); return; }
    try {
      setUploading(true);
      setStatus("Step 1/3: Encrypting and uploading to IPFS...");
      const ipfsHash = await uploadToIPFS(selectedFile);

      setStatus("Step 2/3: Storing hash on blockchain... confirm in MetaMask");
      const contract = getRecordRegistry();
      const tx = await contract.uploadRecord(
        account, ipfsHash, parseInt(recordType), description
      );

      setStatus("Step 3/3: Waiting for blockchain confirmation...");
      await tx.wait();

      setStatus(`Done! File uploaded to IPFS and hash stored on-chain.
        IPFS Hash: ${ipfsHash}`);
      setSelectedFile(null);
      setDescription("");
    } catch (err) {
      setStatus("Error: " + (err.reason || err.message));
    } finally {
      setUploading(false);
    }
  };

  const loadRecords = async () => {
    try {
      setStatus("Loading your records...");
      const contract = getRecordRegistry();
      const ids = await contract.getPatientRecordIds(account);
      const loaded = [];
      const types = ["Lab", "Prescription", "Imaging", "Discharge", "Vaccination", "Other"];
      for (let id of ids) {
        const r = await contract.getRecord(id);
        loaded.push({ ...r, typeName: types[r.recordType] });
      }
      setRecords(loaded);
      setStatus("");
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  };

  const loadPendingRequests = async () => {
    try {
      setStatus("Loading access requests...");
      const contract = getAccessControl();
      const ids = await contract.getPatientRequests(account);
      const loaded = [];
      for (let id of ids) {
        const req = await contract.getRequest(id);
        if (req.status === 0) {
          loaded.push({ id: id.toString(), ...req });
        }
      }
      setPendingRequests(loaded);
      setStatus(loaded.length === 0 ? "No pending requests." : "");
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  };

  const approveRequest = async (requestId) => {
    try {
      setStatus("Approving... confirm in MetaMask");
      const contract = getAccessControl();
      const tx = await contract.approveAccess(requestId, 0);
      await tx.wait();
      setStatus("Access approved for 30 days!");
      loadPendingRequests();
    } catch (err) {
      setStatus("Error: " + (err.reason || err.message));
    }
  };

  const rejectRequest = async (requestId) => {
    try {
      setStatus("Rejecting... confirm in MetaMask");
      const contract = getAccessControl();
      const tx = await contract.rejectAccess(requestId);
      await tx.wait();
      setStatus("Access request rejected.");
      loadPendingRequests();
    } catch (err) {
      setStatus("Error: " + (err.reason || err.message));
    }
  };

  const recordTypes = ["Lab", "Prescription", "Imaging", "Discharge", "Vaccination", "Other"];
  const bloodTypes = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

  return (
    <div className="dashboard">
      <h2>Patient Dashboard</h2>
      <p className="account-info">Connected: {account.slice(0,6)}...{account.slice(-4)}</p>

      {status && (
        <div className={`status-box ${status.startsWith("Error") ? "error" : ""}`}>
          {status}
        </div>
      )}

      <div className="card">
        <h3>Register as Patient</h3>
        <input placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} />
        <input type="date" value={dob} onChange={e => setDob(e.target.value)} />
        <select value={bloodType} onChange={e => setBloodType(e.target.value)}>
          {bloodTypes.map(b => <option key={b}>{b}</option>)}
        </select>
        <div className="btn-row">
          <button onClick={registerPatient}>Register</button>
          <button onClick={checkRegistration} className="secondary">Check Status</button>
        </div>
        {isRegistered && (
          <div style={{marginTop:"10px", fontSize:"13px", color:"#1D9E75", fontWeight:"500"}}>
            You are a registered patient.
          </div>
        )}
      </div>

      <div className="card">
        <h3>Upload Medical Record</h3>
        <p style={{fontSize:"13px", color:"#666", marginBottom:"10px"}}>
          Your file is uploaded to IPFS (decentralized storage) and only the
          cryptographic hash is stored on the blockchain.
        </p>
        <div className="file-drop" onClick={() => document.getElementById("fileInput").click()}>
          {selectedFile ? (
            <div>
              <div style={{fontWeight:"500"}}>{selectedFile.name}</div>
              <div style={{fontSize:"12px", color:"#888"}}>{(selectedFile.size / 1024).toFixed(1)} KB</div>
            </div>
          ) : (
            <div>
              <div style={{fontSize:"24px", marginBottom:"8px"}}>+</div>
              <div style={{fontSize:"14px"}}>Click to select a file</div>
              <div style={{fontSize:"12px", color:"#888"}}>PDF, images, DICOM supported</div>
            </div>
          )}
        </div>
        <input
          id="fileInput"
          type="file"
          style={{display:"none"}}
          accept=".pdf,.jpg,.jpeg,.png,.dcm"
          onChange={e => setSelectedFile(e.target.files[0])}
        />
        <input
          placeholder="Description e.g. Blood panel April 2026"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <select value={recordType} onChange={e => setRecordType(e.target.value)}>
          {recordTypes.map((t, i) => <option key={i} value={i}>{t}</option>)}
        </select>
        <button onClick={handleFileUpload} disabled={uploading}>
          {uploading ? "Uploading..." : "Upload to IPFS + Blockchain"}
        </button>
      </div>

      <div className="card">
        <h3>My Medical Records</h3>
        <button onClick={loadRecords}>Load Records</button>
        {records.length > 0 && (
          <div className="records-list">
            {records.map((r, i) => (
              <div key={i} className="record-item">
                <div><strong>ID:</strong> {r.recordId.toString()}</div>
                <div><strong>Type:</strong> {r.typeName}</div>
                <div><strong>Description:</strong> {r.description}</div>
                <div>
                  <strong>File:</strong>{" "}
                  <a href={getIPFSUrl(r.ipfsHash)} target="_blank" rel="noreferrer">
                    View on IPFS
                  </a>
                </div>
                <div><strong>Hash:</strong> <span style={{fontFamily:"monospace", fontSize:"11px"}}>{r.ipfsHash}</span></div>
                <div><strong>Status:</strong> {r.isValid ? "Valid" : "Retracted"}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Doctor Access Requests</h3>
        <button onClick={loadPendingRequests}>Load Pending Requests</button>
        {pendingRequests.length > 0 && (
          <div className="records-list">
            {pendingRequests.map((req, i) => (
              <div key={i} className="record-item">
                <div><strong>Request ID:</strong> {req.id}</div>
                <div><strong>Doctor:</strong> <span style={{fontFamily:"monospace", fontSize:"11px"}}>{req.doctor}</span></div>
                <div><strong>Purpose:</strong> {req.purpose}</div>
                <div className="btn-row" style={{marginTop:"8px"}}>
                  <button onClick={() => approveRequest(req.id)} style={{fontSize:"13px", padding:"6px 14px"}}>
                    Approve (30 days)
                  </button>
                  <button onClick={() => rejectRequest(req.id)} className="secondary" style={{fontSize:"13px", padding:"6px 14px", color:"#D85A30", borderColor:"#D85A30"}}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}