// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

//import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.3.0/contracts/access/Ownable.sol";
//import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.3.0/contracts/token/ERC20/SafeERC20.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface MultiSigWallet {
    function getOwners() external returns (address[] memory);
}

contract Distributor is Ownable {
    using SafeERC20 for IERC20;

    address public constant MS_WALLET = address(0x6a98Aaed66835F6b0b709Ac10d85AA4fE26161F7);
    address public constant XUNIC = address(0xA62fB0c2Fb3C7b27797dC04e1fEA06C0a2Db919a);

    uint256 public extraAmountMax;

    event Distributed(uint256 collected, uint256 piece, address indexed extraRecipient, uint256 extraAmount);

    constructor(uint256 _maxExtraAmount) {
        setMaxExtraAmount(_maxExtraAmount);
    }

    function xunicBalance() public view returns (uint256) {
        return IERC20(XUNIC).balanceOf(address(this));
    }

    function xunicMSBalance() public view returns (uint256) {
        return IERC20(XUNIC).balanceOf(MS_WALLET);
    }

    function getReceivers() public returns (address[] memory) {
        return MultiSigWallet(MS_WALLET).getOwners();
    }

    function setMaxExtraAmount(uint256 _maxExtraAmount) public onlyOwner {
        extraAmountMax = _maxExtraAmount;
    }

    function distributeXUNIC(address extraRecipient_, uint256 extraAmount_) external onlyOwner {
        uint256 msBalance = xunicMSBalance();
        require(msBalance > 0, "There is 0 balance in the MS");

        IERC20(XUNIC).transferFrom(MS_WALLET, address(this), msBalance);
        uint256 collected = xunicBalance();
        require(collected >= extraAmount_ && extraAmount_ <= extraAmountMax, "Extra amount no good");

        collected = collected - extraAmount_;
        IERC20(XUNIC).transfer(extraRecipient_, extraAmount_);

        address[] memory receivers = getReceivers();

        uint256 piece = collected / receivers.length;
        for (uint256 i = 0; i < receivers.length; i++) IERC20(XUNIC).transfer(address(receivers[i]), piece);

        emit Distributed(collected, piece, extraRecipient_, extraAmount_);
    }

    function emergencyTransferAsset(
        address asset_,
        address to_,
        uint256 amount_
    ) public onlyOwner {
        IERC20(asset_).transfer(to_, amount_);
    }

    function emergencySafeTransferAsset(
        address asset_,
        address to_,
        uint256 amount_
    ) public onlyOwner {
        IERC20(asset_).safeTransfer(to_, amount_);
    }

    function emergencyTransferAll(address[] memory tokens_, address to_) public onlyOwner {
        uint256 ercLen = tokens_.length;
        for (uint256 i = 0; i < ercLen; i++) {
            IERC20 erc = IERC20(tokens_[i]);
            uint256 balance = erc.balanceOf(address(this));
            if (balance > 0) {
                erc.safeTransfer(to_, balance);
            }
        }
    }

    function emergencySubmitTransaction(
        address destination,
        bytes memory data,
        uint256 gasLimit
    ) public onlyOwner returns (bool) {
        uint256 dataLength = data.length;
        bool result;
        // solhint-disable-next-line
        assembly {
            let x := mload(0x40) // memory for output
            let d := add(data, 32) // first 32 bytes are the padded length of data, so exclude that
            result := call(
                gasLimit,
                destination,
                0, // value is ignored
                d,
                dataLength,
                x,
                0 // output is ignored
            )
        }
        return result;
    }
}
