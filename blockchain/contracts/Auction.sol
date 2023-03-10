pragma solidity ^0.8.17;

import "./ERC721.sol";

contract Auction {
    uint public auctionInstanceCount = 0;

    struct AuctionInstance {
        uint id;
        address cosigner;
        address tokenAddress;
        uint tokenId;
        uint highestBid;
        address highestBidder;
        uint auctionEndTime;
        uint received20Token;
        bool widthdrawFinished;
    }

    struct AuctionLog {
        address bidder;
        uint bidPrice;
        uint bidTime;
    }

    event AuctionInstanceCreated(
        uint auctionInstanceId
    );

    event AuctionLogCreated(
        uint auctionInstanceId,
        uint logIndex
    );

    mapping(uint => AuctionInstance) public auctionInstances;
    mapping(uint => AuctionLog[]) public auctionLogs;
    mapping(address => uint) public ownerAuctionInstanceCountMap;
    mapping(address => uint[]) public biddedAuctionInstancesMap;

    function createAuctionInstance(address tokenAddress, uint tokenId, uint startingPrice, uint auctionEndTime) external {
        // Check if token belongs to owner
        ERC721 tokenContract = ERC721(tokenAddress);
        require(msg.sender == tokenContract.ownerOf(tokenId), "Token is not owned by account!");
        require(block.timestamp < auctionEndTime, "Auction end time cannot be before than current time");
        // Check if this contract is approved
        require(tokenContract.getApproved(tokenId) == address(this), "Token is not approved to this contract");
        auctionInstances[auctionInstanceCount] = AuctionInstance(auctionInstanceCount, msg.sender, tokenAddress, tokenId, startingPrice, msg.sender, auctionEndTime, 0, false);
        emit AuctionInstanceCreated(auctionInstanceCount);
        ownerAuctionInstanceCountMap[msg.sender]++;
        auctionInstanceCount++;
        bid(auctionInstanceCount - 1, startingPrice);
    }

    function bid(uint _auctionInstanceId, uint bidPrice) public {
        require(_auctionInstanceId < auctionInstanceCount, "Unknown auction id");
        AuctionInstance memory auctionInstance = auctionInstances[_auctionInstanceId];
        require(block.timestamp <= auctionInstance.auctionEndTime, "Auction Ends!");

        auctionLogs[_auctionInstanceId].push(AuctionLog(msg.sender, bidPrice, block.timestamp));
        if (bidPrice > auctionInstance.highestBid)
        {
            AuctionInstance memory newAuctionInstance = AuctionInstance(auctionInstance.id, auctionInstance.cosigner, auctionInstance.tokenAddress, auctionInstance.tokenId, bidPrice, msg.sender, auctionInstance.auctionEndTime, 0, false);
            auctionInstances[_auctionInstanceId] = newAuctionInstance;
        }

        if (msg.sender != auctionInstance.cosigner) {
            uint[] memory biddedAuctionInstances = biddedAuctionInstancesMap[msg.sender];
            bool found = false;

            for (uint i = 0; i < biddedAuctionInstances.length; i++) {
                found = found || (biddedAuctionInstances[i] == _auctionInstanceId);
                if (found) {
                    break;
                }
            }

            if (!found) {
                biddedAuctionInstancesMap[msg.sender].push(_auctionInstanceId);
            }
        }
        emit AuctionLogCreated(_auctionInstanceId, auctionLogs[_auctionInstanceId].length - 1);
    }

    function endAuction(uint _auctionInstanceId) external {
        require(_auctionInstanceId < auctionInstanceCount, "Unknown auction id");
        AuctionInstance memory auctionInstance = auctionInstances[_auctionInstanceId];
        require(msg.sender == auctionInstance.cosigner, "Token is not owned by account!");
        require(block.timestamp < auctionInstance.auctionEndTime, "Auction already ended!");

        AuctionInstance memory newAuctionInstance = AuctionInstance(auctionInstance.id, auctionInstance.cosigner, auctionInstance.tokenAddress, auctionInstance.tokenId, auctionInstance.highestBid, auctionInstance.highestBidder, block.timestamp, 0, false);
        auctionInstances[_auctionInstanceId] = newAuctionInstance;
    }

    function widthdrawFromAuctionInstance(uint _auctionInstanceId) external {
        require(_auctionInstanceId < auctionInstanceCount, "Unknown auction id");
        AuctionInstance memory auctionInstance = auctionInstances[_auctionInstanceId];
        require(block.timestamp > auctionInstance.auctionEndTime, "Auction not ended!");
        require(msg.sender == auctionInstance.cosigner, "Token is not owned by account!");

        uint received20Token = auctionInstance.received20Token;
        auctionInstance.received20Token = 0;
        auctionInstance.widthdrawFinished = true;
        auctionInstances[_auctionInstanceId] = auctionInstance;

        (bool success, ) = payable(msg.sender).call{value: received20Token}("");
        require(success, "Widthdraw failed");
    }
    
    function receiveToken(uint _auctionInstanceId) external payable {
        require(_auctionInstanceId < auctionInstanceCount, "Unknown auction id");
        AuctionInstance memory auctionInstance = auctionInstances[_auctionInstanceId];
        require(block.timestamp > auctionInstance.auctionEndTime, "Auction not ended!");
        require(msg.sender == auctionInstance.highestBidder, "Account is not higest bidder");
        // Check if balance is enough
        require(msg.value >= auctionInstance.highestBid, "Payment price is not correct");
        // Tranasfer bid, and get token
        auctionInstance.received20Token += msg.value;
        auctionInstances[_auctionInstanceId] = auctionInstance;
        ERC721 tokenContract = ERC721(auctionInstance.tokenAddress);
        tokenContract.transferFrom(auctionInstance.cosigner, msg.sender, auctionInstance.tokenId);
    }

    function getAuctionInstance(uint _auctionInstanceId) external view returns (AuctionInstance memory) {
        require(_auctionInstanceId < auctionInstanceCount, "Unknown auction id");
        return auctionInstances[_auctionInstanceId];
    }

    function getCosignedAuctionInstances() external view returns (AuctionInstance[] memory) {
        AuctionInstance[] memory results = new AuctionInstance[](ownerAuctionInstanceCountMap[msg.sender]);
        uint counter = 0;
        for (uint i = 0; i < auctionInstanceCount; i++) {
            AuctionInstance memory auctionInstance = auctionInstances[i];
            if (auctionInstance.cosigner == msg.sender) {
                results[counter] = auctionInstance;
                counter++;
            }
        }
        return results;
    }

    function getBiddedAuctionInstances() external view returns (AuctionInstance[] memory) {
        uint[] memory biddedAuctionInstances = biddedAuctionInstancesMap[msg.sender];
        AuctionInstance[] memory results = new AuctionInstance[](biddedAuctionInstances.length);
        for (uint i = 0; i < biddedAuctionInstances.length; i++) {
            results[i] = auctionInstances[biddedAuctionInstances[i]];
        }
        return results;
    }

    function getAuctionLogs(uint _auctionInstanceId) external view returns (AuctionLog[] memory) {
        require(_auctionInstanceId < auctionInstanceCount, "Unknown auction id");
        return auctionLogs[_auctionInstanceId];
    }
}