import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  const treasury = process.env.TREASURY_ADDRESS || deployer.address;

  // 1. Deploy OracleResolver
  console.log("\n1. Deploying OracleResolver...");
  const OracleResolver = await ethers.getContractFactory("OracleResolver");
  const oracleResolver = await OracleResolver.deploy();
  await oracleResolver.waitForDeployment();
  const oracleAddress = await oracleResolver.getAddress();
  console.log("   OracleResolver:", oracleAddress);

  // 2. Deploy PredictionMarket
  console.log("\n2. Deploying PredictionMarket...");
  const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
  const predictionMarket = await PredictionMarket.deploy(oracleAddress, treasury);
  await predictionMarket.waitForDeployment();
  const marketAddress = await predictionMarket.getAddress();
  console.log("   PredictionMarket:", marketAddress);

  // 3. Wire up: tell OracleResolver about PredictionMarket
  console.log("\n3. Wiring OracleResolver → PredictionMarket...");
  const tx = await oracleResolver.setPredictionMarket(marketAddress);
  await tx.wait();
  console.log("   Done.");

  // 4. Register oracle node(s) — deployer on local Hardhat, or env override
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const oracleNode =
    process.env.ORACLE_NODE_ADDRESS?.trim() ||
    (chainId === 31337 ? deployer.address : "");

  if (oracleNode) {
    console.log("\n4. Registering oracle node...");
    const tx2 = await oracleResolver.registerOracle(oracleNode, 0); // SPEECH type
    await tx2.wait();
    console.log("   Registered:", oracleNode);
  } else {
    console.log(
      "\n4. Skipping oracle registration — set ORACLE_NODE_ADDRESS for testnets.",
    );
  }

  // 5. Save deployment artifacts
  const deployment = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    treasury,
    contracts: {
      OracleResolver: oracleAddress,
      PredictionMarket: marketAddress,
    },
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const payload = JSON.stringify(deployment, null, 2);
  const outFile = path.join(outDir, `${deployment.chainId}.json`);
  fs.writeFileSync(outFile, payload);
  console.log("\nDeployment saved to:", outFile);

  if (deployment.chainId === 31337) {
    const localAlias = path.join(outDir, "deployment.local.json");
    fs.writeFileSync(localAlias, payload);
    console.log("   Local alias:", localAlias);
  }
  console.log("\n✅ Deployment complete!");
  console.log("   OracleResolver:", oracleAddress);
  console.log("   PredictionMarket:", marketAddress);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
