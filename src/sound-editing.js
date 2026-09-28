// sound-editing.js — saves a scene's sound breakdown (level, flags, notes, warnings) from the
// 🔊 panel: at once on the device as sound/<scene>.json, then uploaded by sync.js.
// Used by: parts/sound-bar.js

import { getState, saveAndShow, showMessage } from './state.js';
import { soundFile } from './store/repo-files.js';
import { syncNow } from './sync.js';

export async function saveSound(sceneId, fields) {
  const { project, connection } = getState();
  const now = new Date().toISOString();
  const sound = {
    ...project.sound?.[sceneId], scene_id: sceneId, ...fields,
    updated_at: now, updated_by: connection?.device || 'this device',
  };
  const outbox = { ...project.outbox, [soundFile(sceneId)]: { saved_at: now } };
  await saveAndShow({ ...project, sound: { ...project.sound, [sceneId]: sound }, outbox });
  showMessage('ok', `Sound of scene ${sceneId} saved.`);
  syncNow();
}
