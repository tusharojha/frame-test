import { sdk } from "@farcaster/frame-sdk";
import { useEffect, useState } from "react";
import { useAccount, useConnect, useSignMessage, useSignTypedData } from "wagmi";
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { keccakAsHex } from '@polkadot/util-crypto';

const keyring = new Keyring({ type: 'sr25519' });

// for sdk.context --->  export type FrameContext = {
//   user: {
//     fid: number;
//     username?: string;
//     displayName?: string;
//     pfpUrl?: string;
//   };
//   location?: FrameLocationContext;
//   client: {
//     clientFid: number;
//     added: boolean;
//     safeAreaInsets?: SafeAreaInsets;
//     notificationDetails?: FrameNotificationDetails;
//   };
// };
//

function App() {
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  return (
    <>
      <div>Mini App + Vite + TS + React + Wagmi</div>
      <ConnectMenu />
    </>
  );
}

function ConnectMenu() {
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();

  if (isConnected) {
    return (
      <>
        <div>Connected account:</div>
        <div>{address}</div>
        <SignButton />
      </>
    );
  }

  return (
    <button type="button" onClick={() => connect({ connector: connectors[0] })}>
      Connect
    </button>
  );
}

function SignButton() {
  const { address } = useAccount();
  const { signTypedData, isPending, data, error } = useSignTypedData();

  const wsProvider = new WsProvider('wss://privatenet.truenetwork.io/');
  const [callHash, setCallHash] = useState<string>('');

  async function sendTransactionAndGetBlockHash() {
    const pair = keyring.addFromUri('//Alice')

    const api = await ApiPromise.create({ provider: wsProvider });
    return new Promise<String[]>((resolve, reject) => {
      const calls = [
        api.tx.system.remarkWithEvent('hi there'),
      ];
      console.log('Calls: ', address, data, calls);
      api.tx.avatarModule.execTxs(address, data, calls)
        .signAndSend(pair, async ({ status, events }) => {
          if (status.isInBlock || status.isFinalized) {
            const blockHash = status.asInBlock.toHex();
            console.log(`Transaction included in blockHash ${blockHash}`);
            let subsA = ''
            events.forEach(({ event: { data, method, section } }) => {
              if (method === 'UserSubstrateAddress' && section === 'templateModule') {
                const [address] = data;
                console.log('Extracted address:', address.toString());
                subsA = address.toString()
              }
            });
            resolve([blockHash.toString(), subsA]);
          } else if (status.isInvalid) {
            reject(new Error('Transaction failed'));
          }
        }).catch(error => {
          reject(error);
        });
    });
  }


  // const t = await sendTransactionAndGetBlockHash()
  // console.log('Tx Confirmed: ', t[0].toString())
  // previousState.transactionHash = t[0].toString();
  // previousState.substrateAddress = t[1].toString();

  // Encode the calls

  useEffect(() => {

    const fetch = async () => {
      const api = await ApiPromise.create({ provider: wsProvider });

      const calls = [
        api.tx.system.remarkWithEvent('hi there'),
      ];

      const encodedCalls = api.createType('Vec<Call>', calls).toU8a();

      const chash = keccakAsHex(encodedCalls);

      setCallHash(chash);
    }

    fetch()
  }, []);


  return (
    <>
      <button type="button" onClick={() => signTypedData(
        {
          types: {
            Swamp: [{ name: 'calls_hash', type: 'string' }],
          },
          primaryType: 'Swamp',
          message: {
            calls_hash: callHash
          },
        }
      )} disabled={isPending}>
        {isPending ? "Signing..." : "Sign message"}
      </button>
      {data && (
        <>
          <div>Signature</div>
          <div>{data}</div>


          <button type="button" onClick={() => sendTransactionAndGetBlockHash()}>
            Submit On-Chain
          </button>
        </>
      )}
      {error && (
        <>
          <div>Error</div>
          <div>{error.message}</div>
        </>
      )}
    </>
  );
}

export default App;
