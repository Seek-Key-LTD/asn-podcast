import type { Episode } from '@/types/podcast'
import { Store } from '@tanstack/store'

export interface PlayerStoreState {
  currentEpisode: Episode | null
  isPlaying: boolean
  isSourceChanging: boolean
  selectionSource: 'default' | 'user' | null
}

let playerStore: Store<PlayerStoreState> | null = null

function createPlayerStore(): Store<PlayerStoreState> {
  return new Store<PlayerStoreState>({
    currentEpisode: null,
    isPlaying: false,
    isSourceChanging: false,
    selectionSource: null,
  })
}

export function initPlayerStore(): Store<PlayerStoreState> {
  if (!playerStore) {
    playerStore = createPlayerStore()
  }
  return playerStore
}

export function getPlayerStore(): Store<PlayerStoreState> {
  if (!playerStore) {
    throw new Error('Player store has not been initialized')
  }
  return playerStore
}

export function setCurrentEpisode(episode: Episode): void {
  const store = getPlayerStore()
  store.setState(state => ({
    currentEpisode: episode,
    isPlaying: true,
    isSourceChanging: state.currentEpisode?.id !== episode.id,
    selectionSource: 'user',
  }))
}

export function setDefaultEpisode(episode: Episode): void {
  const store = getPlayerStore()
  store.setState((state) => {
    const canSetDefault = !state.currentEpisode
    if (!canSetDefault) {
      return state
    }

    return {
      ...state,
      currentEpisode: episode,
      isPlaying: false,
      isSourceChanging: false,
      selectionSource: 'default',
    }
  })
}

export function clearPlayerEpisode(): void {
  const store = getPlayerStore()
  store.setState(() => ({
    currentEpisode: null,
    isPlaying: false,
    isSourceChanging: false,
    selectionSource: null,
  }))
}

export function setIsPlaying(isPlaying: boolean): void {
  const store = getPlayerStore()
  store.setState(state => ({
    ...state,
    isPlaying,
    selectionSource: isPlaying ? 'user' : state.selectionSource,
  }))
}

export function setIsSourceChanging(isSourceChanging: boolean): void {
  const store = getPlayerStore()
  store.setState(state => ({ ...state, isSourceChanging }))
}

export function play(): void {
  const store = getPlayerStore()
  store.setState(state => ({ ...state, isPlaying: true, selectionSource: 'user' }))
}

export function pause(): void {
  const store = getPlayerStore()
  store.setState(state => ({ ...state, isPlaying: false, isSourceChanging: false }))
}
