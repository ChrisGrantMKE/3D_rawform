import { App } from './App';

window.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('app');
  if (!container) {
    console.error('Failed to locate #app container element.');
    return;
  }

  try {
    const app = new App(container);
    await app.init();
    console.log('3D_rawform initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize 3D_rawform:', error);
    const errorOverlay = document.createElement('div');
    errorOverlay.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(22, 27, 34, 0.95);
      border: 1px solid #f85149;
      padding: 24px;
      border-radius: 12px;
      color: #f0f6fc;
      font-family: sans-serif;
      text-align: center;
      max-width: 400px;
    `;
    errorOverlay.innerHTML = `
      <h3 style="color: #f85149; margin-bottom: 8px;">Initialization Notice</h3>
      <p style="font-size: 13px; color: #8b949e; line-height: 1.5;">
        ${error instanceof Error ? error.message : 'WebGPU or WebGL2 graphics context could not be acquired.'}
      </p>
    `;
    container.appendChild(errorOverlay);
  }
});
