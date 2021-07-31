// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TheAbsoluteUnit is ERC20 {
    uint256 public lastPrice;
    address public devAddress;
    OwnerHistory[] public ownersHistory;

    struct OwnerHistory {
        address owner;
        uint256 startTimeStamp;
        uint256 startBlock;
        uint256 endTimeStamp;
        uint256 endBlock;
    }

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address _devAddress
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
        lastPrice = 0.1 ether;
        devAddress = _devAddress;
    }

    function decimals() public view virtual override returns (uint8) {
        return 0;
    }

    function transferFromWithValue(
        address sender,
        address recipient,
        uint256 amount
    ) public payable virtual returns (bool) {
        return super.transferFrom(sender, recipient, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (from == address(0)) {
            // Minting
            return;
        }

        require(msg.value >= (lastPrice * 2), "You need to send at least twice the amount of previous price");

        if (allowance(from, msg.sender) == 0) {
            _approve(from, msg.sender, 1);
        }
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        lastPrice = msg.value;

        if (ownersHistory.length > 0) {
            OwnerHistory storage currentOwner = ownersHistory[ownersHistory.length - 1];
            currentOwner.endTimeStamp = block.timestamp;
            currentOwner.endBlock = block.number;
        }

        ownersHistory.push(OwnerHistory(to, block.timestamp, block.number, 0, 0));

        uint256 devAmount = (msg.value * 100) / 1000;
        payable(devAddress).transfer(devAmount);
        payable(from).transfer(msg.value - devAmount);
    }

    function getOwnersHistory() public view returns (OwnerHistory[] memory) {
        return ownersHistory;
    }
}
