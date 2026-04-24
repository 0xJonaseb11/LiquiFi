// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title CrossChainLiquidator
/// @notice Orchestrates cross-chain liquidation workflows via LayerZero messaging
/// @dev In local/test mode, this uses direct calls instead of actual cross-chain messages.
///      Production would integrate with LayerZero's ILayerZeroEndpoint for real message passing.
///      State machine: PENDING → BRIDGING → CONFIRMING → EXECUTING → COMPLETE | FAILED
contract CrossChainLiquidator is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────
    //  Custom Errors
    // ──────────────────────────────────────────────

    error InvalidState(uint256 requestId, CrossChainState current, CrossChainState expected);
    error RequestNotFound(uint256 requestId);
    error RequestExpired(uint256 requestId);
    error InsufficientBridgedFunds();
    error UnauthorizedEndpoint();
    error MaxRetriesExceeded(uint256 requestId);

    // ──────────────────────────────────────────────
    //  Enums & Structs
    // ──────────────────────────────────────────────

    enum CrossChainState {
        NONE,
        PENDING, // Request created, awaiting bridge initiation
        BRIDGING, // Funds being bridged from source chain
        CONFIRMING, // Bridge TX confirmed, awaiting funds arrival
        EXECUTING, // Liquidation being executed on target chain
        COMPLETE, // Successfully completed
        FAILED // Failed after max retries → dead letter queue
    }

    struct LiquidationRequest {
        uint256 id;
        address borrower; // Target borrower on this chain
        uint256 repayAmount; // USDC amount needed for liquidation
        uint16 sourceChainId; // LayerZero chain ID of fund source
        uint256 createdAt;
        uint256 deadline; // Auto-expire timestamp
        uint8 retryCount;
        CrossChainState state;
    }

    // ──────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────

    uint8 public constant MAX_RETRIES = 3;
    uint256 public constant REQUEST_TIMEOUT = 5 minutes;

    // ──────────────────────────────────────────────
    //  State Variables
    // ──────────────────────────────────────────────

    /// @notice The lending pool contract to call liquidate() on
    address public lendingPool;

    /// @notice The debt token (USDC) used for repayment
    IERC20 public debtToken;

    /// @notice LayerZero endpoint (or mock for testing)
    address public lzEndpoint;

    /// @notice Auto-incrementing request ID
    uint256 public nextRequestId;

    /// @notice requestId → LiquidationRequest
    mapping(uint256 => LiquidationRequest) public requests;

    /// @notice Dead letter queue: failed request IDs for manual review
    uint256[] public deadLetterQueue;

    /// @notice Trusted remote addresses per chain (LayerZero pattern)
    mapping(uint16 => bytes) public trustedRemotes;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event CrossChainLiquidationRequested(
        uint256 indexed requestId,
        address borrower,
        uint256 repayAmount,
        uint16 sourceChain
    );
    event CrossChainStateChanged(uint256 indexed requestId, CrossChainState from, CrossChainState to);
    event CrossChainLiquidationComplete(uint256 indexed requestId, address borrower, uint256 repayAmount);
    event CrossChainLiquidationFailed(uint256 indexed requestId, string reason);
    event DeadLetterQueued(uint256 indexed requestId);
    event RetryAttempt(uint256 indexed requestId, uint8 attempt);

    // ──────────────────────────────────────────────
    //  Initializer
    // ──────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _lendingPool,
        address _debtToken,
        address _lzEndpoint,
        address _owner
    ) external initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        lendingPool = _lendingPool;
        debtToken = IERC20(_debtToken);
        lzEndpoint = _lzEndpoint;
        nextRequestId = 1;
    }

    // ──────────────────────────────────────────────
    //  Cross-Chain Liquidation Flow
    // ──────────────────────────────────────────────

    /// @notice Initiate a cross-chain liquidation request
    /// @dev Called by the liquidation bot when local funds are insufficient.
    ///      In test mode: immediately simulates the full flow.
    ///      In production: sends a LayerZero message to the source chain.
    /// @param borrower The borrower to liquidate on this chain
    /// @param repayAmount USDC amount needed (6 decimals)
    /// @param sourceChainId The LayerZero chain ID to source funds from
    function requestCrossChainLiquidation(
        address borrower,
        uint256 repayAmount,
        uint16 sourceChainId
    ) external onlyOwner nonReentrant returns (uint256 requestId) {
        requestId = nextRequestId;
        unchecked {
            ++nextRequestId;
        }

        requests[requestId] = LiquidationRequest({
            id: requestId,
            borrower: borrower,
            repayAmount: repayAmount,
            sourceChainId: sourceChainId,
            createdAt: block.timestamp,
            deadline: block.timestamp + REQUEST_TIMEOUT,
            retryCount: 0,
            state: CrossChainState.PENDING
        });

        emit CrossChainLiquidationRequested(requestId, borrower, repayAmount, sourceChainId);

        // In test mode (lzEndpoint == address(0)), simulate immediate bridge
        if (lzEndpoint == address(0)) {
            _transitionState(requestId, CrossChainState.PENDING, CrossChainState.BRIDGING);
            _transitionState(requestId, CrossChainState.BRIDGING, CrossChainState.CONFIRMING);
        } else {
            _transitionState(requestId, CrossChainState.PENDING, CrossChainState.BRIDGING);
            // Production: would call ILayerZeroEndpoint(lzEndpoint).send(...)
            // with encoded payload: abi.encode(requestId, repayAmount, address(this))
        }
    }

    /// @notice Called when bridged funds arrive (by bot or LayerZero receiver)
    /// @param requestId The request to fulfill
    function confirmFundsReceived(uint256 requestId) external onlyOwner nonReentrant {
        LiquidationRequest storage req = requests[requestId];
        if (req.state == CrossChainState.NONE) revert RequestNotFound(requestId);
        if (block.timestamp > req.deadline) revert RequestExpired(requestId);

        _transitionState(requestId, CrossChainState.CONFIRMING, CrossChainState.EXECUTING);

        // Verify we have the funds
        uint256 balance = debtToken.balanceOf(address(this));
        if (balance < req.repayAmount) {
            _handleFailure(requestId, "Insufficient bridged funds");
            return;
        }

        // Execute liquidation on the lending pool
        debtToken.safeIncreaseAllowance(lendingPool, req.repayAmount);

        // Call the lending pool's liquidate function
        // Using low-level call to handle revert gracefully
        (bool success, bytes memory returnData) = lendingPool.call(
            abi.encodeWithSignature("liquidate(address,uint256)", req.borrower, req.repayAmount)
        );

        if (success) {
            _transitionState(requestId, CrossChainState.EXECUTING, CrossChainState.COMPLETE);
            emit CrossChainLiquidationComplete(requestId, req.borrower, req.repayAmount);
        } else {
            string memory reason = returnData.length > 0 ? string(returnData) : "Liquidation reverted";
            _handleFailure(requestId, reason);
        }
    }

    /// @notice Retry a failed request (if under max retries)
    function retry(uint256 requestId) external onlyOwner nonReentrant {
        LiquidationRequest storage req = requests[requestId];
        if (req.state != CrossChainState.FAILED) {
            revert InvalidState(requestId, req.state, CrossChainState.FAILED);
        }
        if (req.retryCount >= MAX_RETRIES) revert MaxRetriesExceeded(requestId);

        unchecked {
            ++req.retryCount;
        }
        req.deadline = block.timestamp + REQUEST_TIMEOUT;
        req.state = CrossChainState.PENDING;

        emit RetryAttempt(requestId, req.retryCount);
    }

    // ──────────────────────────────────────────────
    //  LayerZero Receiver (production stub)
    // ──────────────────────────────────────────────

    /// @notice LayerZero message receiver — called by the LZ endpoint
    /// @dev In production, this would decode the payload and process incoming fund notifications
    function lzReceive(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 /* _nonce */,
        bytes calldata _payload
    ) external {
        if (msg.sender != lzEndpoint) revert UnauthorizedEndpoint();

        // Verify trusted remote
        bytes memory trustedRemote = trustedRemotes[_srcChainId];
        if (keccak256(trustedRemote) != keccak256(_srcAddress)) revert UnauthorizedEndpoint();

        // Decode payload
        (uint256 requestId, bool fundsTransferred) = abi.decode(_payload, (uint256, bool));

        if (fundsTransferred) {
            _transitionState(requestId, CrossChainState.BRIDGING, CrossChainState.CONFIRMING);
        }
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    /// @notice Set trusted remote address for a chain
    function setTrustedRemote(uint16 chainId, bytes calldata path) external onlyOwner {
        trustedRemotes[chainId] = path;
    }

    /// @notice Get dead letter queue length
    function getDeadLetterQueueLength() external view returns (uint256) {
        return deadLetterQueue.length;
    }

    /// @notice Get request details
    function getRequest(uint256 requestId) external view returns (LiquidationRequest memory) {
        return requests[requestId];
    }

    // ──────────────────────────────────────────────
    //  Internal
    // ──────────────────────────────────────────────

    function _transitionState(uint256 requestId, CrossChainState expectedFrom, CrossChainState to) internal {
        CrossChainState current = requests[requestId].state;
        if (current != expectedFrom) revert InvalidState(requestId, current, expectedFrom);
        requests[requestId].state = to;
        emit CrossChainStateChanged(requestId, expectedFrom, to);
    }

    function _handleFailure(uint256 requestId, string memory reason) internal {
        LiquidationRequest storage req = requests[requestId];
        if (req.retryCount >= MAX_RETRIES) {
            req.state = CrossChainState.FAILED;
            deadLetterQueue.push(requestId);
            emit DeadLetterQueued(requestId);
        } else {
            req.state = CrossChainState.FAILED;
        }
        emit CrossChainLiquidationFailed(requestId, reason);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
