// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPredictionMarket {
    enum MarketType {
        SPEECH_EVENT,
        IMAGE_EVENT,
        WEATHER_EVENT,
        SOCIAL_MEDIA_EVENT,
        CUSTOM
    }

    enum MarketStatus {
        OPEN,
        CLOSED,
        RESOLVED,
        DISPUTED,
        CANCELLED
    }

    struct Market {
        uint256 id;
        string question;
        MarketType marketType;
        string dataSource;
        uint256 resolutionTime;
        uint256 createdAt;
        address creator;
        uint256 yesPool;
        uint256 noPool;
        MarketStatus status;
        bool outcome; // true = YES, false = NO
        uint256 totalBets;
        uint256 platformFeePool;
    }

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        string question,
        MarketType marketType,
        uint256 resolutionTime
    );

    event BetPlaced(
        uint256 indexed marketId,
        address indexed bettor,
        bool isYes,
        uint256 amount
    );

    event MarketResolved(
        uint256 indexed marketId,
        bool outcome,
        uint256 timestamp
    );

    event MarketDisputed(uint256 indexed marketId, address indexed disputer);

    event RewardClaimed(
        uint256 indexed marketId,
        address indexed winner,
        uint256 amount
    );

    event MarketCancelled(uint256 indexed marketId);

    function createMarket(
        string calldata question,
        MarketType marketType,
        string calldata dataSource,
        uint256 resolutionTime
    ) external payable returns (uint256 marketId);

    function placeBet(uint256 marketId, bool isYes) external payable;

    function resolveMarket(uint256 marketId, bool outcome) external;

    function claimReward(uint256 marketId) external;

    function disputeMarket(uint256 marketId) external payable;

    function cancelMarket(uint256 marketId) external;

    function getMarket(uint256 marketId) external view returns (Market memory);

    function getUserBet(
        uint256 marketId,
        address user
    ) external view returns (uint256 yesBet, uint256 noBet);

    function calculatePayout(
        uint256 marketId,
        address user
    ) external view returns (uint256);
}
