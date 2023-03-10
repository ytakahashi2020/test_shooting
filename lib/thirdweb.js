/// --- Thirdweb Brige ---
import { ethers } from "./ethers.js";
import { ThirdwebSDK } from "https://esm.sh/@thirdweb-dev/sdk@nightly?bundle";
// import { ethers } from "https://cdn.ethers.io/lib/ethers-5.2.esm.min.js";
// big number transform
const bigNumberReplacer = (key, value) => {
  // if we find a BigNumber then make it into a string (since that is safe)
  if (
    ethers.BigNumber.isBigNumber(value) ||
    (typeof value === "object" &&
      value !== null &&
      value.type === "BigNumber" &&
      "hex" in value)
  ) {
    return ethers.BigNumber.from(value).toString();
  }
  return value;
};

const w = window;
w.bridge = {};
w.bridge.initialize = (chain, options) => {
  console.log("bridge.initialize", chain, options);
  const sdk = new ThirdwebSDK(chain, JSON.parse(options));
  w.thirdweb = sdk;
};

w.bridge.connect = async () => {
  if (w.ethereum) {
    await w.ethereum.enable;
    const provider = new ethers.providers.Web3Provider(w.ethereum);
    await provider.send("eth_requestAccounts", []);
    if (w.thirdweb) {
      console.log("connecting SDK");
      w.thirdweb.updateSignerOrProvider(provider.getSigner());
      w.ethereum.on("accountsChanged", async (accounts) => {
        console.log("accountsChanged", accounts);
        w.thirdweb.updateSignerOrProvider(provider.getSigner());
      });
      w.ethereum.on("chainChanged", async (chain) => {
        console.log("chainChanged", chain);
        w.thirdweb.updateSignerOrProvider(provider.getSigner());
      });
      return await w.thirdweb.wallet.getAddress();
    } else {
      console.error("window.thirdweb is not defined");
      return null;
    }
  } else {
    console.error("Please install a wallet browser extension");
    return null;
  }
};

w.bridge.switchNetwork = async (chainId) => {
  try {
    if (chainId) {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + chainId.toString(16) }], // chainId must be in hexadecimal numbers
      });
    } else {
      console.error("Error switrching network");
      return null;
    }
  } catch (e) {
    console.error("Error switrching network", e);
    return null;
  }
};

w.bridge.invoke = async (route, payload) => {
  const routeArgs = route.split(".");
  const firstArg = routeArgs[0].split("#");
  const addrOrSDK = firstArg[0];

  const fnArgs = JSON.parse(payload).arguments;
  const parsedArgs = fnArgs.map((arg) => {
    try {
      return JSON.parse(arg);
    } catch (e) {
      return arg;
    }
  });
  console.log("invoke called", route, parsedArgs);

  // wallet call
  if (addrOrSDK.startsWith("sdk")) {
    let prop = undefined;
    if (firstArg.length > 1) {
      prop = firstArg[1];
    }
    if (prop && routeArgs.length === 2) {
      // TODO assumes contract call
      const result = await w.thirdweb[prop][routeArgs[1]](...parsedArgs);
      return JSON.stringify({ result: result }, bigNumberReplacer);
    } else {
      console.error("invalid route", route);
      return null;
    }
  }

  // contract call
  if (addrOrSDK.startsWith("0x")) {
    let type = undefined;
    if (firstArg.length > 1) {
      type = firstArg[1];
    }
    const contract = await w.thirdweb.getContract(addrOrSDK, type);
    if (routeArgs.length === 2) {
      // TODO assumes contract call
      const result = await contract[routeArgs[1]](...parsedArgs);
      return JSON.stringify({ result: result }, bigNumberReplacer);
    } else if (routeArgs.length === 3) {
      const result = await contract[routeArgs[1]][routeArgs[2]](...parsedArgs);
      return JSON.stringify({ result: result }, bigNumberReplacer);
    } else if (routeArgs.length === 4) {
      const result = await contract[routeArgs[1]][routeArgs[2]][routeArgs[3]](
        ...parsedArgs
      );
      return JSON.stringify({ result: result }, bigNumberReplacer);
    } else {
      console.error("invalid route", route);
      return null;
    }
  }
};
/// --- End Thirdweb Brige ---
