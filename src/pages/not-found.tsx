import { Link } from 'wouter'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <h1 className="mb-2 text-4xl font-semibold text-brand-500">404</h1>
      <p className="mb-6 text-sm text-text-muted">Halaman ga ketemu nih</p>
      <Link
        href="/"
        className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary shadow-theme-xs transition hover:bg-surface-alt"
      >
        Balik ke Home
      </Link>
    </div>
  )
}
