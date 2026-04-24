// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOracleResolver {
    enum OracleType {
        SPEECH,
        IMAGE,
        WEATHER,
        SOCIAL,
        CONSENSUS
    }

    struct OracleVote {
        address oracle;
        bool outcome;
        uint256 confidence; // 0-100
        uint256 timestamp;
    }

    struct ResolutionRequest {
        uint256 marketId;
        uint256 requestedAt;
        uint256 votesYes;
        uint256 votesNo;
        bool resolved;
        OracleVote[] votes;
    }

    event OracleRegistered(address indexed oracle, OracleType oracleType);
    event OracleRemoved(address indexed oracle);
    event VoteSubmitted(
        uint256 indexed marketId,
        address indexed oracle,
        bool outcome,
        uint256 confidence
    );
    event ConsensusReached(
        uint256 indexed marketId,
        bool outcome,
        uint256 confidence
    );
    event DisputeRaised(uint256 indexed marketId, address indexed raiser);

    function registerOracle(address oracle, OracleType oracleType) external;

    function submitVote(
        uint256 marketId,
        bool outcome,
        uint256 confidence
    ) external;

    function getResolution(
        uint256 marketId
    ) external view returns (bool resolved, bool outcome, uint256 avgConfidence);

    function isOracle(address addr) external view returns (bool);
}
