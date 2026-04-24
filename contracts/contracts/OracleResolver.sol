// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IOracleResolver.sol";

/**
 * @title OracleResolver
 * @notice Manages a decentralized network of AI oracle nodes that vote on market outcomes.
 *         Consensus requires a configurable supermajority (default 3/4) with minimum
 *         confidence threshold before forwarding the result to PredictionMarket.
 */
contract OracleResolver is IOracleResolver, Ownable, ReentrancyGuard {
    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant MIN_CONFIDENCE = 60; // minimum confidence % per oracle vote
    uint256 public constant CONSENSUS_THRESHOLD = 75; // % of votes needed for consensus
    uint256 public constant DISPUTE_PERIOD = 24 hours;

    mapping(address => bool) public oracles;
    mapping(address => OracleType) public oracleTypes;
    address[] public oracleList;

    // marketId → oracle address → has voted
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => ResolutionData) private resolutions;

    struct ResolutionData {
        uint256 votesYes;
        uint256 votesNo;
        uint256 totalConfidenceYes;
        uint256 totalConfidenceNo;
        bool resolved;
        bool outcome;
        uint256 resolvedAt;
        OracleVote[] votes;
    }

    address public predictionMarket;

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyOracle() {
        require(oracles[msg.sender], "OracleResolver: not an oracle");
        _;
    }

    modifier onlyPredictionMarket() {
        require(
            msg.sender == predictionMarket,
            "OracleResolver: caller is not PredictionMarket"
        );
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setPredictionMarket(address _market) external onlyOwner {
        require(_market != address(0), "Zero address");
        predictionMarket = _market;
    }

    function registerOracle(
        address oracle,
        OracleType oracleType
    ) external override onlyOwner {
        require(oracle != address(0), "Zero address");
        require(!oracles[oracle], "Already registered");
        oracles[oracle] = true;
        oracleTypes[oracle] = oracleType;
        oracleList.push(oracle);
        emit OracleRegistered(oracle, oracleType);
    }

    function removeOracle(address oracle) external onlyOwner {
        require(oracles[oracle], "Not registered");
        oracles[oracle] = false;
        emit OracleRemoved(oracle);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Oracle voting
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Oracle submits its vote for a market outcome.
     * @param marketId   The market being resolved.
     * @param outcome    true = YES happened, false = NO.
     * @param confidence 0–100 confidence score from the AI model.
     */
    function submitVote(
        uint256 marketId,
        bool outcome,
        uint256 confidence
    ) external override onlyOracle nonReentrant {
        require(confidence >= MIN_CONFIDENCE, "Confidence too low");
        require(!hasVoted[marketId][msg.sender], "Already voted");
        // Silently ignore votes after consensus — late oracles should not revert callers
        if (resolutions[marketId].resolved) return;

        hasVoted[marketId][msg.sender] = true;

        ResolutionData storage r = resolutions[marketId];
        r.votes.push(
            OracleVote({
                oracle: msg.sender,
                outcome: outcome,
                confidence: confidence,
                timestamp: block.timestamp
            })
        );

        if (outcome) {
            r.votesYes++;
            r.totalConfidenceYes += confidence;
        } else {
            r.votesNo++;
            r.totalConfidenceNo += confidence;
        }

        emit VoteSubmitted(marketId, msg.sender, outcome, confidence);

        _tryReachConsensus(marketId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal consensus logic
    // ─────────────────────────────────────────────────────────────────────────

    function _tryReachConsensus(uint256 marketId) internal {
        ResolutionData storage r = resolutions[marketId];
        uint256 totalVotes = r.votesYes + r.votesNo;

        uint256 activeOracles = _activeOracleCount();
        if (activeOracles == 0) return;

        // Require a quorum: strict majority of active oracles must have voted
        uint256 quorum = (activeOracles / 2) + 1;
        if (totalVotes < quorum) return;

        uint256 yesPercent = (r.votesYes * 100) / totalVotes;
        uint256 noPercent = (r.votesNo * 100) / totalVotes;

        bool consensusYes = yesPercent >= CONSENSUS_THRESHOLD;
        bool consensusNo = noPercent >= CONSENSUS_THRESHOLD;

        if (!consensusYes && !consensusNo) return;

        bool finalOutcome = consensusYes;
        uint256 avgConfidence = finalOutcome
            ? r.totalConfidenceYes / r.votesYes
            : r.totalConfidenceNo / r.votesNo;

        r.resolved = true;
        r.outcome = finalOutcome;
        r.resolvedAt = block.timestamp;

        emit ConsensusReached(marketId, finalOutcome, avgConfidence);

        // Forward result to PredictionMarket
        if (predictionMarket != address(0)) {
            (bool success, ) = predictionMarket.call(
                abi.encodeWithSignature(
                    "resolveMarket(uint256,bool)",
                    marketId,
                    finalOutcome
                )
            );
            require(success, "OracleResolver: market resolution call failed");
        }
    }

    function _activeOracleCount() internal view returns (uint256 count) {
        for (uint256 i = 0; i < oracleList.length; i++) {
            if (oracles[oracleList[i]]) count++;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function getResolution(
        uint256 marketId
    )
        external
        view
        override
        returns (bool resolved, bool outcome, uint256 avgConfidence)
    {
        ResolutionData storage r = resolutions[marketId];
        resolved = r.resolved;
        outcome = r.outcome;
        if (r.resolved) {
            avgConfidence = outcome
                ? (r.votesYes > 0 ? r.totalConfidenceYes / r.votesYes : 0)
                : (r.votesNo > 0 ? r.totalConfidenceNo / r.votesNo : 0);
        }
    }

    function getVotes(
        uint256 marketId
    ) external view returns (OracleVote[] memory) {
        return resolutions[marketId].votes;
    }

    function getVoteCounts(
        uint256 marketId
    ) external view returns (uint256 yes, uint256 no) {
        yes = resolutions[marketId].votesYes;
        no = resolutions[marketId].votesNo;
    }

    function isOracle(address addr) external view override returns (bool) {
        return oracles[addr];
    }

    function getActiveOracleCount() external view returns (uint256) {
        return _activeOracleCount();
    }
}
