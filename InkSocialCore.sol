// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title InkSocialCore
 * @dev Modular smart contract for social interactions on Ink Network (OP Stack L2)
 * This is a conceptual implementation of how the backend would work on-chain.
 */

contract InkSocialCore {
    struct Cast {
        uint256 id;
        address author;
        string contentUri; // IPFS/Arweave link to metadata
        uint256 timestamp;
        uint256 parentCastId; // 0 if it's a root cast
    }

    uint256 private _nextCastId = 1;
    mapping(uint256 => Cast) public casts;
    mapping(address => uint256[]) public userCasts;
    mapping(address => mapping(address => bool)) public follows;

    event CastCreated(uint256 indexed id, address indexed author, string contentUri);
    event Followed(address indexed follower, address indexed target);

    function cast(string calldata contentUri, uint256 parentCastId) external {
        uint256 castId = _nextCastId++;
        
        Cast memory newCast = Cast({
            id: castId,
            author: msg.sender,
            contentUri: contentUri,
            timestamp: block.timestamp,
            parentCastId: parentCastId
        });

        casts[castId] = newCast;
        userCasts[msg.sender].push(castId);

        emit CastCreated(castId, msg.sender, contentUri);
    }

    function follow(address target) external {
        require(target != msg.sender, "Cannot follow self");
        follows[msg.sender][target] = true;
        emit Followed(msg.sender, target);
    }

    function unfollow(address target) external {
        follows[msg.sender][target] = false;
    }
}
