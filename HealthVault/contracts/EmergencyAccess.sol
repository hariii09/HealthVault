// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./PatientRegistry.sol";

/// @title EmergencyAccess
/// @notice Allows pre-authorised emergency responders to access patient
///         records without waiting for patient approval — but with a
///         strict time limit and a fully public on-chain log.
///         Patients pre-register trusted emergency contacts / hospitals.
///         Every emergency access event is permanently visible on-chain.
contract EmergencyAccess {

    // ─── State ──────────────────────────────────────────────────────────────

    PatientRegistry private registry;

    /// @dev Emergency access duration: 6 hours
    uint256 public constant EMERGENCY_DURATION = 6 hours;

    /// @dev patient → set of pre-approved emergency responder addresses
    mapping(address => mapping(address => bool)) private trustedResponders;

    struct EmergencyEvent {
        uint256 eventId;
        address responder;
        address patient;
        uint256 accessedAt;
        uint256 expiresAt;
        string  reason;      // e.g. "Cardiac arrest — ER admission"
        bool    isActive;
    }

    uint256 private eventCounter;
    mapping(uint256 => EmergencyEvent) private events;

    /// @dev responder → patient → latest eventId
    mapping(address => mapping(address => uint256)) private activeEvent;

    // ─── Events ─────────────────────────────────────────────────────────────

    event ResponderTrusted  (address indexed patient, address indexed responder, uint256 timestamp);
    event ResponderRemoved  (address indexed patient, address indexed responder, uint256 timestamp);
    event EmergencyAccessed (uint256 indexed eventId, address indexed responder, address indexed patient, string reason, uint256 expiresAt);
    event EmergencyExpired  (uint256 indexed eventId, uint256 timestamp);

    // ─── Constructor ────────────────────────────────────────────────────────

    constructor(address _registryAddr) {
        registry = PatientRegistry(_registryAddr);
    }

    // ─── Patient: Manage Trusted Responders ─────────────────────────────────

    /// @notice Patient pre-authorises an emergency responder (e.g. a hospital ER)
    function addTrustedResponder(address _responder) external {
        require(registry.isRegistered(msg.sender), "Not a registered patient");
        require(_responder != msg.sender,           "Cannot add yourself");
        trustedResponders[msg.sender][_responder] = true;
        emit ResponderTrusted(msg.sender, _responder, block.timestamp);
    }

    /// @notice Patient removes a previously trusted responder
    function removeTrustedResponder(address _responder) external {
        trustedResponders[msg.sender][_responder] = false;
        emit ResponderRemoved(msg.sender, _responder, block.timestamp);
    }

    /// @notice Check if a responder is trusted by a patient
    function isTrustedResponder(address _patient, address _responder) external view returns (bool) {
        return trustedResponders[_patient][_responder];
    }

    // ─── Emergency Responder: Invoke Emergency Access ────────────────────────

    /// @notice Invoke emergency access to a patient's records.
    ///         Caller must be a pre-approved trusted responder.
    ///         Access is time-limited to 6 hours and logged forever.
    function invokeEmergencyAccess(address _patient, string calldata _reason)
        external
        returns (uint256 eventId)
    {
        require(registry.isRegistered(_patient),          "Patient not registered");
        require(trustedResponders[_patient][msg.sender],  "Not a trusted responder for this patient");
        require(bytes(_reason).length > 0,                "Reason required");

        eventCounter++;
        eventId = eventCounter;

        uint256 expiry = block.timestamp + EMERGENCY_DURATION;

        events[eventId] = EmergencyEvent({
            eventId:    eventId,
            responder:  msg.sender,
            patient:    _patient,
            accessedAt: block.timestamp,
            expiresAt:  expiry,
            reason:     _reason,
            isActive:   true
        });

        activeEvent[msg.sender][_patient] = eventId;

        emit EmergencyAccessed(eventId, msg.sender, _patient, _reason, expiry);
    }

    // ─── View Functions ─────────────────────────────────────────────────────

    /// @notice Check if a responder currently has valid emergency access
    function hasEmergencyAccess(address _responder, address _patient) external view returns (bool) {
        uint256 eid = activeEvent[_responder][_patient];
        if (eid == 0) return false;
        EmergencyEvent storage e = events[eid];
        return (e.isActive && block.timestamp < e.expiresAt);
    }

    /// @notice Get details of an emergency event (fully public — transparency by design)
    function getEmergencyEvent(uint256 _eventId) external view returns (EmergencyEvent memory) {
        return events[_eventId];
    }

    /// @notice Total emergency access events ever invoked
    function totalEvents() external view returns (uint256) {
        return eventCounter;
    }
}
