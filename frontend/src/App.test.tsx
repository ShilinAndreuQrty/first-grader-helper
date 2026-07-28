import { render, screen } from '@testing-library/react'

import { App } from './App'

describe('App', () => {
  it('renders the community disclaimer', () => {
    render(<App />)

    expect(
      screen.getByText('Проект тьюторского сообщества ИПМКН ТулГУ'),
    ).toBeInTheDocument()
  })
})
