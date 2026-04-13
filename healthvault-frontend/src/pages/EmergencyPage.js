import { useState } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES } from "../contracts/config";
import EmergencyAccessABI from "../contracts/EmergencyAccess.json";

export default function EmergencyPage({ signer, account }) {
  const [patientAddress, setPatientAddress] = useState("");
  const [responderAddress, setResponderAddress] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");

  const getEmergencyContract = () => new ethers.Contract(
    CONTRACT_ADDRESSES.EmergencyAccess,
    EmergencyAccessABI.abi,
    signer
  );

  const addResponder = async () => {
    try {
      setStatus("Adding trusted responder... confirm in MetaMask");
      const contract = getEmergencyContract();
      const tx = await contract.addTrustedResponder(responderAddress);
      await tx.wait();
      setStatus("Trusted responder added successfully!");
    } catch (err) {
      setStatus("Error: " + (err.reason || err.message));
    }
  };

  const invokeEmergency = async () => {
    try {
      setStatus("Invoking emergency access... confirm in MetaMask");
      const contract = getEmergencyContract();
      const tx = await contract.invokeEmergencyAccess(patientAddress, reason);
      await tx.wait();
      setStatus("Emergency access invoked! Valid for 6 hours. Logged on-chain permanently.");
    } catch (err) {
      setStatus("Error: " + (err.reason || err.message));
    }
  };

  const checkEmergencyAccess = async () => {
    try {
      const contract = getEmergencyContract();
      const result = await contract.hasEmergencyAccess(account, patientAddress);
      setStatus(result ? "Active emergency access exists." : "No active emergency access.");
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  };

  return (
    <div className="dashboard">
      <h2>Emergency Access</h2>
      <p className="account-info">Connected: {account.slice(0,6)}...{account.slice(-4)}</p>

      {status && <div className="status-box">{status}</div>}

      <div className="card" style={{borderLeft: "4px solid #1D9E75"}}>
        <h3>Add Trusted Responder (Patient action)</h3>
        <p style={{fontSize:"13px", color:"#666"}}>As a patient, pre-authorise an emergency responder such as a hospital ER.</p>
        <input
          placeholder="Responder Wallet Address (0x...)"
          value={responderAddress}
          onChange={e => setResponderAddress(e.target.value)}
        />
        <button onClick={addResponder}>Add Trusted Responder</button>
      </div>

      <div className="card" style={{borderLeft: "4px solid #D85A30"}}>
        <h3>Invoke Emergency Access (Responder action)</h3>
        <p style={{fontSize:"13px", color:"#666"}}>Access is time-limited to 6 hours and permanently logged on-chain.</p>
        <input
          placeholder="Patient Wallet Address (0x...)"
          value={patientAddress}
          onChange={e => setPatientAddress(e.target.value)}
        />
        <input
          placeholder="Reason e.g. Cardiac arrest — ER admission"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className="btn-row">
          <button onClick={invokeEmergency} style={{background:"#D85A30"}}>Invoke Emergency Access</button>
          <button onClick={checkEmergencyAccess} className="secondary">Check Access Status</button>
        </div>
      </div>
    </div>
  );
}