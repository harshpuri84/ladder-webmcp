import { useSyncExternalStore } from 'react';
import { registerWhenReady } from '../webmcp/adapter';
import { registerEdgeTools } from './tools';
import { edgeStore } from './store';
import { HeadPanel } from './ui/HeadPanel';
import { AutonomyBar } from './ui/AutonomyBar';
import { AuthorityBar } from './ui/AuthorityBar';
import { Rack } from './ui/Rack';
import { BenchDrawer } from './ui/BenchDrawer';
import { EventLog } from './ui/EventLog';

// Registers immediately if the namespace is already there, otherwise waits for a host that
// injects it a moment later and registers the instant it appears. Same contract as the freight
// console; see registerWhenReady's doc comment in webmcp/adapter.ts.
registerWhenReady(registerEdgeTools);

export default function EdgeApp() {
  // The store mutates in place, so the version counter is the snapshot — an object identity
  // comparison would bail out of every re-render.
  useSyncExternalStore(edgeStore.subscribe, () => edgeStore.version);

  return (
    <div className="rk">
      <div className="rk-body">
        <HeadPanel />
        <AutonomyBar />
        <AuthorityBar />
        <Rack />
      </div>
      <EventLog />
      <BenchDrawer />
    </div>
  );
}
