import { Store } from '@tanstack/store'

interface UIStoreState {
  isEpisodeFullscreen: boolean
}

let uiStore: Store<UIStoreState> | null = null

function createStore(): Store<UIStoreState> {
  return new Store<UIStoreState>({
    isEpisodeFullscreen: false,
  })
}

export function initUIStore(): Store<UIStoreState> {
  if (!uiStore) {
    uiStore = createStore()
  }
  return uiStore
}

export function getUIStore(): Store<UIStoreState> {
  return initUIStore()
}

export function setEpisodeFullscreen(isFullscreen: boolean): void {
  const store = getUIStore()
  store.setState(state => ({
    ...state,
    isEpisodeFullscreen: isFullscreen,
  }))
}

export function toggleEpisodeFullscreen(): void {
  const store = getUIStore()
  store.setState(state => ({
    ...state,
    isEpisodeFullscreen: !state.isEpisodeFullscreen,
  }))
}
