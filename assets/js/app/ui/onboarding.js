export function createOnboarding({ onStart }) {
  const root = document.getElementById('onboard');
  const button = document.getElementById('onboardStartBtn');

  button.addEventListener('click', async () => {
    root.style.opacity = '0';
    root.style.transition = 'opacity .4s';
    await new Promise((resolve) => setTimeout(resolve, 400));
    root.remove();
    await onStart();
  });
}
