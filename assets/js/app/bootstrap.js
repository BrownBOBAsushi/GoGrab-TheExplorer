import { startTouristFlow } from './flows/tourist-flow.js';

window.addEventListener('DOMContentLoaded', async () => {
  await startTouristFlow();
});
