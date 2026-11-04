import type { ReactNode } from 'react';
import { ApiError } from '../api/client';

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="spinner" role="status" aria-live="polite">
      <span className="spinner-dot" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorMessage({
  error,
  title = 'Something went wrong',
}: {
  error: unknown;
  title?: string;
}) {
  const message =
    error instanceof ApiError || error instanceof Error ? error.message : 'Unknown error';
  return (
    <div className="callout callout-error" role="alert">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'ok' | 'warn' | 'error';
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {breadcrumb && (
          <nav className="breadcrumb" aria-label="Breadcrumb">
            {breadcrumb}
          </nav>
        )}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
