import {HashRouter, Navigate, Route, Routes} from 'react-router-dom'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import Layout from './components/Layout'
import SpecsNew from './pages/SpecsNew'
import Tests from './pages/Tests'
import Settings from './pages/Settings'
import {PanelWidthProvider} from './contexts/PanelWidthContext'
import {ErrorBoundary} from './components/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000
    }
  }
})

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PanelWidthProvider>
          <HashRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/specs" replace />} />
                <Route path="specs" element={<SpecsNew />} />
                <Route path="tests" element={<Tests />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </HashRouter>
        </PanelWidthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
