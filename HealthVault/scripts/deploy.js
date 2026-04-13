const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  console.log("\n1. Deploying PatientRegistry...");
  const PatientRegistry = await hre.ethers.getContractFactory("PatientRegistry");
  const patientRegistry = await PatientRegistry.deploy();
  await patientRegistry.deployed();
  console.log("   PatientRegistry deployed to:", patientRegistry.address);

  console.log("\n2. Deploying AccessControl...");
  const AccessControl = await hre.ethers.getContractFactory("AccessControl");
  const accessControl = await AccessControl.deploy(patientRegistry.address);
  await accessControl.deployed();
  console.log("   AccessControl deployed to:", accessControl.address);

  console.log("\n3. Deploying RecordRegistry...");
  const RecordRegistry = await hre.ethers.getContractFactory("RecordRegistry");
  const recordRegistry = await RecordRegistry.deploy(
    patientRegistry.address,
    accessControl.address
  );
  await recordRegistry.deployed();
  console.log("   RecordRegistry deployed to:", recordRegistry.address);

  console.log("\n4. Deploying EmergencyAccess...");
  const EmergencyAccess = await hre.ethers.getContractFactory("EmergencyAccess");
  const emergencyAccess = await EmergencyAccess.deploy(patientRegistry.address);
  await emergencyAccess.deployed();
  console.log("   EmergencyAccess deployed to:", emergencyAccess.address);

  console.log("\n========== DEPLOYMENT COMPLETE ==========");
  console.log("PatientRegistry: ", patientRegistry.address);
  console.log("AccessControl:   ", accessControl.address);
  console.log("RecordRegistry:  ", recordRegistry.address);
  console.log("EmergencyAccess: ", emergencyAccess.address);
  console.log("=========================================");
  console.log("Save these addresses for the frontend!");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
