import { HashRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './theme/ThemeProvider.tsx'
import { ScenarioComparePage } from './ui/compare/ScenarioComparePage.tsx'
import { MoneyUnitProvider } from './ui/format/MoneyUnitProvider.tsx'
import { Layout } from './ui/Layout.tsx'
import { PortfolioPage } from './ui/PortfolioPage.tsx'
import { ScenarioDetailPage } from './ui/ScenarioDetailPage.tsx'
import { ScenarioListPage } from './ui/ScenarioListPage.tsx'

// Stage 1(GitHub Pages)はSPAフォールバック設定なしで運用するため HashRouter を採用。
function App() {
  return (
    <ThemeProvider>
      <MoneyUnitProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<ScenarioListPage />} />
              <Route path="scenarios/:id" element={<ScenarioDetailPage />} />
              <Route path="portfolio" element={<PortfolioPage />} />
              <Route path="compare" element={<ScenarioComparePage />} />
            </Route>
          </Routes>
        </HashRouter>
      </MoneyUnitProvider>
    </ThemeProvider>
  )
}

export default App
