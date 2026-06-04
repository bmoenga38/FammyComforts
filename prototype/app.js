const icons = {
  bed: '<svg viewBox="0 0 24 24"><path d="M3 7v12"/><path d="M21 12v7"/><path d="M3 12h18"/><path d="M7 12V7h8a3 3 0 0 1 3 3v2"/><path d="M3 19h18"/></svg>',
  dashboard: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>',
  "calendar-plus": '<svg viewBox="0 0 24 24"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M12 14v4"/><path d="M10 16h4"/></svg>',
  wrench: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-3-3 2.4-2.4z"/></svg>',
  brush: '<svg viewBox="0 0 24 24"><path d="M9 11l6-6a2 2 0 0 1 3 3l-6 6"/><path d="M5 19c2 0 4-1 4-4l4 4c-3 0-4 2-8 2z"/></svg>',
  chef: '<svg viewBox="0 0 24 24"><path d="M6 13.9V21h12v-7.1"/><path d="M6 17h12"/><path d="M6.3 14a4 4 0 1 1 2.9-6.8A4 4 0 0 1 16 6a4 4 0 1 1 1.7 8"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  smartphone: '<svg viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-5"/></svg>',
  credit: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  warning: '<svg viewBox="0 0 24 24"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
};

document.querySelectorAll("[data-icon]").forEach((node) => {
  node.innerHTML = icons[node.dataset.icon] || "";
});

const root = document.documentElement;
const savedTheme = localStorage.getItem("sommycomfort-theme");
if (savedTheme) root.dataset.theme = savedTheme;

const titleByView = {
  guest: "Guest Booking",
  admin: "Admin Dashboard",
  frontdesk: "Front Desk Calendar",
  operations: "Operations Manager",
  housekeeping: "Housekeeping Tasks",
  kitchen: "Kitchen Display"
};

const toast = document.getElementById("toast");
let toastTimer;

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

document.getElementById("themeToggle").addEventListener("click", () => {
  const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = nextTheme;
  localStorage.setItem("sommycomfort-theme", nextTheme);
  showToast(`${nextTheme === "dark" ? "Dark" : "Light"} mode enabled`);
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(view).classList.add("active");
    document.getElementById("pageTitle").textContent = titleByView[view];
    document.body.classList.remove("menu-open");
  });
});

document.getElementById("mobileMenu").addEventListener("click", () => {
  document.body.classList.toggle("menu-open");
});

document.querySelectorAll(".payment-option").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".payment-option").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });
});

document.querySelectorAll("[data-scroll-target]").forEach((button) => {
  button.addEventListener("click", () => {
    document.getElementById(button.dataset.scrollTarget).scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

document.getElementById("confirmBooking").addEventListener("click", () => {
  showToast("Booking draft confirmed. Reference BK-DEMO-001 generated.");
});

document.querySelectorAll(".complete-task").forEach((button) => {
  button.addEventListener("click", () => {
    const card = button.closest(".task-card");
    card.querySelector(".status").className = "status success";
    card.querySelector(".status").textContent = "Completed";
    button.textContent = "Completed";
    button.disabled = true;
    showToast("Housekeeping task completed and queued for sync.");
  });
});
