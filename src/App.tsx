import { useEffect, useState } from "react";
import { sdk } from "@farcaster/frame-sdk";
import { useAccount, useConnect, useSignTypedData } from "wagmi";
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { keccakAsHex } from '@polkadot/util-crypto';
import type { Context } from '@farcaster/frame-core';
import "./index.css";

const keyring = new Keyring({ type: 'sr25519' });

function App() {
  const [frameCtx, setFrameCtx] = useState<Context.FrameContext>();

  useEffect(() => {
    const getCtx = async () => {
      const ctx = await sdk.context;
      setFrameCtx(ctx);
    }

    getCtx().then(() => sdk.actions.ready());
  }, []);

  return (
    <div className="fc-app-bg">
      <div className="fc-card">
        <UserProfile frameCtx={frameCtx} />
        <ConnectMenu />
        <AirdropCard />
        <ForumIdeaCard
          user="A"
          text="Great work from A"
          support={0.7}
        />
        <ForumIdeaCard
          user="B"
          text="Do people want my idea - could be forum or something new??"
          support={0.4}
        />
        <ForumIdeaCard
          user="C"
          text="Great work from C"
          support={0.9}
        />
      </div>
    </div>
  );
}

function UserProfile({ frameCtx }: { readonly frameCtx?: Context.FrameContext }) {
  const { isConnected, address } = useAccount();

  return (
    <div className="fc-profile">
      <div className="fc-avatar" />
      <div>
        <div className="fc-username">{frameCtx?.user.displayName}</div>
        <div className="fc-wallet">{isConnected ? address : "wallet addr"}</div>
      </div>
    </div>
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

function AirdropCard() {
  return (
    <div className="fc-airdrop-card">
      <span className="fc-airdrop-title">Token Airdrop:</span> <span className="fc-airdrop-token">$GG FORUM Idea</span>
    </div>
  );
}

function ForumIdeaCard({ text, support }: { user: string; text: string; support: number }) {
  return (
    <div className="fc-idea-card">
      <div className="fc-idea-text">{text}</div>
      <div className="fc-vote-bar">
        <div className="fc-vote-bar-support" style={{ width: `${support * 100}%` }} />
        <div className="fc-vote-bar-oppose" style={{ width: `${(1 - support) * 100}%` }} />
      </div>
    </div>
  );
}

export default App;
