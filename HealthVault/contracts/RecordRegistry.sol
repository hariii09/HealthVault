// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./PatientRegistry.sol";
import "./AccessControl.sol";

/// @title RecordRegistry
/// @notice Stores IPFS content hashes of encrypted medical records on-chain.
///         The actual file lives on IPFS (encrypted with the patient's public key).
///         The blockchain only holds the hash, metadata, and who uploaded it.
///         Only authorised doctors (approved via AccessControl) or the patient
///         themselves may read the record index.
contract RecordRegistry {

    // ─── Structs ────────────────────────────────────────────────────────────

    enum RecordType { Lab, Prescription, Imaging, Discharge, Vaccination, Other }

    struct MedicalRecord {
        uint256     recordId;
        address     patient;
        address     uploadedBy;   // doctor or hospital wallet
        string      ipfsHash;     // CIDv1 content address on IPFS
        RecordType  recordType;
        string      description;  // short plain-text label
        uint256     uploadedAt;
        bool        isValid;      // false if record was retracted
    }

    // ─── State ──────────────────────────────────────────────────────────────

    PatientRegistry private registry;
    AccessControl   private accessControl;

    uint256 private recordCounter;

    /// @dev recordId → MedicalRecord
    mapping(uint256 => MedicalRecord) private records;

    /// @dev patient address → list of their record IDs
    mapping(address => uint256[]) private patientRecords;

    /// @dev ipfsHash → recordId (prevent duplicate uploads)
    mapping(string => uint256) private hashToRecord;

    // ─── Events ─────────────────────────────────────────────────────────────

    event RecordUploaded(
        uint256 indexed recordId,
        address indexed patient,
        address indexed uploadedBy,
        string  ipfsHash,
        RecordType recordType,
        uint256 timestamp
    );

    event RecordRetracted(
        uint256 indexed recordId,
        address indexed patient,
        uint256 timestamp
    );

    // ─── Constructor ────────────────────────────────────────────────────────

    constructor(address _registryAddr, address _accessControlAddr) {
        registry      = PatientRegistry(_registryAddr);
        accessControl = AccessControl(_accessControlAddr);
    }

    // ─── Modifiers ──────────────────────────────────────────────────────────

    modifier onlyRegisteredPatient(address _addr) {
        require(registry.isRegistered(_addr), "Not a registered patient");
        _;
    }

    /// @dev Caller must be the patient OR a doctor with valid access
    modifier onlyAuthorised(address _patient) {
        bool isSelf   = (msg.sender == _patient);
        bool hasAccess = accessControl.hasValidAccess(msg.sender, _patient);
        require(isSelf || hasAccess, "Not authorised to access this patient's records");
        _;
    }

    // ─── Write Functions ────────────────────────────────────────────────────

    /// @notice Upload a new medical record for a patient.
    ///         Can be called by the patient themselves or an authorised doctor.
    /// @param _patient      Patient wallet address
    /// @param _ipfsHash     IPFS CID of the encrypted file
    /// @param _recordType   Enum category of the record
    /// @param _description  Short label e.g. "Blood panel 2024-04"
    function uploadRecord(
        address    _patient,
        string     calldata _ipfsHash,
        RecordType _recordType,
        string     calldata _description
    )
        external
        onlyRegisteredPatient(_patient)
        onlyAuthorised(_patient)
        returns (uint256 recordId)
    {
        require(bytes(_ipfsHash).length > 0,     "IPFS hash required");
        require(hashToRecord[_ipfsHash] == 0,    "Record already uploaded");

        recordCounter++;
        recordId = recordCounter;

        records[recordId] = MedicalRecord({
            recordId:    recordId,
            patient:     _patient,
            uploadedBy:  msg.sender,
            ipfsHash:    _ipfsHash,
            recordType:  _recordType,
            description: _description,
            uploadedAt:  block.timestamp,
            isValid:     true
        });

        patientRecords[_patient].push(recordId);
        hashToRecord[_ipfsHash] = recordId;

        emit RecordUploaded(recordId, _patient, msg.sender, _ipfsHash, _recordType, block.timestamp);
    }

    /// @notice Patient can retract (invalidate) a record — does NOT delete
    ///         from IPFS, just marks it as invalid on-chain so UIs can hide it.
    function retractRecord(uint256 _recordId) external {
        MedicalRecord storage r = records[_recordId];
        require(r.patient == msg.sender,  "Only the patient can retract");
        require(r.isValid,                "Already retracted");
        r.isValid = false;
        emit RecordRetracted(_recordId, msg.sender, block.timestamp);
    }

    // ─── Read Functions ─────────────────────────────────────────────────────

    /// @notice Get a single record (caller must be patient or authorised doctor)
    function getRecord(uint256 _recordId)
        external
        view
        onlyAuthorised(records[_recordId].patient)
        returns (MedicalRecord memory)
    {
        return records[_recordId];
    }

    /// @notice Get all record IDs for a patient
    function getPatientRecordIds(address _patient)
        external
        view
        onlyAuthorised(_patient)
        returns (uint256[] memory)
    {
        return patientRecords[_patient];
    }

    /// @notice Verify a record's integrity: check that an IPFS hash matches
    ///         what is stored on-chain (anyone can call this — public trust).
    function verifyRecord(uint256 _recordId, string calldata _ipfsHash)
        external
        view
        returns (bool isMatch, bool isValid)
    {
        MedicalRecord storage r = records[_recordId];
        isMatch = keccak256(bytes(r.ipfsHash)) == keccak256(bytes(_ipfsHash));
        isValid = r.isValid;
    }

    /// @notice Total records ever uploaded (across all patients)
    function totalRecords() external view returns (uint256) {
        return recordCounter;
    }
}
