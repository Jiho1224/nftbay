const auction = artifacts.require("./Auction.sol")
const assertLib = require('truffle-assertions');

contract("Auction", accounts => {

    var testAuctionDatas = []
    testAuctionDatas.push({tokenId : 10, tokenAddress : accounts[1], startingPrice : 10000, auctionEndTime : Date.now() + 10000000});
    testAuctionDatas.push({tokenId : 20, tokenAddress : accounts[2], startingPrice : 1000, auctionEndTime : Date.now() + 20000000});
    const owner = accounts[0];
    
    var testLogDatas = [];
    testLogDatas.push({from : accounts[1], auctionInstanceId : 0, bidPrice : 10001});
    testLogDatas.push({from : accounts[2], auctionInstanceId : 1, bidPrice : 20000});
    testLogDatas.push({from : accounts[2], auctionInstanceId : 0, bidPrice : 15000});
    testLogDatas.push({from : accounts[1], auctionInstanceId : 1, bidPrice : 100000});
    testLogDatas.push({from : accounts[1], auctionInstanceId : 0, bidPrice : 100});

    var errornessTestLogDatas = [];
    errornessTestLogDatas.push({from : accounts[1], auctionInstanceId : 2, bidPrice : 100});

    var highestBids = [];
    var auctionLogCount = [];

    it("Initial Values", async function(){
        const contractInstance = await auction.deployed();
        const auctionInstanceCount = await contractInstance.auctionInstanceCount();

        assert.equal(auctionInstanceCount, 0);
    })

    it("Creating instances", async function(){
        const contractInstance = await auction.deployed();

        for (var i = 0; i < testAuctionDatas.length; i++) {
            const testData = testAuctionDatas[i];
            // Error when token owner-checking.
            // If you want to test, comment the owner-checking require statement.
            await contractInstance.createAuctionInstance(testData.tokenAddress, testData.tokenId, testData.startingPrice, testData.auctionEndTime);
        }

        const auctionInstanceCount = await contractInstance.auctionInstanceCount();

        assert.equal(auctionInstanceCount, testAuctionDatas.length);
        
        for (var i = 0; i < auctionInstanceCount; i++) {
            const auctionInstance = await contractInstance.getAuctionInstance(i);
            const auctionLogs = await contractInstance.getAuctionLogs(i);
            assert.notEqual(auctionInstance, null);
            assert.equal(auctionLogs.length, 1);
        }
    })

    it("Check Created Instances", async function(){
        const contractInstance = await auction.deployed();

        for (var i = 0; i < testAuctionDatas.length; i++) {
            const testData = testAuctionDatas[i];
            const auctionInstance = await contractInstance.getAuctionInstance(i);
            
            assert.equal(auctionInstance.id, i);
            assert.equal(auctionInstance.cosigner, owner);
            assert.equal(auctionInstance.tokenAddress, testData.tokenAddress);
            assert.equal(auctionInstance.tokenId, testData.tokenId);
            assert.equal(auctionInstance.highestBid, testData.startingPrice);
            assert.equal(auctionInstance.highestBidder, owner);
            assert.equal(auctionInstance.auctionEndTime, testData.auctionEndTime);
        }

        var cosignedAuctionInstances = await contractInstance.getCosignedAuctionInstances();
        assert.equal(testAuctionDatas.length, cosignedAuctionInstances.length)
        for (var i = 0; i < cosignedAuctionInstances.length; i++) {
            const testData = testAuctionDatas[i];
            const auctionInstance = await contractInstance.getAuctionInstance(i);
            
            assert.equal(auctionInstance.id, i);
            assert.equal(auctionInstance.cosigner, owner);
            assert.equal(auctionInstance.tokenAddress, testData.tokenAddress);
            assert.equal(auctionInstance.tokenId, testData.tokenId);
            assert.equal(auctionInstance.highestBid, testData.startingPrice);
            assert.equal(auctionInstance.highestBidder, owner);
            assert.equal(auctionInstance.auctionEndTime, testData.auctionEndTime);
        }
    })

    it("Check Created Logs", async function(){
        const contractInstance = await auction.deployed();

        for (var i = 0; i < testAuctionDatas.length; i++) {
            const testData = testAuctionDatas[i];
            var auctionLogs = await contractInstance.getAuctionLogs(i);
            assert.equal(auctionLogs.length, 1);

            const firstAuctionLog = auctionLogs[0];
            
            assert.equal(firstAuctionLog.bidder, owner);
            assert.equal(firstAuctionLog.bidPrice, testData.startingPrice)
        }
    })

    it("Bidding", async function(){
        const contractInstance = await auction.deployed();
        const auctionInstanceCount = await contractInstance.auctionInstanceCount();

        for (var i = 0; i < auctionInstanceCount; i++) {
            const auctionInstance = await contractInstance.getAuctionInstance(i);
            highestBids.push({bidder : auctionInstance.highestBidder, bid : auctionInstance.highestBid});
            auctionLogCount.push(1);
        }

        for (var i = 0; i < testLogDatas.length; i++) {
            const testLogData = testLogDatas[i];
            await contractInstance.bid(testLogData.auctionInstanceId, testLogData.bidPrice, { from: testLogData.from });
            if (testLogData.auctionInstanceId < highestBids.length) {
                auctionLogCount[testLogData.auctionInstanceId]++;
                if (highestBids[testLogData.auctionInstanceId].bid < testLogData.bidPrice) {
                    highestBids[testLogData.auctionInstanceId].bidder = testLogData.from;
                    highestBids[testLogData.auctionInstanceId].bid = testLogData.bidPrice;
                }
            }
        }
    })

    it("Errorness Bidding", async function(){
        const contractInstance = await auction.deployed();
        for (var i = 0; i < errornessTestLogDatas.length; i++) {
            const testLogData = errornessTestLogDatas[i];
            await assertLib.reverts(contractInstance.bid(testLogData.auctionInstanceId, testLogData.bidPrice));
        }
    })

    it("Check Bidding Result", async function(){
        const contractInstance = await auction.deployed();
        const auctionInstanceCount = await contractInstance.auctionInstanceCount();
        for (var i = 0; i < auctionInstanceCount; i++) {
            const auctionInstance = await contractInstance.getAuctionInstance(i);
            const auctionLogs = await contractInstance.getAuctionLogs(i);
            
            assert.equal(auctionInstance.highestBidder, highestBids[i].bidder);
            assert.equal(auctionInstance.highestBid, highestBids[i].bid);

            assert.equal(auctionLogs.length, auctionLogCount[i]);
            /*
            for (var j = 0; j < auctionLogs.length; j++) {
                const auctionLog = auctionLogs[j];
                assert.equal(auctionLog.bidder, owner);
            }
            */
        }

        var biddedAuctionInstances = await contractInstance.getBiddedAuctionInstances();
        assert.equal(biddedAuctionInstances.length, 0);
        biddedAuctionInstances = await contractInstance.getBiddedAuctionInstances({from : accounts[1]});
        assert.equal(biddedAuctionInstances.length, 2);
        biddedAuctionInstances = await contractInstance.getBiddedAuctionInstances({from : accounts[2]});
        assert.equal(biddedAuctionInstances.length, 2);
    })
})