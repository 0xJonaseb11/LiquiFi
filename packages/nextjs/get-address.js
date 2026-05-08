const { cryptoWaitReady, keyExtractPath, mnemonicToMiniSecret, ed25519PairFromSeed, sr25519PairFromSeed } = require('@polkadot/util-crypto');
const { Keyring } = require('@polkadot/keyring');

async function main() {
  await cryptoWaitReady();
  const mnemonic = 'card verb awesome author repeat almost human noodle hockey alert sibling dune';
  const keyringSR = new Keyring({ type: 'sr25519' });
  const pairSR = keyringSR.addFromUri(mnemonic);
  console.log('SR25519 Address:', pairSR.address);

  const keyringED = new Keyring({ type: 'ed25519' });
  const pairED = keyringED.addFromUri(mnemonic);
  console.log('ED25519 Address:', pairED.address);
}

main().catch(console.error);
