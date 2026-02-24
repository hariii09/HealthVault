const { ethers } = require("hardhat");

async function main() {
  const HealthVault = await ethers.getContractFactory("HealthVault");
  const contract = await HealthVault.deploy();

  await contract.waitForDeployment();

  console.log("HealthVault deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});