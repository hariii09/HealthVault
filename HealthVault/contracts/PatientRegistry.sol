// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title PatientRegistry
/// @notice Registers patients on-chain. Each patient is identified by their
///         Ethereum wallet address. Only the patient themselves can register
///         or update their own profile.
contract PatientRegistry {

    // ─── Structs ────────────────────────────────────────────────────────────

    struct Patient {
        address walletAddress;
        string  name;           // stored off-chain in production; here for demo
        uint256 dateOfBirth;    // Unix timestamp
        string  bloodType;      // e.g. "O+"
        bool    isRegistered;
        uint256 registeredAt;   // block timestamp of registration
    }

    // ─── State ──────────────────────────────────────────────────────────────

    /// @dev Maps patient wallet address → Patient struct
    mapping(address => Patient) private patients;

    /// @dev All registered patient addresses (for enumeration)
    address[] private patientAddresses;

    // ─── Events ─────────────────────────────────────────────────────────────

    event PatientRegistered(address indexed patient, uint256 timestamp);
    event PatientUpdated(address indexed patient, uint256 timestamp);

    // ─── Modifiers ──────────────────────────────────────────────────────────

    modifier onlyUnregistered() {
        require(!patients[msg.sender].isRegistered, "Already registered");
        _;
    }

    modifier onlyRegistered(address _addr) {
        require(patients[_addr].isRegistered, "Patient not registered");
        _;
    }

    // ─── Functions ──────────────────────────────────────────────────────────

    /// @notice Register yourself as a patient
    /// @param _name        Full name (keep minimal in production — use IPFS)
    /// @param _dateOfBirth Unix timestamp of date of birth
    /// @param _bloodType   Blood type string e.g. "A+"
    function register(
        string calldata _name,
        uint256 _dateOfBirth,
        string calldata _bloodType
    ) external onlyUnregistered {
        patients[msg.sender] = Patient({
            walletAddress: msg.sender,
            name:          _name,
            dateOfBirth:   _dateOfBirth,
            bloodType:     _bloodType,
            isRegistered:  true,
            registeredAt:  block.timestamp
        });

        patientAddresses.push(msg.sender);
        emit PatientRegistered(msg.sender, block.timestamp);
    }

    /// @notice Update your own profile fields
    function updateProfile(
        string calldata _name,
        string calldata _bloodType
    ) external onlyRegistered(msg.sender) {
        Patient storage p = patients[msg.sender];
        p.name      = _name;
        p.bloodType = _bloodType;
        emit PatientUpdated(msg.sender, block.timestamp);
    }

    /// @notice Check whether an address is a registered patient
    function isRegistered(address _addr) external view returns (bool) {
        return patients[_addr].isRegistered;
    }

    /// @notice Fetch a patient's basic profile (only the patient or an
    ///         authorised caller should call this — enforce in AccessControl)
    function getPatient(address _addr)
        external
        view
        onlyRegistered(_addr)
        returns (
            address walletAddress,
            string memory name,
            uint256 dateOfBirth,
            string memory bloodType,
            uint256 registeredAt
        )
    {
        Patient storage p = patients[_addr];
        return (p.walletAddress, p.name, p.dateOfBirth, p.bloodType, p.registeredAt);
    }

    /// @notice Total number of registered patients
    function totalPatients() external view returns (uint256) {
        return patientAddresses.length;
    }
}
