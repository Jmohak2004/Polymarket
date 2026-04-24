import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  PredictionMarket,
  OracleResolver,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("PredictionMarket + OracleResolver", () => {
  let predictionMarket: PredictionMarket;
  let oracleResolver: OracleResolver;
  let owner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let oracle1: HardhatEthersSigner;
  let oracle2: HardhatEthersSigner;
  let oracle3: HardhatEthersSigner;

  const CREATION_FEE = ethers.parseEther("0.001");
  const MIN_BET = ethers.parseEther("0.001");
  const DISPUTE_BOND = ethers.parseEther("0.01");

  beforeEach(async () => {
    [owner, treasury, alice, bob, oracle1, oracle2, oracle3] =
      await ethers.getSigners();

    // Deploy OracleResolver
    const OracleResolverFactory = await ethers.getContractFactory("OracleResolver");
    oracleResolver = await OracleResolverFactory.deploy();
    await oracleResolver.waitForDeployment();

    // Deploy PredictionMarket
    const PredictionMarketFactory =
      await ethers.getContractFactory("PredictionMarket");
    predictionMarket = await PredictionMarketFactory.deploy(
      await oracleResolver.getAddress(),
      treasury.address
    );
    await predictionMarket.waitForDeployment();

    // Wire up
    await oracleResolver.setPredictionMarket(
      await predictionMarket.getAddress()
    );

    // Register 3 oracle nodes
    await oracleResolver.registerOracle(oracle1.address, 0); // SPEECH
    await oracleResolver.registerOracle(oracle2.address, 1); // IMAGE
    await oracleResolver.registerOracle(oracle3.address, 2); // WEATHER
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Market creation
  // ───────────────────────────────────────────────────────────────────────────

  describe("Market creation", () => {
    it("creates a market and emits event", async () => {
      const resolutionTime = (await time.latest()) + 3600;
      await expect(
        predictionMarket.connect(alice).createMarket(
          "Will PM say AI?",
          0, // SPEECH_EVENT
          "ipfs://QmXXX",
          resolutionTime,
          { value: CREATION_FEE }
        )
      )
        .to.emit(predictionMarket, "MarketCreated")
        .withArgs(0, alice.address, "Will PM say AI?", 0, resolutionTime);
    });

    it("reverts without creation fee", async () => {
      const resolutionTime = (await time.latest()) + 3600;
      await expect(
        predictionMarket.connect(alice).createMarket(
          "Will PM say AI?",
          0,
          "ipfs://QmXXX",
          resolutionTime,
          { value: 0 }
        )
      ).to.be.revertedWith("Insufficient creation fee");
    });

    it("reverts with past resolution time", async () => {
      const pastTime = (await time.latest()) - 1;
      await expect(
        predictionMarket.connect(alice).createMarket(
          "Will PM say AI?",
          0,
          "ipfs://QmXXX",
          pastTime,
          { value: CREATION_FEE }
        )
      ).to.be.revertedWith("Resolution must be in future");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Betting
  // ───────────────────────────────────────────────────────────────────────────

  describe("Betting", () => {
    let marketId: bigint;
    let resolutionTime: number;

    beforeEach(async () => {
      resolutionTime = (await time.latest()) + 3600;
      const tx = await predictionMarket
        .connect(alice)
        .createMarket("Will PM say AI?", 0, "ipfs://QmXXX", resolutionTime, {
          value: CREATION_FEE,
        });
      const receipt = await tx.wait();
      marketId = 0n;
    });

    it("accepts YES bet", async () => {
      const betAmount = ethers.parseEther("1");
      await expect(
        predictionMarket
          .connect(alice)
          .placeBet(marketId, true, { value: betAmount })
      )
        .to.emit(predictionMarket, "BetPlaced")
        .withArgs(marketId, alice.address, true, betAmount);

      const market = await predictionMarket.getMarket(marketId);
      expect(market.yesPool).to.equal(betAmount);
    });

    it("accepts NO bet", async () => {
      const betAmount = ethers.parseEther("2");
      await predictionMarket
        .connect(bob)
        .placeBet(marketId, false, { value: betAmount });

      const market = await predictionMarket.getMarket(marketId);
      expect(market.noPool).to.equal(betAmount);
    });

    it("reverts bet below minimum", async () => {
      await expect(
        predictionMarket
          .connect(alice)
          .placeBet(marketId, true, { value: ethers.parseEther("0.0001") })
      ).to.be.revertedWith("Bet below minimum");
    });

    it("reverts bet after resolution time", async () => {
      await time.increaseTo(resolutionTime + 1);
      await expect(
        predictionMarket
          .connect(alice)
          .placeBet(marketId, true, { value: MIN_BET })
      ).to.be.revertedWith("Betting period ended");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Oracle resolution + payout
  // ───────────────────────────────────────────────────────────────────────────

  describe("Oracle resolution + payout", () => {
    let marketId: bigint;
    let resolutionTime: number;
    const aliceBet = ethers.parseEther("3"); // YES
    const bobBet = ethers.parseEther("1"); // NO

    beforeEach(async () => {
      resolutionTime = (await time.latest()) + 3600;
      await predictionMarket
        .connect(alice)
        .createMarket("Will PM say AI?", 0, "ipfs://QmXXX", resolutionTime, {
          value: CREATION_FEE,
        });
      marketId = 0n;

      await predictionMarket
        .connect(alice)
        .placeBet(marketId, true, { value: aliceBet });
      await predictionMarket
        .connect(bob)
        .placeBet(marketId, false, { value: bobBet });

      // Advance past resolution time
      await time.increaseTo(resolutionTime + 1);
    });

    it("reaches consensus and resolves market via oracle votes", async () => {
      // 3 oracles vote YES with high confidence
      await oracleResolver.connect(oracle1).submitVote(marketId, true, 90);
      await oracleResolver.connect(oracle2).submitVote(marketId, true, 85);
      await oracleResolver.connect(oracle3).submitVote(marketId, true, 80);

      const market = await predictionMarket.getMarket(marketId);
      expect(market.status).to.equal(2); // RESOLVED
      expect(market.outcome).to.equal(true);
    });

    it("pays winner correctly after dispute period", async () => {
      await oracleResolver.connect(oracle1).submitVote(marketId, true, 90);
      await oracleResolver.connect(oracle2).submitVote(marketId, true, 85);
      await oracleResolver.connect(oracle3).submitVote(marketId, true, 80);

      // Fast-forward past dispute period (24h)
      await time.increase(24 * 3600 + 1);

      const totalPool = aliceBet + bobBet;
      const platformFee = (totalPool * 200n) / 10000n;
      const netPool = totalPool - platformFee;
      // Alice bet all YES, so she gets full net pool
      const expectedPayout = netPool;

      const balanceBefore = await ethers.provider.getBalance(alice.address);
      const tx = await predictionMarket.connect(alice).claimReward(marketId);
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(alice.address);

      expect(balanceAfter - balanceBefore + gasCost).to.equal(expectedPayout);
    });

    it("reverts claim during dispute period", async () => {
      await oracleResolver.connect(oracle1).submitVote(marketId, true, 90);
      await oracleResolver.connect(oracle2).submitVote(marketId, true, 90);
      await oracleResolver.connect(oracle3).submitVote(marketId, true, 90);

      await expect(
        predictionMarket.connect(alice).claimReward(marketId)
      ).to.be.revertedWith("Dispute period active");
    });

    it("allows dispute within window", async () => {
      await oracleResolver.connect(oracle1).submitVote(marketId, true, 90);
      await oracleResolver.connect(oracle2).submitVote(marketId, true, 90);
      await oracleResolver.connect(oracle3).submitVote(marketId, true, 90);

      await expect(
        predictionMarket
          .connect(bob)
          .disputeMarket(marketId, { value: DISPUTE_BOND })
      )
        .to.emit(predictionMarket, "MarketDisputed")
        .withArgs(marketId, bob.address);
    });

    it("loser gets zero payout", async () => {
      await oracleResolver.connect(oracle1).submitVote(marketId, true, 90);
      await oracleResolver.connect(oracle2).submitVote(marketId, true, 85);
      await oracleResolver.connect(oracle3).submitVote(marketId, true, 80);
      await time.increase(24 * 3600 + 1);

      const payout = await predictionMarket.calculatePayout(marketId, bob.address);
      expect(payout).to.equal(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Oracle edge cases
  // ───────────────────────────────────────────────────────────────────────────

  describe("Oracle edge cases", () => {
    it("rejects vote from non-oracle", async () => {
      await expect(
        oracleResolver.connect(alice).submitVote(0, true, 90)
      ).to.be.revertedWith("OracleResolver: not an oracle");
    });

    it("rejects vote with confidence below threshold", async () => {
      const resolutionTime = (await time.latest()) + 3600;
      await predictionMarket
        .connect(alice)
        .createMarket("Test", 0, "ipfs://x", resolutionTime, {
          value: CREATION_FEE,
        });

      await expect(
        oracleResolver.connect(oracle1).submitVote(0, true, 50) // below MIN_CONFIDENCE=60
      ).to.be.revertedWith("Confidence too low");
    });

    it("rejects double voting", async () => {
      const resolutionTime = (await time.latest()) + 3600;
      await predictionMarket
        .connect(alice)
        .createMarket("Test", 0, "ipfs://x", resolutionTime, {
          value: CREATION_FEE,
        });
      await time.increaseTo(resolutionTime + 1);

      await oracleResolver.connect(oracle1).submitVote(0, true, 80);
      await expect(
        oracleResolver.connect(oracle1).submitVote(0, true, 80)
      ).to.be.revertedWith("Already voted");
    });
  });
});
