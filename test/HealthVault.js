const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HealthVault", function () {
  let contract;
  let patient;
  let provider;

  beforeEach(async function () {
    [patient, provider] = await ethers.getSigners();

    const HealthVault = await ethers.getContractFactory("HealthVault");
    contract = await HealthVault.deploy();
    await contract.waitForDeployment();
  });

  it("Should register patient and provider correctly", async function () {
    await contract.connect(patient).registerPatient();
    await contract.connect(provider).registerProvider();

    const patientData = await contract.patients(patient.address);
    const providerData = await contract.providers(provider.address);

    expect(patientData.isRegistered).to.equal(true);
    expect(providerData.isRegistered).to.equal(true);
  });

  it("Should allow patient to add record", async function () {
    await contract.connect(patient).registerPatient();

    await contract.connect(patient).addRecord(
      "QmCID",
      "MRI Report"
    );

    const record = await contract.records(1);

    expect(record.owner).to.equal(patient.address);
    expect(record.cid).to.equal("QmCID");
  });

  it("Should grant and verify access correctly", async function () {
    await contract.connect(patient).registerPatient();
    await contract.connect(provider).registerProvider();

    await contract.connect(patient).addRecord(
      "QmCID",
      "Blood Test"
    );

    await contract.connect(patient).grantAccess(
      1,
      provider.address,
      3600
    );

    const result = await contract.connect(provider).verifyAccess(1);

    expect(result).to.equal("QmCID");
  });

  it("Should revoke access correctly", async function () {
    await contract.connect(patient).registerPatient();
    await contract.connect(provider).registerProvider();

    await contract.connect(patient).addRecord(
      "QmCID",
      "X-Ray"
    );

    await contract.connect(patient).grantAccess(
      1,
      provider.address,
      3600
    );

    await contract.connect(patient).revokeAccess(
      1,
      provider.address
    );

    await expect(
      contract.connect(provider).verifyAccess(1)
    ).to.be.revertedWith("No active consent");
  });

  it("Should block expired consent", async function () {
    await contract.connect(patient).registerPatient();
    await contract.connect(provider).registerProvider();

    await contract.connect(patient).addRecord(
      "QmCID",
      "ECG"
    );

    await contract.connect(patient).grantAccess(
      1,
      provider.address,
      1
    );

    // Move time forward
    await ethers.provider.send("evm_increaseTime", [2]);
    await ethers.provider.send("evm_mine");

    await expect(
      contract.connect(provider).verifyAccess(1)
    ).to.be.revertedWith("Consent expired");
  });
});