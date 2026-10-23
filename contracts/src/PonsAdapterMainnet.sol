// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IPonsAdapter} from "./interfaces/IPonsAdapter.sol";

/// @dev Subset of PonsV2LaunchForwarder (0xe33E9E479dF8802cb0866d5d05258bEc4cF62948 on chain 4663),
///      ABI pulled from Sourcify's verified source. This is the permissionless entry point:
///      calling PonsV2LaunchFactory.launchToken() directly reverts NotWhitelisted for any address
///      that isn't on the factory's whitelistedLaunchers list (SHIFT isn't, and getting listed
///      requires Pons's own approval). The forwarder is not subject to that same gate — simulating
///      a call from an unlisted address reverts only on trivial validation, never
///      NotApprovedLauncher/NotWhitelisted, so it is the real way to launch without Pons's sign-off.
interface IPonsLaunchForwarder {
    struct Socials {
        string twitter;
        string telegram;
        string discord;
        string website;
        string farcaster;
    }

    struct TokenParams {
        string name;
        string symbol;
        string logo;
        string description;
        Socials socials;
        address creatorFeeRecipient;
        uint16 creatorTaxBps;
        bool buybackEnabled;
        bytes32 expectedEconomics;
        bytes32 salt;
    }

    function launchAndBuy(
        TokenParams calldata params,
        uint256 launchConfigId,
        address pairToken,
        uint256 quoteIn,
        uint256 minTokensOut,
        address recipient,
        address[] calldata snipeTaxExemptions
    ) external payable returns (address token, address curve);
}

/// @dev Subset of PonsV2LaunchFactory (0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e).
interface IPonsLaunchFactory {
    function launchFee() external view returns (uint256);
    function approvedPairTokens(address pairToken) external view returns (bool);
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title PonsAdapterMainnet
/// @notice Real Pons V2 integration on Robinhood Chain mainnet (chain 4663), routed through the
///         public launch forwarder rather than the gated factory.
/// @dev Pons's only approved pair token on this chain is USDG (confirmed onchain via
///      approvedPairTokens — WETH is NOT approved, which the first version of this contract
///      assumed). USDG is a plain ERC20 (an upgradeable proxy, not a WETH-style wrapper), so
///      there is no permissionless "deposit ETH, get USDG" call — it has to be acquired via a
///      swap and held by this contract ahead of time, topped up by the admin periodically
///      (e.g. a manual swap in a wallet, then a transfer here). launch() spends from that float
///      for quoteIn; callers still only ever send ETH, which covers Pons's flat launchFee().
/// @dev Fee claiming is NOT implemented: Pons V2's creator-fee model (per the verified factory
///      ABI) is "transfer the recipient role to a contract that then receives fees passively,"
///      not "pull a claimable balance on demand." Routing that into PayrollVault on a schedule
///      needs its own design, so capabilities() reports canRouteCreatorFees=false honestly.
contract PonsAdapterMainnet is IPonsAdapter {
    IPonsLaunchForwarder public constant FORWARDER = IPonsLaunchForwarder(0xe33E9E479dF8802cb0866d5d05258bEc4cF62948);
    IPonsLaunchFactory public constant FACTORY = IPonsLaunchFactory(0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e);
    // USDG — the only pair token Pons has approved on Robinhood Chain mainnet (6 decimals).
    IERC20 public constant PAIR_TOKEN = IERC20(0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168);
    // The one launch config live on the factory as of this writing (launchConfigCount() == 1).
    uint256 public constant LAUNCH_CONFIG_ID = 0;

    address public admin;
    // Initial-buy size per launch, drawn from this contract's own USDG float. 1 USDG (6 decimals).
    uint256 public quoteInAmount = 1_000_000;

    mapping(address => address) public curveOf; // token => its Pons bonding curve, cached from launch()

    error LaunchFailed();
    error InsufficientValue(uint256 sent, uint256 required);
    error InsufficientPairTokenFloat(uint256 have, uint256 need);
    error NotAdmin();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address admin_) {
        admin = admin_;
    }

    /// @notice Top up or lower the USDG spent as quoteIn on each launch.
    function setQuoteInAmount(uint256 amount) external onlyAdmin {
        quoteInAmount = amount;
    }

    /// @notice Pull stuck native ETH or the USDG float back out, e.g. to resize or retire this adapter.
    function rescue(address token, address to, uint256 amount) external onlyAdmin {
        if (token == address(0)) {
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert LaunchFailed();
        } else {
            IERC20(token).transfer(to, amount);
        }
    }

    function launch(uint256 employeeId, string calldata name, string calldata symbol)
        external
        payable
        override
        returns (address token, address ponsMarket)
    {
        uint256 fee = FACTORY.launchFee();
        if (msg.value != fee) revert InsufficientValue(msg.value, fee);

        uint256 have = PAIR_TOKEN.balanceOf(address(this));
        if (have < quoteInAmount) revert InsufficientPairTokenFloat(have, quoteInAmount);
        PAIR_TOKEN.approve(address(FORWARDER), quoteInAmount);

        IPonsLaunchForwarder.TokenParams memory params = IPonsLaunchForwarder.TokenParams({
            name: name,
            symbol: symbol,
            logo: "",
            description: "",
            socials: IPonsLaunchForwarder.Socials({twitter: "", telegram: "", discord: "", website: "", farcaster: ""}),
            creatorFeeRecipient: address(this),
            creatorTaxBps: 100, // 1% — matches the brief's payroll-funding intent, adjust if Pons caps this lower
            buybackEnabled: false,
            expectedEconomics: bytes32(0),
            salt: keccak256(abi.encodePacked(employeeId, block.timestamp))
        });

        address[] memory noExemptions = new address[](0);
        (token, ponsMarket) = FORWARDER.launchAndBuy{value: fee}(
            params,
            LAUNCH_CONFIG_ID,
            address(PAIR_TOKEN),
            quoteInAmount,
            0, // minTokensOut: no slippage floor on the initial buy
            msg.sender, // recipient of the initial buy
            noExemptions
        );
        if (token == address(0)) revert LaunchFailed();

        curveOf[token] = ponsMarket;
        emit TokenLaunched(employeeId, token, ponsMarket);
    }

    function readMarket(address token) external view override returns (uint256 marketCap, uint256 liquidity) {
        address curve = curveOf[token];
        if (curve == address(0)) return (0, 0);
        // The curve contract holds the USDG side of the bonding-curve reserve; using it as both
        // figures is a simplification (same one PonsAdapterTestnet made with reserveEth) — a real
        // market-cap read needs the curve's own price function, not pulled into this ABI yet.
        liquidity = PAIR_TOKEN.balanceOf(curve);
        marketCap = liquidity;
    }

    function claimableFees(address) external pure override returns (uint256) {
        return 0; // see contract-level note: not wired up yet
    }

    function claimFees(address, address) external pure override returns (uint256) {
        revert("PONS_FEE_ROUTING_NOT_IMPLEMENTED");
    }

    function capabilities() external pure override returns (bool canLaunch, bool canReadMarket, bool canRouteCreatorFees) {
        return (true, true, false);
    }
}
