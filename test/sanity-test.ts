import { address1, devWallet, deployer, prepareForTests, theAbsoluteUnit, distributor } from "./test-base";
import { expect } from "chai";
import {bn, bn18, erc20, expectRevert, fmt18, impersonate, max, mineBlocks, web3, zero} from "@defi.org/web3-candies";

describe("The Absolute Unit Sanity Tests", () => {
  beforeEach(async () => {
    await prepareForTests();
  });

  it("After Deploying", async () => {
    expect(await theAbsoluteUnit.methods.balanceOf(deployer).call()).bignumber.equals("1");
    expect(await theAbsoluteUnit.methods.lastPrice().call()).bignumber.equals(bn18("0.1"));
  });

  it("Can't transfer token", async () => {
    await expectRevert(
      // No ETH sent
      async () => await theAbsoluteUnit.methods.transferFrom(deployer, address1, "1").send({ from: address1 })
    );

    await expectRevert(
      // Sending less then twice ETH
      async () =>
        await theAbsoluteUnit.methods
          .transferFromWithValue(deployer, address1, "1")
          .send({ from: address1, value: bn18("0.19") })
    );
  });

  it("Transferring token", async () => {
    const prevDeployerETHBalance = await web3().eth.getBalance(deployer);
    const prevAddress1ETHBalance = await web3().eth.getBalance(address1);
    const prevDevWalletETHBalance = await web3().eth.getBalance(devWallet);
    let price = bn18("0.1");
    let fees = bn("0");
    let deployerValue = bn("0");
    let address1Value = bn("0");

    const numberOfSwaps = 10;

    for (let i = 1; i < numberOfSwaps; i++) {
      price = price.mul(bn("2"));

      let result = await theAbsoluteUnit.methods.transferFromWithValue(deployer, address1, "1").send({
        from: address1,
        value: price,
      });
      let transaction = await web3().eth.getTransaction(result.transactionHash);
      let gasFee = bn(result.gasUsed).mul(bn(transaction.gasPrice));

      fees = fees.add(price.mul(bn("100")).div(bn("1000")));
      deployerValue = deployerValue.add(price.mul(bn("900")).div(bn("1000")));
      address1Value = address1Value.sub(price).sub(gasFee);

      expect(await theAbsoluteUnit.methods.balanceOf(deployer).call()).bignumber.equals(zero);
      expect(await theAbsoluteUnit.methods.balanceOf(address1).call()).bignumber.equals("1");
      expect(await web3().eth.getBalance(deployer)).bignumber.equals(bn(prevDeployerETHBalance).add(deployerValue));
      expect(await web3().eth.getBalance(address1)).bignumber.equals(bn(prevAddress1ETHBalance).add(address1Value));
      expect(await web3().eth.getBalance(devWallet)).bignumber.equals(bn(prevDevWalletETHBalance).add(fees));

      let ownersHistory = await theAbsoluteUnit.methods.getOwnersHistory().call();

      expect(bn(ownersHistory.length)).bignumber.equals(bn(i * 2));
      expect(ownersHistory[ownersHistory.length - 1][0]).equals(address1);
      expect(ownersHistory[ownersHistory.length - 1][2]).bignumber.equals(bn(await web3().eth.getBlockNumber()));

      // ---

      const blocksToMine = 10;

      await mineBlocks(12 * blocksToMine, 12);

      // ---

      price = price.mul(bn("2"));

      result = await theAbsoluteUnit.methods.transferFromWithValue(address1, deployer, "1").send({
        from: deployer,
        value: price,
      });
      transaction = await web3().eth.getTransaction(result.transactionHash);
      gasFee = bn(result.gasUsed).mul(bn(transaction.gasPrice));

      fees = fees.add(price.mul(bn("100")).div(bn("1000")));
      address1Value = address1Value.add(price.mul(bn("900")).div(bn("1000")));
      deployerValue = deployerValue.sub(price).sub(gasFee);

      expect(await theAbsoluteUnit.methods.balanceOf(address1).call()).bignumber.equals(zero);
      expect(await theAbsoluteUnit.methods.balanceOf(deployer).call()).bignumber.equals("1");
      expect(await web3().eth.getBalance(deployer)).bignumber.equals(bn(prevDeployerETHBalance).add(deployerValue));
      expect(await web3().eth.getBalance(address1)).bignumber.equals(bn(prevAddress1ETHBalance).add(address1Value));
      expect(await web3().eth.getBalance(devWallet)).bignumber.equals(bn(prevDevWalletETHBalance).add(fees));

      ownersHistory = await theAbsoluteUnit.methods.getOwnersHistory().call();

      expect(bn(ownersHistory.length)).bignumber.equals(bn(i * 2 + 1));
      expect(ownersHistory[ownersHistory.length - 2][4]).bignumber.equals(
        bn(parseInt(ownersHistory[ownersHistory.length - 2][2]) + blocksToMine + 1)
      );
      expect(ownersHistory[ownersHistory.length - 1][0]).equals(deployer);
      expect(ownersHistory[ownersHistory.length - 1][2]).bignumber.equals(bn(await web3().eth.getBlockNumber()));
    }

    console.log(`Last Price is ${fmt18(price)} ETH`);
    console.log(
      `Dev Wallet Fees after ${numberOfSwaps * 2} swaps is ${fmt18(
        bn(await web3().eth.getBalance(devWallet)).sub(bn(prevDevWalletETHBalance))
      )} ETH`
    );
  });

  it("Transferring token for someone else", async () => {
    await theAbsoluteUnit.methods.transferFromWithValue(deployer, address1, "1").send({
      from: devWallet,
      value: bn18("0.2"),
    });

    expect(await theAbsoluteUnit.methods.balanceOf(deployer).call()).bignumber.equals(zero);
    expect(await theAbsoluteUnit.methods.balanceOf(address1).call()).bignumber.equals("1");
  });

  it.only("Distributor sanity tests", async () => {
    const MSAddress = "0x6a98Aaed66835F6b0b709Ac10d85AA4fE26161F7";
    const myAddress = "0x2325079108Ce42689af06157854F2F48CB268aBA";

    await web3().eth.sendTransaction({from: deployer, to: MSAddress, value: bn18(5)});

    await distributor.methods.transferOwnership(MSAddress).send({ from: deployer });
    expect(await distributor.methods.owner().call()).equals(MSAddress);

    await impersonate(MSAddress);

    await expectRevert(
      async () =>
        await distributor.methods
          .distributeXUNIC(myAddress, bn18(1))
          .send({ from: deployer })
    );
    await expectRevert(
      async () =>
        await distributor.methods
          .distributeXUNIC(myAddress, bn18(6))
          .send({ from: MSAddress })
    );

    await distributor.methods.setMaxExtraAmount(bn18(7)).send({from: MSAddress});

    const MSxUNICBalance = await distributor.methods.xunicMSBalance().call();
    console.log("MSxUNICBalance", MSxUNICBalance);

    const myXUNICBalance = await erc20("XUNIC", "0xA62fB0c2Fb3C7b27797dC04e1fEA06C0a2Db919a").methods.balanceOf(myAddress).call();

    await erc20("XUNIC", "0xA62fB0c2Fb3C7b27797dC04e1fEA06C0a2Db919a").methods.approve(distributor.options.address, max).send({ from: MSAddress});

    await distributor.methods
        .distributeXUNIC(myAddress, bn18(6))
        .send({ from: MSAddress });

    expect(await erc20("XUNIC", "0xA62fB0c2Fb3C7b27797dC04e1fEA06C0a2Db919a").methods.balanceOf(myAddress).call())
        .bignumber.eq(bn(myXUNICBalance).add(bn18(6)).add((bn(MSxUNICBalance).sub(bn18(6))).div(bn(4))))

  });
});
