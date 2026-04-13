// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./PatientRegistry.sol";

/// @title AccessControl
/// @notice Manages doctor access requests to patient records.
///         Doctors request access → patient approves/rejects on-chain →
///         access auto-expires after a set duration.
///         Every action is permanently logged via events.
contract AccessControl {

    // ─── Structs ────────────────────────────────────────────────────────────

    enum AccessStatus { Pending, Approved, Rejected, Expired }

    struct AccessRequest {
        address doctor;
        address patient;
        uint256 requestedAt;
        uint256 approvedAt;
        uint256 expiresAt;       // 0 if not yet approved
        AccessStatus status;
        string  purpose;         // e.g. "Cardiology consultation"
    }

    // ─── State ──────────────────────────────────────────────────────────────

    PatientRegistry private registry;

    /// @dev Unique request ID counter
    uint256 private requestCounter;

    /// @dev requestId → AccessRequest
    mapping(uint256 => AccessRequest) private requests;

    /// @dev patient → doctor → latest requestId (for quick lookup)
    mapping(address => mapping(address => uint256)) private latestRequest;

    /// @dev All request IDs for a given patient (for enumeration)
    mapping(address => uint256[]) private patientRequests;

    /// @dev All request IDs made by a given doctor
    mapping(address => uint256[]) private doctorRequests;

    /// @dev Default access duration: 30 days
    uint256 public constant DEFAULT_ACCESS_DURATION = 30 days;

    // ─── Events ─────────────────────────────────────────────────────────────

    event AccessRequested(uint256 indexed requestId, address indexed doctor, address indexed patient, string purpose, uint256 timestamp);
    event AccessApproved (uint256 indexed requestId, address indexed doctor, address indexed patient, uint256 expiresAt);
    event AccessRejected (uint256 indexed requestId, address indexed doctor, address indexed patient, uint256 timestamp);
    event AccessRevoked  (uint256 indexed requestId, address indexed doctor, address indexed patient, uint256 timestamp);

    // ─── Constructor ────────────────────────────────────────────────────────

    constructor(address _registryAddress) {
        registry = PatientRegistry(_registryAddress);
    }

    // ─── Modifiers ──────────────────────────────────────────────────────────

    modifier onlyRegisteredPatient(address _addr) {
        require(registry.isRegistered(_addr), "Not a registered patient");
        _;
    }

    modifier onlyPendingRequest(uint256 _requestId) {
        require(requests[_requestId].status == AccessStatus.Pending, "Request is not pending");
        _;
    }

    modifier onlyPatientOfRequest(uint256 _requestId) {
        require(requests[_requestId].patient == msg.sender, "Not the patient for this request");
        _;
    }

    // ─── Doctor Actions ─────────────────────────────────────────────────────

    /// @notice Doctor requests access to a patient's records
    /// @param _patient  Address of the patient
    /// @param _purpose  Plain-text reason (e.g. "Pre-surgery review")
    function requestAccess(
        address _patient,
        string calldata _purpose
    ) external onlyRegisteredPatient(_patient) returns (uint256 requestId) {
        require(msg.sender != _patient, "Cannot request access to own records");

        requestCounter++;
        requestId = requestCounter;

        requests[requestId] = AccessRequest({
            doctor:      msg.sender,
            patient:     _patient,
            requestedAt: block.timestamp,
            approvedAt:  0,
            expiresAt:   0,
            status:      AccessStatus.Pending,
            purpose:     _purpose
        });

        latestRequest[_patient][msg.sender] = requestId;
        patientRequests[_patient].push(requestId);
        doctorRequests[msg.sender].push(requestId);

        emit AccessRequested(requestId, msg.sender, _patient, _purpose, block.timestamp);
    }

    // ─── Patient Actions ────────────────────────────────────────────────────

    /// @notice Patient approves a pending access request
    /// @param _requestId     The request to approve
    /// @param _durationSecs  How long to grant access (0 = use default 30 days)
    function approveAccess(uint256 _requestId, uint256 _durationSecs)
        external
        onlyPendingRequest(_requestId)
        onlyPatientOfRequest(_requestId)
    {
        uint256 duration = _durationSecs == 0 ? DEFAULT_ACCESS_DURATION : _durationSecs;
        uint256 expiry   = block.timestamp + duration;

        AccessRequest storage req = requests[_requestId];
        req.status     = AccessStatus.Approved;
        req.approvedAt = block.timestamp;
        req.expiresAt  = expiry;

        emit AccessApproved(_requestId, req.doctor, req.patient, expiry);
    }

    /// @notice Patient rejects a pending access request
    function rejectAccess(uint256 _requestId)
        external
        onlyPendingRequest(_requestId)
        onlyPatientOfRequest(_requestId)
    {
        AccessRequest storage req = requests[_requestId];
        req.status = AccessStatus.Rejected;
        emit AccessRejected(_requestId, req.doctor, req.patient, block.timestamp);
    }

    /// @notice Patient revokes a previously approved access at any time
    function revokeAccess(uint256 _requestId) external onlyPatientOfRequest(_requestId) {
        AccessRequest storage req = requests[_requestId];
        require(req.status == AccessStatus.Approved, "Access not currently approved");
        req.status    = AccessStatus.Expired;
        req.expiresAt = block.timestamp; // mark as expired now
        emit AccessRevoked(_requestId, req.doctor, req.patient, block.timestamp);
    }

    // ─── View Functions ─────────────────────────────────────────────────────

    /// @notice Check if a doctor currently has valid (approved + not expired) access
    function hasValidAccess(address _doctor, address _patient) external view returns (bool) {
        uint256 rid = latestRequest[_patient][_doctor];
        if (rid == 0) return false;
        AccessRequest storage req = requests[rid];
        return (
            req.status    == AccessStatus.Approved &&
            block.timestamp < req.expiresAt
        );
    }

    /// @notice Get full details of a request
    function getRequest(uint256 _requestId) external view returns (AccessRequest memory) {
        return requests[_requestId];
    }

    /// @notice Get all request IDs for a patient (so they can review pending requests)
    function getPatientRequests(address _patient) external view returns (uint256[] memory) {
        return patientRequests[_patient];
    }

    /// @notice Get all request IDs made by a doctor
    function getDoctorRequests(address _doctor) external view returns (uint256[] memory) {
        return doctorRequests[_doctor];
    }
}
