import { Link } from 'wouter'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <h1 className="mb-2 text-4xl font-black text-primary">404</h1>
      <p className="mb-6 text-sm text-text-muted">Halaman ga ketemu nih</p>
      <Link
        href="/"
        className="rounded-lg border-2 border-border bg-surface px-4 py-2 text-sm font-bold text-text-primary shadow-nb-sm transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-nb-md"
      >
        Balik ke Home
      </Link>
    </div>
  )
}
