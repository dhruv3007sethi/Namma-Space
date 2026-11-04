import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { api, queryKeys } from '../api/client';

function ApiStatus() {
  const { data, isError } = useQuery({
    queryKey: queryKeys.health,
    queryFn: api.health,
    refetchInterval: 30_000,
    retry: false,
  });
  const state = isError ? 'down' : !data ? 'unknown' : data.status === 'ok' ? 'ok' : 'degraded';
  const label = {
    ok: 'API online',
    degraded: 'API degraded',
    down: 'API unreachable',
    unknown: 'Checking API…',
  }[state];
  return (
    <span className={`api-status api-status-${state}`} title={label}>
      <span className="api-status-dot" aria-hidden />
      <span className="api-status-label">{label}</span>
    </span>
  );
}

export function Layout() {
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>Namma Space</span>
        </NavLink>
        <nav className="topnav" aria-label="Main">
          <NavLink to="/" end>
            Projects
          </NavLink>
          <NavLink to="/search">Search</NavLink>
        </nav>
        <ApiStatus />
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
