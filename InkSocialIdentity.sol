// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title InkSocialIdentity
 * @dev Identity registry for InkSocial. Maps wallet addresses to Farcaster-style IDs (FIDs).
 */
contract InkSocialIdentity {
    struct Profile {
        uint256 fid;
        string username;
        string metadataUri; // IPFS/Arweave link to profile info (bio, pfp, etc)
        bool registered;
    }

    mapping(address => Profile) public profiles;
    mapping(string => address) public usernameToAddress;
    uint256 public nextFid = 1000;

    event ProfileRegistered(address indexed user, uint256 indexed fid, string username);
    event ProfileUpdated(address indexed user, string metadataUri);

    function register(string calldata username, string calldata metadataUri) external {
        require(!profiles[msg.sender].registered, "Already registered");
        require(usernameToAddress[username] == address(0), "Username taken");
        
        uint256 fid = nextFid++;
        profiles[msg.sender] = Profile(fid, username, metadataUri, true);
        usernameToAddress[username] = msg.sender;

        emit ProfileRegistered(msg.sender, fid, username);
    }

    function updateProfile(string calldata metadataUri) external {
        require(profiles[msg.sender].registered, "Not registered");
        profiles[msg.sender].metadataUri = metadataUri;
        emit ProfileUpdated(msg.sender, metadataUri);
    }

    function getProfile(address user) external view returns (Profile memory) {
        return profiles[user];
    }
}
