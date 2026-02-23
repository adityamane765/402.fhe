// (base) adityamane@Adityas-MacBook-Air-2 contracts % npx hardhat run scripts/deploy.ts --network sepolia
// Compiled 2 Solidity files successfully (evm target: paris).
// Deploying 402.fhe with deployer: 0xd5720Ed6e70a128C025D0C284874cd1e33B39688
// waiting for confirmations...
// marketplace Address: 0x4Ff4a147f6e052398B8C0962c6cd4Fa4f34d2826
// Setting middleware to: 0xd5720Ed6e70a128C025D0C284874cd1e33B39688
// Middleware set successfully
// saved in deployments/sepolia.json

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const [deployer] = await ethers.getSigners();
  console.log("Deploying 402.fhe with deployer:", deployer.address);

  const Marketplace = await ethers.getContractFactory("FHE402Marketplace");
  const marketplace = await Marketplace.deploy(usdcAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  const tx = marketplace.deploymentTransaction();
  if (tx && tx.hash) {
    console.log("waiting for confirmations...");
    await tx.wait(2);
  }

  console.log("marketplace Address:", marketplaceAddress);
  const middlewareAddress = process.env.MIDDLEWARE_ADDRESS || deployer.address;
  console.log("Setting middleware to:", middlewareAddress);
  const setMiddlewareTx = await marketplace.setMiddleware(middlewareAddress);
  await setMiddlewareTx.wait();
  console.log("Middleware set successfully");

  const deploymentInfo = {
    FHE402Marketplace: marketplaceAddress,
    middleware: middlewareAddress,
    usdc: usdcAddress,
    network: "sepolia",
    deployedAt: new Date().toISOString(),
  };
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  fs.writeFileSync(
    path.join(deploymentsDir, "sepolia.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("saved in deployments/sepolia.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
