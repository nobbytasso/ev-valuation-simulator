import { NavLink } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle.tsx'

export function Header() {
  return (
    <header className="app-header">
      <div className="app-header__brand">VC Valuation Simulator</div>
      <nav className="app-header__nav">
        <NavLink to="/" end>
          シナリオ
        </NavLink>
        <NavLink to="/portfolio">ポートフォリオ</NavLink>
      </nav>
      <ThemeToggle />
    </header>
  )
}
