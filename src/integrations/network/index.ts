import * as Network from 'expo-network';

export type Connection = {
  online: boolean;
  type: string | null;
};

function read(state: Network.NetworkState): Connection {
  return {
    online: state.isConnected === true && state.isInternetReachable !== false,
    type: state.type === undefined ? null : String(state.type),
  };
}

export async function networkStatus(): Promise<Connection> {
  return read(await Network.getNetworkStateAsync());
}

export function watchNetwork(listener: (connection: Connection) => void): () => void {
  const subscription = Network.addNetworkStateListener((state) => listener(read(state)));
  return () => subscription.remove();
}
