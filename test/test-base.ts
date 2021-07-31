import { account, bn18, deployArtifact, resetNetworkFork, tag } from "@defi.org/web3-candies";
import CBN from "chai-bn";
import chai from "chai";
import BN from "bn.js";
import { Distributor } from "../typechain-hardhat/Distributor";

export let deployer: string;
export let address1: string;
export let devWallet: string;
export let distributor: Distributor;

before(() => {
  chai.use(CBN(BN));
});

export async function prepareForTests() {
  while (true) {
    try {
      return await doInitState();
    } catch (e) {
      console.error(e, "\ntrying again...");
    }
  }
}

async function doInitState() {
  await resetNetworkFork();

  deployer = await account(0);
  tag(deployer, "deployer");

  address1 = await account(1);
  devWallet = await account(2);
  distributor = await deployArtifact<Distributor>("Distributor", { from: deployer }, [bn18(5)]);
}
