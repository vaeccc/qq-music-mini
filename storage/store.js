const KEYS = Object.freeze({
  CREDENTIAL: "credential",
  PLAYER_STATE: "playerState"
});

export async function getCredential() {
  const { [KEYS.CREDENTIAL]: credential } = await chrome.storage.local.get(KEYS.CREDENTIAL);
  return credential || null;
}

export async function setCredential(credential) {
  await chrome.storage.local.set({ [KEYS.CREDENTIAL]: credential });
}

export async function clearCredential() {
  await chrome.storage.local.remove(KEYS.CREDENTIAL);
}

export async function getPlayerState() {
  const { [KEYS.PLAYER_STATE]: state } = await chrome.storage.local.get(KEYS.PLAYER_STATE);
  return state || null;
}

export async function setPlayerState(state) {
  await chrome.storage.local.set({ [KEYS.PLAYER_STATE]: state });
}
