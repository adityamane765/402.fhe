// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FHE402Marketplace is ZamaEthereumConfig {

    struct ApiListing {
        address merchant;
        string name;
        string description;
        uint64 price; // cleartext usdc amount per call
        bool active;
    }

    IERC20 public usdc;
    address public owner;
    address public middleware;

    uint256 public nextApiId;
    uint256 public protocolFees; // cleartext running total

    mapping(uint256 => ApiListing) public listings;
    mapping(address => euint64) private balances;  // encrypted, only buyer can read
    mapping(address => euint64) private revenue;   // encrypted, only merchant can read

    mapping(address => bool) public withdrawalPending;

    event ApiListed(uint256 indexed id, address indexed merchant, string name, uint64 price);
    event Deposited(address indexed buyer, uint64 amount);
    event CallSettled(uint256 indexed apiId, address indexed buyer);
    event WithdrawalRequested(address indexed merchant);
    event Withdrawn(address indexed merchant, uint256 amount);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        owner = msg.sender;
    }

    function setMiddleware(address _middleware) external {
        require(msg.sender == owner, "not owner");
        middleware = _middleware;
    }

    function listApi(
        string calldata name,
        string calldata description,
        uint64 price
    ) external returns (uint256 id) {
        require(price > 0, "price must be > 0");
        id = nextApiId++;
        listings[id] = ApiListing({
            merchant: msg.sender,
            name: name,
            description: description,
            price: price,
            active: true
        });
        emit ApiListed(id, msg.sender, name, price);
    }

    // deposit amount is cleartext (standard ERC20 (usdc) transfer), then wrapped into encrypted balance
    function deposit(uint64 amount) external {
        require(amount > 0, "zero amount");
        usdc.transferFrom(msg.sender, address(this), amount);

        euint64 newBal = FHE.add(balances[msg.sender], FHE.asEuint64(amount));
        newBal = FHE.allow(newBal, msg.sender);
        newBal = FHE.allowThis(newBal);
        balances[msg.sender] = newBal;

        emit Deposited(msg.sender, amount);
    }

    // middleware calls this as eth_call before granting access so no gas, returns encrypted bool
    function canAfford(uint256 apiId, address buyer) external returns (ebool) {
        require(msg.sender == middleware, "not middleware");
        uint64 price = listings[apiId].price;
        return FHE.le(FHE.asEuint64(price), balances[buyer]);
    }

    function settleCall(uint256 apiId, address buyer) external {
        require(msg.sender == middleware, "not middleware");
        require(listings[apiId].active, "api not active");

        uint64 price = listings[apiId].price;
        uint64 merchantCut = price * 9 / 10;
        uint64 protocolCut = price - merchantCut;
        address merchant = listings[apiId].merchant;

        euint64 bal = balances[buyer];
        euint64 cost = FHE.asEuint64(price);

        // FHE mux, deducts only if buyer can actually afford it
        // if they can't, balance stays the same (fraud detected off-chain via canAfford)
        ebool affordable = FHE.le(cost, bal);
        euint64 newBal = FHE.select(affordable, FHE.sub(bal, cost), bal);
        newBal = FHE.allow(newBal, buyer);
        newBal = FHE.allowThis(newBal);
        balances[buyer] = newBal;

        euint64 newRevenue = FHE.add(revenue[merchant], FHE.asEuint64(merchantCut));
        newRevenue = FHE.allow(newRevenue, merchant);
        newRevenue = FHE.allowThis(newRevenue);
        revenue[merchant] = newRevenue;

        protocolFees += protocolCut;

        emit CallSettled(apiId, buyer);
    }

    // step 1: merchant signals intent. relayer picks up the event, decrypts revenue off-chain via KMS,then calls fulfillWithdrawal with the cleartext + proof
    function requestWithdrawal() external {
        require(!withdrawalPending[msg.sender], "withdrawal already pending");
        withdrawalPending[msg.sender] = true;
        emit WithdrawalRequested(msg.sender);
    }

    // step 2: owner/relayer submits cleartext amount +KMS proof, we verify and pay out
    // handles derived from contract storage, caller cant substitute a different ciphertext
    function fulfillWithdrawal(
        address merchant,
        uint256 amount,
        bytes calldata decryptionProof
    ) external {
        require(msg.sender == owner, "not owner");
        require(withdrawalPending[merchant], "no pending withdrawal");

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = bytes32(euint64.unwrap(revenue[merchant]));
        FHE.checkSignatures(handles, abi.encode(amount), decryptionProof);

        euint64 zeroed = FHE.asEuint64(0);
        zeroed = FHE.allowThis(zeroed);
        revenue[merchant] = zeroed;

        withdrawalPending[merchant] = false;

        usdc.transfer(merchant, amount);
        emit Withdrawn(merchant, amount);
    }

    function getBalance(address buyer) external view returns (euint64) {
        require(msg.sender == buyer, "only your own balance");
        return balances[buyer];
    }

    function getRevenue(address merchant) external view returns (euint64) {
        require(msg.sender == merchant, "only your own revenue");
        return revenue[merchant];
    }

    function withdrawFees(address to) external {
        require(msg.sender == owner, "not owner");
        uint256 amount = protocolFees;
        protocolFees = 0;
        usdc.transfer(to, amount);
    }
}