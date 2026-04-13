import { useState } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES } from "../contracts/config";
import AccessControlABI from "../contracts/AccessControl.json";
import RecordRegistryABI from "../contracts/RecordRegistry.json";

export default function DoctorDashboard({ signer, account }) {
  const [patientAddress, setPatientAddress] = useState("");
  const [purpose, setPurpose] = useState("");
  const [status, setStatus] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [records, setRecords] = useState([]);

  const getAccessControl = () => new ethers.Contract(
    CONTRACT_ADDRESSES.AccessControl,
    AccessControlABI.abi,
    signer
  );

  const getRecordRegistry = () => new ethers.Contract(
    CONTRACT_ADDRESSES.RecordRegistry,
    RecordRegistryABI.abi,
    signer
  );

  const requestAccess = async () => {
    try {
      setStatus("Sending access request... confirm in MetaMask");
      const contract = getAccessControl();
      const tx = await contract.requestAccess(patientAddress, purpose);
      await tx.wait();
      setStatus("Access request sent! Waiting for patient approval.");
    } catch (err) {
      setStatus("Error: " + (err.reason || err.message));
    }
  };

  const checkAccess = async () => {
    try {
      const contract = getAccessControl();
      const result = await contract.hasValidAccess(account, patientAddress);
      setHasAccess(result);
      setStatus(result ? "You have valid access!" : "No valid access.");
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  };

  const viewRecords = async () => {
    try {
      setStatus("Loading patient records...");
      const contract = getRecordRegistry();
      const ids = await contract.getPatientRecordIds(patientAddress);
      const loaded = [];
      const recordTypes = ["Lab", "Prescription", "Imaging", "Discharge", "Vaccination", "Other"];
      for (let id of ids) {
        const record = await contract.getRecord(id);
        loaded.push({ ...record, typeName: recordTypes[record.recordType] });
      }
      setRecords(loaded);
      setStatus("");
    } catch (err) {
      setStatus("Error: " + (err.reason || err.message));
    }
  };

  return (
    <div className="dashboard">
      <h2>Doctor Dashboard</h2>
      <p className="account-info">Connected: {account.slice(0,6)}...{account.slice(-4)}</p>

      {status && <div className="status-box">{status}</div>}

      <div className="card">
        <h3>Request Patient Access</h3>
        <input
          placeholder="Patient Wallet Address (0x...)"
          value={patientAddress}
          onChange={e => setPatientAddress(e.target.value)}
        />
        <input
          placeholder="Purpose e.g. Cardiology consultation"
          value={purpose}
          onChange={e => setPurpose(e.target.value)}
        />
        <div className="btn-row">
          <button onClick={requestAccess}>Request Access</button>
          <button onClick={checkAccess} className="secondary">Check Access</button>
        </div>
        {hasAccess && (
          <button onClick={viewRecords} style={{marginTop: "12px", background: "#1D9E75"}}>
            View Patient Records
          </button>
        )}
      </div>

      {records.length > 0 && (
        <div className="card">
          <h3>Patient Records</h3>
          <div className="records-list">
            {records.map((r, i) => (
              <div key={i} className="record-item">
                <div><strong>ID:</strong> {r.recordId.toString()}</div>
                <div><strong>Type:</strong> {r.typeName}</div>
                <div><strong>Description:</strong> {r.description}</div>
                <div><strong>IPFS:</strong> <a href={`https://ipfs.io/ipfs/${r.ipfsHash}`} target="_blank" rel="noreferrer">{r.ipfsHash.slice(0,20)}...</a></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}