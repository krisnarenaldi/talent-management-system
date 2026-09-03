import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full bg-surface text-on-surface overflow-hidden">
      <Sidebar />

      {/* Content area — offset by sidebar width */}
      <div className="flex-1 flex flex-col ml-64 h-full relative">
        {/* Top header bar */}
        <header className="fixed top-0 right-0 w-[calc(100%-16rem)] h-16 bg-surface border-b border-outline-variant flex items-center justify-between px-container-padding z-40">
          <h2 className="text-headline-md text-on-surface font-semibold hidden md:block">
            Candidate Database
          </h2>
          <div className="flex items-center gap-4 ml-auto">
            <button className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined">help</span>
            </button>
            <button className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined">apps</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container text-xs font-semibold border border-outline-variant ml-2 cursor-pointer select-none">
              AD
            </div>
          </div>
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto mt-16 bg-surface-bright">
          {children}
        </main>
      </div>
    </div>
  );
}
