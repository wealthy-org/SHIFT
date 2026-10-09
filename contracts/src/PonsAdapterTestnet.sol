// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IPonsAdapter} from "./interfaces/IPonsAdapter.sol";
import {Roles} from "./Roles.sol";

/// @title MockERC20
/// @notice Minimal token deployed per employee launch on Robinhood testnet
contract MockEmployeeToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor(string memory name_, string memory symbol_, uint256 initialSupply, address initialOwner) {
        name = name_;
        symbol = symbol_;
        totalSupply = initialSupply;
        balanceOf[initialOwner] = initialSupply;
        emit Transfer(address(0), initialOwner, initialSupply);
    }
}

/// @title PonsAdapterTestnet
/// @notice Production-testnet adapter implementation satisfying IPonsAdapter.
/// @dev Enables real onchain token launches and market events on Robinhood Chain (46630)
///      without assuming undocumented mainnet Pons fee curves.
contract PonsAdapterTestnet is IPonsAdapter, AccessControl {
    struct MarketInfo {
        address token;
        address creator;
        uint256 launchedAt;
        uint256 reserveEth;
        uint256 reserveTok;
        uint256 accruedFees;
    }

    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 1e18; // 1B tokens
    mapping(address => MarketInfo) public markets;
    mapping(uint256 => address) public employeeTokenOf;

    error UnknownToken();
    error NotCreator();
    error TransferFailed();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function launch(uint256 employeeId, string calldata name, string calldata symbol)
        external
        payable
        override
        returns (address token, address ponsMarket)
    {
        MockEmployeeToken tok = new MockEmployeeToken(name, symbol, INITIAL_SUPPLY, address(this));
        token = address(tok);
        ponsMarket = address(this); // Adapter acts as the market pool anchor on testnet

        markets[token] = MarketInfo({
            token: token,
            creator: msg.sender,
            launchedAt: block.timestamp,
            reserveEth: msg.value > 0 ? msg.value : 0.6 ether,
            reserveTok: INITIAL_SUPPLY,
            accruedFees: 0
        });

        employeeTokenOf[employeeId] = token;

        emit TokenLaunched(employeeId, token, ponsMarket);
    }

    function readMarket(address token) external view override returns (uint256 marketCap, uint256 liquidity) {
        MarketInfo storage m = markets[token];
        if (m.token == address(0)) revert UnknownToken();
        liquidity = m.reserveEth;
        // marketCap = (reserveEth * supply) / reserveTok
        marketCap = m.reserveEth;
    }

    function claimableFees(address token) external view override returns (uint256) {
        return markets[token].accruedFees;
    }

    function claimFees(address token, address to) external override returns (uint256 amount) {
        MarketInfo storage m = markets[token];
        if (m.token == address(0)) revert UnknownToken();
        amount = m.accruedFees;
        m.accruedFees = 0;
        emit CreatorFeesClaimed(token, amount, to);
        if (amount > 0) {
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
        }
    }

    function recordTradeFee(address token) external payable {
        MarketInfo storage m = markets[token];
        if (m.token != address(0)) {
            m.accruedFees += msg.value;
        }
    }

    function capabilities() external pure override returns (bool, bool, bool) {
        return (true, true, true);
    }

    receive() external payable {}
}
