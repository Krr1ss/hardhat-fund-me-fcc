const { assert, expect } = require("chai");
const { deployments, ethers, getNamedAccounts } = require("hardhat");
const {
    isCallTrace,
} = require("hardhat/internal/hardhat-network/stack-traces/message-trace");

describe("FundMe", async function () {
    let fundMe;
    let deployer;
    let MockV3Aggregator;
    const sendValue = ethers.utils.parseEther("1"); // 1 eth
    beforeEach(async function () {
        // deploy our fundMe contract
        // using Hardhat-deploy
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        fundMe = await ethers.getContract("FundMe", deployer);
        MockV3Aggregator = await ethers.getContract(
            "MockV3Aggregator",
            deployer
        );
    });

    describe("constructor", async function () {
        it("Sets the aggregator addresses correctly", async function () {
            const response = await fundMe.priceFeed();
            assert.equal(MockV3Aggregator.address, response);
        }).end(done);
    });

    describe("fund", async function () {
        it("Fails if you don't send enough eth", async function () {
            await expect(fundMe.fund()).to.be.revertedWith(
                "You need to spend more ETH!"
            );
        });
        it("updates the amount funded data structure", async function () {
            await fundMe.fund({ value: sendValue });
            const response = await fundMe.addressToAmountFunded(deployer);
            assert.equal(sendValue.toString(), response.toString());
        });
        it("Adds funder to an array of funders", async function () {
            await fundMe.fund({ value: sendValue });
            assert.equal(deployer, await fundMe.funders(0));
        });
    });
    describe("withdraw", async function () {
        beforeEach(async function () {
            await fundMe.fund({ value: sendValue });
        });
        it("Withdraw ETH from a single founder", async function () {
            // Arrange
            const startingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            );
            const startingDeployerBalance = await fundMe.provider.getBalance(
                deployer
            );
            // act
            const transactionResponse = await fundMe.withdraw();
            const transactionReceipt = await transactionResponse.wait(1);

            const { gasUsed, effectiveGasPrice } = transactionReceipt;

            const endingFundMeBalance = await fundMe.provider.getBalance(
                fundMe.address
            );
            const endingDeployerBalance = await fundMe.provider.getBalance(
                deployer
            );
            // Assert
            assert.equal(0, endingFundMeBalance);
            assert.equal(
                startingDeployerBalance.add(startingFundMeBalance).toString(),
                endingDeployerBalance
                    .add(gasUsed.mul(effectiveGasPrice))
                    .toString()
            );
        });
        it("Only owner can withdraw", async function () {
            const newAccount = await ethers.getSigners();
            const attacker = newAccount[1];
            const attackerConnectedContract = await fundMe.connect(attacker);
            expect(attackerConnectedContract.withdraw()).to.be.revertedWith(
                "FundMe__NotOwner"
            );
        });
    });
});
