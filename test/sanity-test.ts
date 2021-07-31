import { deployer, distributor, prepareForTests } from "./test-base";
import { expect } from "chai";
import { bn, bn18, erc20, expectRevert, impersonate, max, web3 } from "@defi.org/web3-candies";

describe("Distributor", () => {
  beforeEach(async () => {
    await prepareForTests();
  });

  it("Distributor sanity tests", async () => {
    const MSAddress = "0x6a98Aaed66835F6b0b709Ac10d85AA4fE26161F7";
    const myAddress = "0x2325079108Ce42689af06157854F2F48CB268aBA";

    await web3().eth.sendTransaction({ from: deployer, to: MSAddress, value: bn18(5) });

    await distributor.methods.transferOwnership(MSAddress).send({ from: deployer });
    expect(await distributor.methods.owner().call()).equals(MSAddress);

    await impersonate(MSAddress);

    await expectRevert(
      async () => await distributor.methods.distributeXUNIC(myAddress, bn18(1)).send({ from: deployer })
    );
    await expectRevert(
      async () => await distributor.methods.distributeXUNIC(myAddress, bn18(6)).send({ from: MSAddress })
    );

    await distributor.methods.setMaxExtraAmount(bn18(7)).send({ from: MSAddress });

    const MSxUNICBalance = await distributor.methods.xunicMSBalance().call();
    console.log("MSxUNICBalance", MSxUNICBalance);

    const myXUNICBalance = await erc20("XUNIC", "0xA62fB0c2Fb3C7b27797dC04e1fEA06C0a2Db919a")
      .methods.balanceOf(myAddress)
      .call();

    await erc20("XUNIC", "0xA62fB0c2Fb3C7b27797dC04e1fEA06C0a2Db919a")
      .methods.approve(distributor.options.address, max)
      .send({ from: MSAddress });

    await distributor.methods.distributeXUNIC(myAddress, bn18(6)).send({ from: MSAddress });

    expect(
      await erc20("XUNIC", "0xA62fB0c2Fb3C7b27797dC04e1fEA06C0a2Db919a").methods.balanceOf(myAddress).call()
    ).bignumber.eq(
      bn(myXUNICBalance)
        .add(bn18(6))
        .add(bn(MSxUNICBalance).sub(bn18(6)).div(bn(4)))
    );
  });
});
