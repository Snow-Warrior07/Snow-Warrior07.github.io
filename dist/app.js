(() => {
  const root = document.documentElement;
  const button = document.querySelector('.theme-toggle');
  let stored;
  try { stored = localStorage.getItem('portfolio-theme'); } catch {}
  let theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const setTheme = value => {
    theme = value;
    root.dataset.theme = value;
    button.setAttribute('aria-pressed', String(value === 'dark'));
    button.setAttribute('aria-label', `Switch to ${value === 'dark' ? 'light' : 'dark'} theme`);
    button.querySelector('.theme-label').textContent = value === 'dark' ? 'Light' : 'Dark';
    document.querySelector('meta[name="theme-color"]').content = value === 'dark' ? '#111315' : '#ffffff';
  };
  setTheme(theme);
  button.addEventListener('click', () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
    try { localStorage.setItem('portfolio-theme', theme); } catch {}
  });

  const cards = [...document.querySelectorAll('[data-category]')];
  const filters = [...document.querySelectorAll('[data-filter]')];
  filters.forEach(filter => filter.addEventListener('click', () => {
    const category = filter.dataset.filter;
    let count = 0;
    cards.forEach(card => {
      card.hidden = category !== 'all' && card.dataset.category !== category;
      if (!card.hidden) count++;
    });
    filters.forEach(item => item.setAttribute('aria-pressed', String(item === filter)));
    document.getElementById('project-count').textContent = `${String(count).padStart(2, '0')} PROJECT${count === 1 ? '' : 'S'}`;
  }));
  document.querySelectorAll('[data-dialog]').forEach(trigger => trigger.addEventListener('click', () => {
    const dialog = document.getElementById(trigger.dataset.dialog);
    dialog.showModal();
    document.body.classList.add('dialog-open');
  }));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
    dialog.addEventListener('click', event => {
      const box = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
    });
  });
})();
