import { Outlet } from 'react-router-dom'
import { Header } from './Header.tsx'
import './layout.css'

export function Layout() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
