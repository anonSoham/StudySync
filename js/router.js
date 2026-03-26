const STATIC_PAGES = ['auth', 'home', 'mygroups', 'create'];
const ALL_PAGES    = [...STATIC_PAGES, 'room'];

export const router = {
  currentPage:   null,
  currentRoomId: null,

  init(onNavigate) {
    this._onNavigate = onNavigate;
    window.addEventListener('hashchange', () => this._resolve());
    this._resolve();
  },

  // navigate('home') or navigate('room', groupId)
  navigate(page, id) {
    window.location.hash = id ? `${page}:${id}` : page;
  },

  _resolve() {
    const hash = window.location.hash.replace('#', '') || 'auth';

    let page, roomId = null;
    if (hash.startsWith('room:')) {
      page   = 'room';
      roomId = hash.slice(5);
    } else {
      page = STATIC_PAGES.includes(hash) ? hash : 'auth';
    }

    this.currentPage   = page;
    this.currentRoomId = roomId;
    this._showPage(page);
    if (this._onNavigate) this._onNavigate(page, roomId);
  },

  _showPage(page) {
    ALL_PAGES.forEach(p => {
      const el = document.getElementById(`page-${p}`);
      if (el) el.style.display = 'none';
    });
    const active = document.getElementById(`page-${page}`);
    if (active) active.style.display = page === 'auth' ? 'flex' : 'block';
  }
};
