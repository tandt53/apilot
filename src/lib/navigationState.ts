/**
 * Navigation State Management
 * Persists selected spec and endpoint across page navigation
 */

const STORAGE_KEY = 'app-navigation-state';

export interface NavigationState {
  selectedSpecId?: number;
  selectedEndpointId?: number;
}

/**
 * Get navigation state from localStorage
 */
export function getNavigationState(): NavigationState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load navigation state:', error);
  }
  return {};
}

/**
 * Save navigation state to localStorage
 */
export function saveNavigationState(state: NavigationState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save navigation state:', error);
  }
}

/**
 * Update selected spec ID
 */
export function setSelectedSpecId(specId: number | undefined): void {
  const state = getNavigationState();
  state.selectedSpecId = specId;
  // Clear endpoint selection when spec changes
  if (specId !== state.selectedSpecId) {
    state.selectedEndpointId = undefined;
  }
  saveNavigationState(state);
}

/**
 * Update selected endpoint ID
 */
export function setSelectedEndpointId(endpointId: number | undefined): void {
  const state = getNavigationState();
  state.selectedEndpointId = endpointId;
  saveNavigationState(state);
}

/**
 * Clear navigation state
 */
export function clearNavigationState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear navigation state:', error);
  }
}
