export function createChatPanel({ onSubmit }) {
  const root = document.getElementById('chatbot');
  const header = document.getElementById('chatHeader');
  const minButton = document.getElementById('chatMinBtn');
  const input = document.getElementById('chatInput');
  const sendButton = document.getElementById('chatSendBtn');
  const messages = document.getElementById('chatMessages');
  let minimized = true;

  function setMinimized(nextValue) {
    minimized = nextValue;
    root.classList.toggle('minimized', minimized);
    minButton.textContent = minimized ? '+' : '—';
  }

  function toggle() {
    setMinimized(!minimized);
  }

  function addMessage(text, type) {
    const element = document.createElement('div');
    element.className = `chat-msg ${type}`;
    element.textContent = text;
    messages.appendChild(element);
    messages.scrollTop = messages.scrollHeight;
    return element;
  }

  function setSubmitting(submitting) {
    input.disabled = submitting;
    sendButton.disabled = submitting;
  }

  function bindEvents() {
    header.addEventListener('click', () => {
      if (minimized) {
        setMinimized(false);
      }
    });

    minButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggle();
    });

    sendButton.addEventListener('click', async () => {
      const message = input.value.trim();
      if (!message) {
        return;
      }

      input.value = '';
      addMessage(message, 'user');
      await onSubmit(message, {
        addMessage,
        setSubmitting
      });
    });

    input.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      sendButton.click();
    });
  }

  bindEvents();

  return {
    addMessage,
    expand() {
      setMinimized(false);
      input.focus();
    },
    showLoading(text = 'Finding hidden spots…') {
      return addMessage(text, 'loading');
    }
  };
}
