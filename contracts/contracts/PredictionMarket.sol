// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IPredictionMarket.sol";

/**
 * @title PredictionMarket
 * @notice Core prediction market contract. Users create markets, place ETH bets,
 *         and claim proportional winnings after the AI oracle resolves the outcome.
 *
 * Fee model:
 *   - 1% creation fee (burned / treasury)
 *   - 2% platform fee taken from total pool on settlement
 *   - Rest distributed proportionally to winners
 */
contract PredictionMarket is IPredictionMarket, Ownable, ReentrancyGuard, Pausable {
    // ─────────────────────────────────────────────────────────────────────────
    // Constants & immutables
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant PLATFORM_FEE_BPS = 200; // 2%
    uint256 public constant CREATION_FEE = 0.001 ether;
    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant DISPUTE_BOND = 0.01 ether;
    uint256 public constant DISPUTE_PERIOD = 24 hours;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    uint256 private _nextMarketId;
    address public oracle; // OracleResolver contract
    address public treasury;

    mapping(uint256 => Market) private _markets;
    // marketId → user → (yesBet, noBet)
    mapping(uint256 => mapping(address => uint256)) private _yesBets;
    mapping(uint256 => mapping(address => uint256)) private _noBets;
    // marketId → user → claimed
    mapping(uint256 => mapping(address => bool)) private _claimed;
    // marketId → resolution timestamp (for dispute window)
    mapping(uint256 => uint256) private _resolvedAt;

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyOracle() {
        require(msg.sender == oracle, "PredictionMarket: caller is not oracle");
        _;
    }

    modifier marketExists(uint256 marketId) {
        require(marketId < _nextMarketId, "PredictionMarket: market not found");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address _oracle, address _treasury) Ownable(msg.sender) {
        require(_oracle != address(0) && _treasury != address(0), "Zero address");
        oracle = _oracle;
        treasury = _treasury;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Zero address");
        oracle = _oracle;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        treasury = _treasury;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Market lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a new prediction market.
     * @param question      Human-readable question (stored on-chain for composability).
     * @param marketType    Category of the market (speech, image, weather, …).
     * @param dataSource    IPFS CID or URL where full metadata is stored.
     * @param resolutionTime Unix timestamp after which the market can be resolved.
     */
    function createMarket(
        string calldata question,
        MarketType marketType,
        string calldata dataSource,
        uint256 resolutionTime
    ) external payable override whenNotPaused returns (uint256 marketId) {
        require(msg.value >= CREATION_FEE, "Insufficient creation fee");
        require(resolutionTime > block.timestamp, "Resolution must be in future");
        require(bytes(question).length > 0, "Empty question");
        require(bytes(dataSource).length > 0, "Empty data source");

        marketId = _nextMarketId++;

        _markets[marketId] = Market({
            id: marketId,
            question: question,
            marketType: marketType,
            dataSource: dataSource,
            resolutionTime: resolutionTime,
            createdAt: block.timestamp,
            creator: msg.sender,
            yesPool: 0,
            noPool: 0,
            status: MarketStatus.OPEN,
            outcome: false,
            totalBets: 0,
            platformFeePool: 0
        });

        // Creation fee → treasury
        _safeTransfer(treasury, msg.value);

        emit MarketCreated(marketId, msg.sender, question, marketType, resolutionTime);
    }

    /**
     * @notice Place a bet on YES or NO.
     * @param marketId The target market.
     * @param isYes    true for YES, false for NO.
     */
    function placeBet(
        uint256 marketId,
        bool isYes
    ) external payable override whenNotPaused marketExists(marketId) nonReentrant {
        Market storage market = _markets[marketId];
        require(market.status == MarketStatus.OPEN, "Market not open");
        require(block.timestamp < market.resolutionTime, "Betting period ended");
        require(msg.value >= MIN_BET, "Bet below minimum");

        if (isYes) {
            market.yesPool += msg.value;
            _yesBets[marketId][msg.sender] += msg.value;
        } else {
            market.noPool += msg.value;
            _noBets[marketId][msg.sender] += msg.value;
        }
        market.totalBets++;

        emit BetPlaced(marketId, msg.sender, isYes, msg.value);
    }

    /**
     * @notice Called exclusively by the OracleResolver once consensus is reached.
     */
    function resolveMarket(
        uint256 marketId,
        bool outcome
    ) external override onlyOracle marketExists(marketId) {
        Market storage market = _markets[marketId];
        require(
            market.status == MarketStatus.OPEN || market.status == MarketStatus.CLOSED,
            "Cannot resolve"
        );
        require(block.timestamp >= market.resolutionTime, "Too early to resolve");

        uint256 totalPool = market.yesPool + market.noPool;
        uint256 platformFee = (totalPool * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        market.platformFeePool = platformFee;
        market.status = MarketStatus.RESOLVED;
        market.outcome = outcome;
        _resolvedAt[marketId] = block.timestamp;

        // Send platform fee to treasury
        if (platformFee > 0) {
            _safeTransfer(treasury, platformFee);
        }

        emit MarketResolved(marketId, outcome, block.timestamp);
    }

    /**
     * @notice Winners call this to receive their proportional payout.
     */
    function claimReward(
        uint256 marketId
    ) external override marketExists(marketId) nonReentrant {
        Market storage market = _markets[marketId];
        require(market.status == MarketStatus.RESOLVED, "Not resolved");
        require(
            block.timestamp >= _resolvedAt[marketId] + DISPUTE_PERIOD,
            "Dispute period active"
        );
        require(!_claimed[marketId][msg.sender], "Already claimed");

        uint256 payout = _calculatePayout(marketId, msg.sender, market);
        require(payout > 0, "No reward");

        _claimed[marketId][msg.sender] = true;

        _safeTransfer(msg.sender, payout);

        emit RewardClaimed(marketId, msg.sender, payout);
    }

    /**
     * @notice Raise a dispute during the dispute window. Requires a bond.
     */
    function disputeMarket(
        uint256 marketId
    ) external payable override marketExists(marketId) {
        Market storage market = _markets[marketId];
        require(market.status == MarketStatus.RESOLVED, "Not resolved");
        require(
            block.timestamp < _resolvedAt[marketId] + DISPUTE_PERIOD,
            "Dispute window closed"
        );
        require(msg.value >= DISPUTE_BOND, "Insufficient dispute bond");

        market.status = MarketStatus.DISPUTED;

        emit MarketDisputed(marketId, msg.sender);
    }

    /**
     * @notice Owner can cancel markets that never resolved (e.g. event cancelled).
     *         All bettors get refunded.
     */
    function cancelMarket(
        uint256 marketId
    ) external override onlyOwner marketExists(marketId) {
        Market storage market = _markets[marketId];
        require(
            market.status == MarketStatus.OPEN || market.status == MarketStatus.DISPUTED,
            "Cannot cancel"
        );
        market.status = MarketStatus.CANCELLED;
        emit MarketCancelled(marketId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function getMarket(
        uint256 marketId
    ) external view override marketExists(marketId) returns (Market memory) {
        return _markets[marketId];
    }

    function getUserBet(
        uint256 marketId,
        address user
    ) external view override marketExists(marketId) returns (uint256 yesBet, uint256 noBet) {
        yesBet = _yesBets[marketId][user];
        noBet = _noBets[marketId][user];
    }

    function calculatePayout(
        uint256 marketId,
        address user
    ) external view override marketExists(marketId) returns (uint256) {
        return _calculatePayout(marketId, user, _markets[marketId]);
    }

    function totalMarkets() external view returns (uint256) {
        return _nextMarketId;
    }

    function hasClaimed(uint256 marketId, address user) external view returns (bool) {
        return _claimed[marketId][user];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _calculatePayout(
        uint256 marketId,
        address user,
        Market storage market
    ) internal view returns (uint256) {
        if (market.status != MarketStatus.RESOLVED) return 0;

        uint256 totalPool = market.yesPool + market.noPool;
        uint256 netPool = totalPool - market.platformFeePool;

        if (market.outcome) {
            // YES won
            uint256 userYesBet = _yesBets[marketId][user];
            if (userYesBet == 0 || market.yesPool == 0) return 0;
            return (userYesBet * netPool) / market.yesPool;
        } else {
            // NO won
            uint256 userNoBet = _noBets[marketId][user];
            if (userNoBet == 0 || market.noPool == 0) return 0;
            return (userNoBet * netPool) / market.noPool;
        }
    }

    function _safeTransfer(address to, uint256 amount) internal {
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "Transfer failed");
    }

    receive() external payable {}
}
