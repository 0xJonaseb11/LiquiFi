const { ApiPromise, WsProvider } = require('@polkadot/api');

async function main() {
  const provider = new WsProvider('wss://api-paseo.n.dwellir.com/');
  const api = await ApiPromise.create({ provider });
  
  const address = '5GZGEq7VBsh1govMkQ3AS9KDFWdAGTXVER4KL96C44xShKMp';
  const { data: balance } = await api.query.system.account(address);
  
  console.log(`Balance for ${address} on Paseo Relay: ${balance.free.toHuman()}`);
  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
