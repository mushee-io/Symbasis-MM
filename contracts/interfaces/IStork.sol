// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IStork {
    struct TemporalNumericValue {
        uint64 timestampNs;
        int192 quantizedValue;
    }

    struct TemporalNumericValueInput {
        TemporalNumericValue temporalNumericValue;
        bytes32 id;
        bytes32 publisherMerkleRoot;
        bytes32 valueComputeAlgHash;
        bytes32 r;
        bytes32 s;
        uint8 v;
    }

    function updateTemporalNumericValuesV1(TemporalNumericValueInput[] calldata updateData) external payable;
    function getUpdateFeeV1(TemporalNumericValueInput[] calldata updateData) external view returns (uint256 feeAmount);
    function getTemporalNumericValueV1(bytes32 id) external view returns (TemporalNumericValue memory value);
}
