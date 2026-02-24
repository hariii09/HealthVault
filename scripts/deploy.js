const { ethers } = require("hardhat");

async function main() {
  const HealthVault = await ethers.getContractFactory("HealthVault");
  const contract = await HealthVault.deploy();

  await contract.deployed();

  console.log("HealthVault deployed to:", contract.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});