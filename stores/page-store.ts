import { Store } from '@tanstack/store'

export interface PageStoreState {
  currentPage: number
  isNavigating: boolean
  pendingPage: number | null
}

let pageStore: Store<PageStoreState> | null = null

function createStore(): Store<PageStoreState> {
  return new Store<PageStoreState>({
    currentPage: 1,
    isNavigating: false,
    pendingPage: null,
  })
}

export function initPageStore(): Store<PageStoreState> {
  if (!pageStore) {
    pageStore = createStore()
  }
  return pageStore
}

export function getPageStore(): Store<PageStoreState> {
  if (!pageStore) {
    throw new Error('Page store has not been initialized')
  }
  return pageStore
}

export function startPageNavigation(page: number): void {
  const store = getPageStore()
  store.setState(state => ({
    ...state,
    isNavigating: true,
    pendingPage: page,
  }))
}

export function completePageNavigation(currentPage: number): void {
  const store = getPageStore()
  store.setState(state => ({
    ...state,
    currentPage,
    isNavigating: false,
    pendingPage: null,
  }))
}
