import {Link, Outlet, useLocation} from 'react-router-dom'
import {FileCode, Settings, TestTube2} from 'lucide-react'
import {usePanelWidth} from '@/contexts/PanelWidthContext'

export default function Layout() {
    const location = useLocation()
    const {panelWidth} = usePanelWidth()

    const isActive = (path: string) => {
        return location.pathname === path || location.pathname.startsWith(path + '/')
    }

    // Calculate tab bar position: center of panel + page padding (8px)
    const tabBarLeft = `${panelWidth / 2 + 8}px`

    return (
        <div className="flex h-screen bg-white">
            {/* Main Content */}
            <main className="flex-1 overflow-hidden">
                <Outlet/>
            </main>

            {/* Floating Bottom Tab Bar - Dynamically centered on left panel */}
            <nav className="fixed bottom-6 z-40" style={{left: tabBarLeft, transform: 'translateX(-50%)'}}>
                <div className="glass-panel flex items-center gap-1 px-2.5 py-2 rounded-full shadow-2xl">
                    <Link
                        to="/specs"
                        className={`flex flex-col items-center gap-0.5 px-4.5 py-2 rounded-full transition-all ${
                            isActive('/specs')
                                ? 'bg-white/40 text-purple-700 shadow-lg'
                                : 'text-gray-600 hover:bg-white/20'
                        }`}
                    >
                        <FileCode size={18} className="flex-shrink-0"/>
                        <span className="text-[10px] font-medium">API Specs</span>
                    </Link>
                    <Link
                        to="/tests"
                        className={`flex flex-col items-center gap-0.5 px-4.5 py-2 rounded-full transition-all ${
                            isActive('/tests')
                                ? 'bg-white/40 text-purple-700 shadow-lg'
                                : 'text-gray-600 hover:bg-white/20'
                        }`}
                    >
                        <TestTube2 size={18} className="flex-shrink-0"/>
                        <span className="text-[10px] font-medium">Tests</span>
                    </Link>
                    <Link
                        to="/settings"
                        className={`flex flex-col items-center gap-0.5 px-4.5 py-2 rounded-full transition-all ${
                            isActive('/settings')
                                ? 'bg-white/40 text-purple-700 shadow-lg'
                                : 'text-gray-600 hover:bg-white/20'
                        }`}
                    >
                        <Settings size={18} className="flex-shrink-0"/>
                        <span className="text-[10px] font-medium">Settings</span>
                    </Link>
                </div>
            </nav>
        </div>
    )
}
