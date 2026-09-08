import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";
import "dotenv/config";

const privateKey = process.env.PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    horizen_testnet: {
      url: process.env.HORIZEN_TESTNET_RPC_URL ?? "https://horizen-testnet.rpc.caldera.xyz/http",
      chainId: 2_651_420,
      accounts: privateKey ? [privateKey] : []
    }
  }
};

export default config;
