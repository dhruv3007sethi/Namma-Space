import { POI_CATEGORIES, type PoiCategory } from '@namma/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, queryKeys } from '../api/client';
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '../components/ui';
import { humanize } from '../lib/format';

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const category = (params.get('category') ?? '') as PoiCategory | '';
  const q = useDebounced(text.trim());

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (q) next.set('q', q);
    else next.delete('q');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const query = { ...(q && { q }), ...(category && { category }), limit: 50 };
  const results = useQuery({
    queryKey: queryKeys.poiSearch(query),
    queryFn: () => api.searchPois(query),
    enabled: !!q || !!category,
  });

  return (
    <>
      <PageHeader
        title="Search points of interest"
        subtitle="Find doors, exits, furniture and landmarks across every space."
      />
      <div className="search-bar">
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search by name or description"
          aria-label="Search points of interest"
          autoFocus
        />
        <select
          aria-label="Category"
          value={category}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.value) next.set('category', e.target.value);
            else next.delete('category');
            setParams(next, { replace: true });
          }}
        >
          <option value="">All categories</option>
          {POI_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {humanize(c)}
            </option>
          ))}
        </select>
      </div>
      {!q && !category && <p className="muted">Type to search, or pick a category.</p>}
      {results.isFetching && <Spinner label="Searching…" />}
      {results.isError && <ErrorMessage error={results.error} />}
      {results.data?.length === 0 && <EmptyState title="No matching points" />}
      {results.data && results.data.length > 0 && (
        <ul className="card-list">
          {results.data.map((p) => (
            <li key={p.id}>
              <Link to={`/spaces/${p.spaceId}?poi=${p.id}`} className="card card-link">
                <h2>{p.name}</h2>
                <p className="small muted">
                  {humanize(p.category)} · ({p.position.x}, {p.position.y}, {p.position.z})
                  {p.description && ` · ${p.description}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
