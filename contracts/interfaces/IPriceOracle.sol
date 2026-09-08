// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IPriceOracle {
    function latestPrice(bytes32 feedId) external view returns (uint256 price, uint64 timestampNs);
}
