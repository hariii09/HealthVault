// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract HealthVault {

    struct Patient {
        bool isRegistered;
    }

    struct Provider {
        bool isRegistered;
    }

    struct Record {
        uint256 id;
        address owner;
        string cid;
        string recordType;
        uint256 timestamp;
    }

    struct Consent {
        bool active;
        uint256 expiry;
    }

    uint256 private recordCounter;

    mapping(address => Patient) public patients;
    mapping(address => Provider) public providers;
    mapping(uint256 => Record) public records;
    mapping(uint256 => mapping(address => Consent)) public consents;

    event PatientRegistered(address indexed patient);
    event ProviderRegistered(address indexed provider);
    event RecordAdded(uint256 indexed recordId, address indexed owner);
    event AccessGranted(uint256 indexed recordId, address indexed provider, uint256 expiry);
    event AccessRevoked(uint256 indexed recordId, address indexed provider);

    modifier onlyPatient() {
        require(patients[msg.sender].isRegistered, "Not a registered patient");
        _;
    }

    modifier onlyProvider() {
        require(providers[msg.sender].isRegistered, "Not a registered provider");
        _;
    }

    function registerPatient() external {
        require(!patients[msg.sender].isRegistered, "Already registered");
        require(!providers[msg.sender].isRegistered, "Already registered");

        patients[msg.sender] = Patient(true);
        emit PatientRegistered(msg.sender);
    }

    function registerProvider() external {
        require(!providers[msg.sender].isRegistered, "Already registered");
        require(!patients[msg.sender].isRegistered, "Already registered");

        providers[msg.sender] = Provider(true);
        emit ProviderRegistered(msg.sender);
    }

    function addRecord(string memory _cid, string memory _recordType)
        external
        onlyPatient
    {
        require(bytes(_cid).length > 0, "CID required");
        require(bytes(_recordType).length > 0, "Record type required");

        recordCounter++;

        records[recordCounter] = Record({
            id: recordCounter,
            owner: msg.sender,
            cid: _cid,
            recordType: _recordType,
            timestamp: block.timestamp
        });

        emit RecordAdded(recordCounter, msg.sender);
    }

    function grantAccess(
        uint256 _recordId,
        address _provider,
        uint256 _durationInSeconds
    )
        external
        onlyPatient
    {
        require(records[_recordId].owner == msg.sender, "Not record owner");
        require(providers[_provider].isRegistered, "Provider not registered");
        require(_durationInSeconds > 0, "Invalid duration");

        uint256 expiryTime = block.timestamp + _durationInSeconds;

        consents[_recordId][_provider] = Consent({
            active: true,
            expiry: expiryTime
        });

        emit AccessGranted(_recordId, _provider, expiryTime);
    }

    function revokeAccess(uint256 _recordId, address _provider)
        external
        onlyPatient
    {
        require(records[_recordId].owner == msg.sender, "Not record owner");
        require(consents[_recordId][_provider].active, "No active consent");

        consents[_recordId][_provider].active = false;

        emit AccessRevoked(_recordId, _provider);
    }

    function verifyAccess(uint256 _recordId)
        external
        view
        onlyProvider
        returns (string memory)
    {
        Consent memory consent = consents[_recordId][msg.sender];

        require(consent.active, "No active consent");
        require(block.timestamp <= consent.expiry, "Consent expired");

        return records[_recordId].cid;
    }
}