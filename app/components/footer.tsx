import Link from "next/link";
import { Clock, Github, Info, Terminal } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full py-6 mt-8" style={{
      background: 'var(--panel-bg)',
      borderTop: '2px solid var(--panel-highlight)',
      boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.2)',
    }}>
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* System Status Panel */}
          <div className="command-panel">
            <div className="command-panel-header">SYSTEM STATUS</div>
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="led led-green"></div>
                <span className="text-xs">Core Systems</span>
              </div>
              <div className="flex items-center">
                <div className="led led-blue"></div>
                <span className="text-xs">Data Storage</span>
              </div>
              <div className="flex items-center">
                <div className="led led-yellow"></div>
                <span className="text-xs">External Connections</span>
              </div>
              <div className="data-readout mt-3 text-center py-2">
                <div className="blinking-cursor">TORODORO v1.0.0</div>
              </div>
            </div>
          </div>

          {/* Navigation Panel */}
          <div className="command-panel">
            <div className="command-panel-header">NAVIGATION</div>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/" className="command-button text-center">
                Home
              </Link>
              <Link href="/workplans" className="command-button text-center">
                Work Plans
              </Link>
              <Link href="/sessions" className="command-button text-center">
                Sessions
              </Link>
              <Link href="/about" className="command-button text-center">
                About
              </Link>
            </div>
          </div>

          {/* Information Panel */}
          <div className="command-panel">
            <div className="command-panel-header">INFORMATION</div>
            <div className="space-y-4">
              <p className="text-xs text-panel-fg">
                Torodoro Command Center provides mission-critical task and time management
                capabilities for maximum productivity.
              </p>
              <div className="flex justify-center space-x-4">
                <a href="https://github.com/yourusername/torodoro" 
                   className="command-button" 
                   target="_blank" 
                   rel="noopener noreferrer">
                  <Github className="h-4 w-4" />
                </a>
                <a href="/api/docs" 
                   className="command-button" 
                   target="_blank" 
                   rel="noopener noreferrer">
                  <Terminal className="h-4 w-4" />
                </a>
                <a href="/about" 
                   className="command-button">
                  <Info className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 text-center text-xs" style={{
          borderTop: '1px solid var(--panel-light)',
          fontFamily: 'var(--font-text-me-one)',
          letterSpacing: '1px',
        }}>
          <p className="text-panel-fg opacity-70">
            © {new Date().getFullYear()} TORODORO COMMAND CENTER • ALL SYSTEMS OPERATIONAL
          </p>
        </div>
      </div>
    </footer>
  );
} 