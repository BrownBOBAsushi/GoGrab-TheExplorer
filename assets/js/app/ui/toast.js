export function createToast() {
  function show(message, x = window.innerWidth / 2, y = window.innerHeight - 120) {
    const element = document.createElement('div');
    element.className = 'toast';
    element.textContent = message;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    document.body.appendChild(element);
    setTimeout(() => element.remove(), 2000);
  }

  return {
    show
  };
}
