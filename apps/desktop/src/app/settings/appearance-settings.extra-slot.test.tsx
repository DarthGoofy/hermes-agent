// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { registry } from '@/contrib/registry'
import { ThemeProvider } from '@/themes'
import { getBaseColors, modePref } from '@/themes/context'
import { listAllThemes } from '@/themes/user-themes'

import { APPEARANCE_AREAS } from './appearance-contrib'
import { AppearanceSettings } from './appearance-settings'

const disposers: Array<() => void> = []

afterEach(() => {
  cleanup()
  disposers.splice(0).forEach(dispose => dispose())
})

function renderPage(subpage?: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AppearanceSettings subpage={subpage} />
    </QueryClientProvider>
  )
}

describe('AppearanceSettings extra slot', () => {
  it('mounts plugin extras on the top-level page only, not on deep-link subpages', () => {
    act(() => {
      disposers.push(
        registry.register({
          area: APPEARANCE_AREAS.extra,
          id: 'extra-controls',
          render: () => <span>Extra controls</span>,
          source: 'disk'
        })
      )
    })

    const { unmount } = renderPage('pet')

    expect(screen.queryByText('Extra controls')).toBeNull()
    unmount()

    renderPage()

    expect(screen.getByText('Extra controls')).toBeTruthy()
  })
})

describe('AppearanceSettings theme positions', () => {
  it.each([undefined, 'theme'])('keeps choices in place after selection on subpage %s', subpage => {
    const themes = listAllThemes()

    const { unmount } = render(
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider>
          <AppearanceSettings subpage={subpage} />
        </ThemeProvider>
      </QueryClientProvider>
    )

    const buttonFor = (label: string) => screen.getByText(label).closest('button')!
    const grid = buttonFor(themes[0].label).parentElement!.parentElement!
    const order = () => Array.from(grid.children, card => card.querySelector('button'))
    const originalOrder = order()

    for (const theme of themes.slice(-2).reverse()) {
      fireEvent.click(buttonFor(theme.label))

      expect(window.document.documentElement.dataset.hermesTheme).toBe(theme.name)
      expect(order()).toEqual(originalOrder)
    }

    fireEvent.change(screen.getByPlaceholderText('Search your themes or the VS Code Marketplace…'), {
      target: { value: 'a' }
    })

    const matches = themes.filter(theme =>
      [theme.name, theme.label, theme.description].some(value => value.toLowerCase().includes('a'))
    )

    const filteredOrder = matches.map(theme => buttonFor(theme.label))

    expect(order()).toEqual(filteredOrder)
    fireEvent.click(buttonFor(matches[matches.length - 1].label))
    expect(window.document.documentElement.dataset.hermesTheme).toBe(matches[matches.length - 1].name)
    expect(order()).toEqual(filteredOrder)
    unmount()
    window.localStorage.clear()
  })
})

describe('AppearanceSettings card palettes', () => {
  it.each(['light', 'dark'] as const)('renders every option in its own %s palette across selections', mode => {
    window.localStorage.clear()
    modePref.assign('default', mode)
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider>
          <AppearanceSettings subpage="theme" />
        </ThemeProvider>
      </QueryClientProvider>
    )

    const themes = listAllThemes()
    const buttonFor = (label: string) => screen.getByText(label).closest('button')!

    const checkPalettes = () => {
      for (const theme of themes) {
        const card = buttonFor(theme.label).parentElement!
        const colors = getBaseColors(theme.name, mode)
        const expected = window.document.createElement('div')

        expected.style.backgroundColor = colors.background
        expected.style.color = colors.foreground
        expect(card.style.backgroundColor).toBe(expected.style.backgroundColor)
        expect(card.style.color).toBe(expected.style.color)
        expect(card.style.getPropertyValue('--dt-primary')).toBe(colors.primary)
        expect(card.style.getPropertyValue('--ui-bg-quinary')).toBe(colors.card)
        expect(card.style.getPropertyValue('--ui-text-tertiary')).toBe(colors.mutedForeground)
        expect(card.style.getPropertyValue('--chrome-action-hover')).toBe(colors.accent)
      }
    }

    checkPalettes()
    fireEvent.click(buttonFor(themes[themes.length - 1].label))
    expect(window.document.documentElement.dataset.hermesTheme).toBe(themes[themes.length - 1].name)
    checkPalettes()
    cleanup()
    window.localStorage.clear()
  })
})
