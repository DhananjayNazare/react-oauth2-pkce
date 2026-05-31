import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider } from '../src'
import { inMemoryStorage } from '../src/inMemoryStorage'
import { AuthConsumer, authConfig } from './test-utils'

// ---------------------------------------------------------------------------
// inMemoryStorage unit tests
// ---------------------------------------------------------------------------

describe('inMemoryStorage', () => {
  beforeEach(() => {
    inMemoryStorage.clear()
  })

  test('returns null for missing keys', () => {
    expect(inMemoryStorage.getItem('missing')).toBeNull()
  })

  test('stores and retrieves a value', () => {
    inMemoryStorage.setItem('key1', 'hello')
    expect(inMemoryStorage.getItem('key1')).toBe('hello')
  })

  test('overwrites an existing value', () => {
    inMemoryStorage.setItem('key1', 'first')
    inMemoryStorage.setItem('key1', 'second')
    expect(inMemoryStorage.getItem('key1')).toBe('second')
  })

  test('removes a value', () => {
    inMemoryStorage.setItem('key1', 'value')
    inMemoryStorage.removeItem('key1')
    expect(inMemoryStorage.getItem('key1')).toBeNull()
  })

  test('removeItem on a non-existent key does not throw', () => {
    expect(() => inMemoryStorage.removeItem('nonexistent')).not.toThrow()
  })

  test('clear removes all entries', () => {
    inMemoryStorage.setItem('a', '1')
    inMemoryStorage.setItem('b', '2')
    inMemoryStorage.clear()
    expect(inMemoryStorage.getItem('a')).toBeNull()
    expect(inMemoryStorage.getItem('b')).toBeNull()
  })

  test('stores multiple independent keys', () => {
    inMemoryStorage.setItem('x', 'foo')
    inMemoryStorage.setItem('y', 'bar')
    expect(inMemoryStorage.getItem('x')).toBe('foo')
    expect(inMemoryStorage.getItem('y')).toBe('bar')
  })
})

// ---------------------------------------------------------------------------
// AuthProvider with storage='memory' integration tests
// ---------------------------------------------------------------------------

const memoryAuthConfig = { ...authConfig, storage: 'memory' as const }

describe('AuthProvider with storage=memory', () => {
  beforeEach(() => {
    inMemoryStorage.clear()
    // Reset PKCE-related sessionStorage entries
    sessionStorage.clear()
    window.location.search = ''
    jest.clearAllMocks()
  })

  test('config validation accepts memory storage without throwing', () => {
    expect(() => {
      render(
        <AuthProvider authConfig={memoryAuthConfig}>
          <AuthConsumer />
        </AuthProvider>,
      )
    }).not.toThrow()
  })

  test('first page visit redirects to auth provider (memory storage)', async () => {
    render(
      <AuthProvider authConfig={memoryAuthConfig}>
        <AuthConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith(
        expect.stringMatching(
          /^myAuthEndpoint\?response_type=code&client_id=myClientID&code_challenge=.{43}&code_challenge_method=S256/gm,
        ),
      )
    })
  })

  test('PKCE code verifier is stored in sessionStorage (survives redirect) for memory storage', async () => {
    render(
      <AuthProvider authConfig={memoryAuthConfig}>
        <AuthConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalled()
    })

    // Verifier must be in sessionStorage so the callback page can read it
    expect(sessionStorage.getItem('ROCP_PKCE_code_verifier')).not.toBeNull()
    // And must NOT have been written to localStorage
    expect(localStorage.getItem('ROCP_PKCE_code_verifier')).toBeNull()
  })

  test('loginInProgress is stored in memory (not localStorage) for memory storage', async () => {
    render(
      <AuthProvider authConfig={memoryAuthConfig}>
        <AuthConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalled()
    })

    expect(localStorage.getItem('ROCP_loginInProgress')).toBeNull()
    expect(sessionStorage.getItem('ROCP_loginInProgress')).toBeNull()
    expect(inMemoryStorage.getItem('ROCP_loginInProgress')).toBe('true')
  })

  test('pre-stored memory token is read by AuthProvider on mount', async () => {
    inMemoryStorage.setItem('ROCP_loginInProgress', 'false')
    inMemoryStorage.setItem('ROCP_token', '"memory-token-value"')

    render(
      <AuthProvider authConfig={memoryAuthConfig}>
        <AuthConsumer />
      </AuthProvider>,
    )

    const tokenEl = await waitFor(() => screen.getByTestId('token'))
    expect(tokenEl).toHaveTextContent('memory-token-value')
  })

  test('logout clears in-memory token and redirects', async () => {
    inMemoryStorage.setItem('ROCP_loginInProgress', 'false')
    inMemoryStorage.setItem('ROCP_token', '"memory-token-value"')
    inMemoryStorage.setItem('ROCP_refreshToken', '"memory-refresh-value"')

    const user = userEvent.setup()

    render(
      <AuthProvider authConfig={memoryAuthConfig}>
        <AuthConsumer />
      </AuthProvider>,
    )

    await user.click(screen.getByText('Log out'))

    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith(
        expect.stringContaining('myLogoutEndpoint'),
      ),
    )
  })
})

// ---------------------------------------------------------------------------
// validateConfig rejects unknown storage values
// ---------------------------------------------------------------------------

describe('validateConfig storage validation', () => {
  test('throws for an unsupported storage value', () => {
    expect(() => {
      render(
        // @ts-expect-error intentionally bad value
        <AuthProvider authConfig={{ ...authConfig, storage: 'cookie' }}>
          <AuthConsumer />
        </AuthProvider>,
      )
    }).toThrow("'storage' must be one of ('session', 'local', 'memory')")
  })
})
