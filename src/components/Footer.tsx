export default function Footer() {
  return (
    <footer className="border-t border-[var(--neu-border)] mt-20 animate-fade-up">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-[var(--neu-text-muted)] transition-colors duration-300 hover:text-[var(--neu-text-secondary)]">
          &copy; {new Date().getFullYear()} justin.human
        </p>
        <p className="text-sm text-[var(--neu-text-muted)] transition-colors duration-300 hover:text-[var(--neu-text-secondary)]">
          Powered by Neelash Intelligence
        </p>
      </div>
    </footer>
  );
}
