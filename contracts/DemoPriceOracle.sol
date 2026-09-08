// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {IStork} from "./interfaces/IStork.sol";
import {TwoStepOwnable} from "./utils/TwoStepOwnable.sol";

/// @notice TESTNET-ONLY oracle used when signed Stork API access is unavailable.
contract DemoPriceOracle is IPriceOracle, TwoStepOwnable {
    struct PriceData {
        uint256 price;
        uint64 timestampNs;
        bool configured;
    }

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_PUBLIC_STEP_BPS = 500;
    uint256 public constant MAX_BATCH = 8;
    uint256 public maxAge = 1 days;

    mapping(bytes32 => PriceData) public prices;

    event FeedConfigured(bytes32 indexed feedId, uint256 price);
    event DemoPriceUpdated(address indexed updater, bytes32 indexed feedId, uint256 oldPrice, uint256 newPrice);
    event MaxAgeUpdated(uint256 maxAge);

    function configureFeed(bytes32 feedId, uint256 initialPrice) external onlyOwner {
        require(feedId != bytes32(0), "ZERO_FEED");
        require(initialPrice > 0, "ZERO_PRICE");
        prices[feedId] = PriceData({ price: initialPrice, timestampNs: uint64(block.timestamp * 1e9), configured: true });
        emit FeedConfigured(feedId, initialPrice);
    }

    function setMaxAge(uint256 seconds_) external onlyOwner {
        require(seconds_ >= 1 minutes && seconds_ <= 7 days, "BAD_MAX_AGE");
        maxAge = seconds_;
        emit MaxAgeUpdated(seconds_);
    }

    function getUpdateFee(IStork.TemporalNumericValueInput[] calldata) external pure returns (uint256) {
        return 0;
    }

    function updatePrices(IStork.TemporalNumericValueInput[] calldata updateData) external payable {
        require(msg.value == 0, "NO_FEE_REQUIRED");
        uint256 length = updateData.length;
        require(length > 0 && length <= MAX_BATCH, "BAD_UPDATE_COUNT");

        for (uint256 i = 0; i < length; i++) {
            IStork.TemporalNumericValueInput calldata input = updateData[i];
            PriceData storage current = prices[input.id];
            require(current.configured, "UNKNOWN_FEED");
            require(input.temporalNumericValue.quantizedValue > 0, "INVALID_PRICE");

            uint256 nextPrice = uint256(uint192(input.temporalNumericValue.quantizedValue));
            uint256 oldPrice = current.price;
            uint256 difference = nextPrice > oldPrice ? nextPrice - oldPrice : oldPrice - nextPrice;
            require(difference * BPS <= oldPrice * MAX_PUBLIC_STEP_BPS, "DEMO_STEP_TOO_LARGE");

            uint64 suppliedTimestamp = input.temporalNumericValue.timestampNs;
            uint64 nowNs = uint64(block.timestamp * 1e9);
            require(suppliedTimestamp <= nowNs + uint64(5e9), "FUTURE_PRICE");

            current.price = nextPrice;
            current.timestampNs = nowNs;
            emit DemoPriceUpdated(msg.sender, input.id, oldPrice, nextPrice);
        }
    }

    function latestPrice(bytes32 feedId) external view override returns (uint256 price, uint64 timestampNs) {
        PriceData memory data = prices[feedId];
        require(data.configured && data.price > 0, "NO_PRICE");
        uint256 timestampSeconds = uint256(data.timestampNs) / 1e9;
        require(block.timestamp <= timestampSeconds + maxAge, "STALE_PRICE");
        return (data.price, data.timestampNs);
    }
}
