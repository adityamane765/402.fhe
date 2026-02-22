import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";

describe("FHE402Marketplace", function () {
  let marketplace: any;
  let usdc: any;
  let owner: any;
  let middleware: any;
  let merchant: any;
  let buyer: any;

  beforeEach(async function () {
    [owner, middleware, merchant, buyer] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const Marketplace = await ethers.getContractFactory("FHE402Marketplace");
    marketplace = await Marketplace.deploy(await usdc.getAddress());
    await marketplace.waitForDeployment();
    await marketplace.setMiddleware(middleware.address);

    // mint 100 USDC to buyer
    await usdc.mint(buyer.address, 100_000_000n);
  });

  it("Test 1: listApi", async function () {
    const name = "Weather API";
    const desc = "Live weather data";
    const price = 2_000_000n;

    await expect(marketplace.connect(merchant).listApi(name, desc, price))
      .to.emit(marketplace, "ApiListed")
      .withArgs(0, merchant.address, name, price);

    const listing = await marketplace.listings(0);
    expect(listing.merchant).to.equal(merchant.address);
    expect(listing.name).to.equal(name);
    expect(listing.description).to.equal(desc);
    expect(listing.price).to.equal(price);
    expect(listing.active).to.be.true;
  });

  it("Test 2: deposit — first deposit", async function () {
    const amount = 10_000_000n;
    await usdc.connect(buyer).approve(await marketplace.getAddress(), amount);
    await expect(marketplace.connect(buyer).deposit(amount))
      .to.emit(marketplace, "Deposited")
      .withArgs(buyer.address, amount);

    const handle = await marketplace.connect(buyer).getBalance(buyer.address);
    const decryptedBal = await hre.fhevm.debugger.decryptEuint(FhevmType.euint64, handle);
    expect(decryptedBal).to.equal(amount);
  });

  it("Test 3: deposit — second deposit accumulates", async function () {
    await usdc.connect(buyer).approve(await marketplace.getAddress(), 10_000_000n);
    await marketplace.connect(buyer).deposit(5_000_000n);
    await marketplace.connect(buyer).deposit(3_000_000n);
    const handle = await marketplace.connect(buyer).getBalance(buyer.address);
    const decryptedBal = await hre.fhevm.debugger.decryptEuint(FhevmType.euint64, handle);
    expect(decryptedBal).to.equal(8_000_000n);
  });

  it("Test 4: settleCall — happy path", async function () {
    // setup: list and deposit
    await marketplace.connect(merchant).listApi("API", "Desc", 2_000_000n);
    await usdc.connect(buyer).approve(await marketplace.getAddress(), 10_000_000n);
    await marketplace.connect(buyer).deposit(10_000_000n);
    await expect(marketplace.connect(middleware).settleCall(0, buyer.address))
      .to.emit(marketplace, "CallSettled")
      .withArgs(0, buyer.address);

    const buyerHandle = await marketplace.connect(buyer).getBalance(buyer.address);
    const buyerBal = await hre.fhevm.debugger.decryptEuint(FhevmType.euint64, buyerHandle);
    expect(buyerBal).to.equal(8_000_000n);
    const merchantHandle = await marketplace.connect(merchant).getRevenue(merchant.address);
    const merchantRev = await hre.fhevm.debugger.decryptEuint(FhevmType.euint64, merchantHandle);
    expect(merchantRev).to.equal(1_800_000n);
    const protocolHandle = await marketplace.protocolFees();
    const protocolFees = await hre.fhevm.debugger.decryptEuint(FhevmType.euint64, protocolHandle);
    expect(protocolFees).to.equal(200_000n);
  });

  it("Test 5: settleCall — buyer can't afford (FHE mux holds)", async function () {
    await marketplace.connect(merchant).listApi("API", "Desc", 5_000_000n);
    await usdc.connect(buyer).approve(await marketplace.getAddress(), 10_000_000n);
    await marketplace.connect(buyer).deposit(2_000_000n);
    await marketplace.connect(middleware).settleCall(0, buyer.address);
    const buyerHandle = await marketplace.connect(buyer).getBalance(buyer.address);
    const buyerBal = await hre.fhevm.debugger.decryptEuint(FhevmType.euint64, buyerHandle);
    expect(buyerBal).to.equal(2_000_000n);
    const merchantHandle = await marketplace.connect(merchant).getRevenue(merchant.address);
    const merchantRev = await hre.fhevm.debugger.decryptEuint(FhevmType.euint64, merchantHandle);
    expect(merchantRev).to.equal(0n);
    const protocolHandle = await marketplace.protocolFees();
    const protocolFees = await hre.fhevm.debugger.decryptEuint(FhevmType.euint64, protocolHandle);
    expect(protocolFees).to.equal(0n);
  });

  it("Test 6: settleCall — access control", async function () {
    await expect(marketplace.connect(owner).settleCall(0, buyer.address))
      .to.be.revertedWith("not middleware");
  });

  it("Test 7: requestWithdrawal", async function () {
    await expect(marketplace.connect(merchant).requestWithdrawal())
      .to.emit(marketplace, "WithdrawalRequested")
      .withArgs(merchant.address);
    expect(await marketplace.withdrawalPending(merchant.address)).to.be.true;

    await expect(marketplace.connect(merchant).requestWithdrawal())
      .to.be.revertedWith("withdrawal already pending");
  });

  it("Test 8: canAfford — reverts for non-middleware", async function () {
    await expect(marketplace.connect(buyer).canAfford(0, buyer.address))
      .to.be.revertedWith("not middleware");
  });
});
