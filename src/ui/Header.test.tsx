// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ThemeProvider } from '../theme/ThemeProvider.tsx'
import { Header } from './Header.tsx'

describe('Header', () => {
  it('data_status: dummy のベンチマークデータが存在する間、常設バッジを表示する(D-5/A-2)', async () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      </ThemeProvider>,
    )
    expect(await screen.findByRole('status')).toHaveTextContent('ダミーデータ')
  })
})
