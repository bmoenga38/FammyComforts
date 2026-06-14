/**
 * Curated room/lounge imagery for the guest booking experience.
 *
 * Rooms don't carry photos in the backend yet (the per-room photo gallery is
 * gap-listed), so until an admin uploads real shots we show high-quality
 * hospitality stock images — the SAME curated set the prototype uses
 * (ui-samples/fammycomfort_pwa/js/data.js → D.IMG) so the live app matches it.
 *
 * `roomImage(key)` is deterministic: the same room always gets the same photo
 * (keyed by room type + number), so the catalog and the detail page agree.
 * A CSS gradient remains behind every image as a graceful fallback if the
 * remote photo fails to load (onError hides the <img>, revealing the gradient).
 */

export const ROOM_IMAGES = [
  "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=900&q=70&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&q=70&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=900&q=70&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=70&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&q=70&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=900&q=70&auto=format&fit=crop",
] as const;

/** Wide hero shot for landing/section headers. */
export const HERO_IMAGE =
  "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1400&q=70&auto=format&fit=crop";

export const PHOTO_GRADIENTS = [
  "linear-gradient(135deg,#0d9488 0%,#134e4a 60%,#0b1326 100%)",
  "linear-gradient(135deg,#0ea5e9 0%,#1e3a8a 70%,#0b1326 100%)",
  "linear-gradient(135deg,#eab308 0%,#92400e 65%,#0b1326 100%)",
  "linear-gradient(135deg,#f43f5e 0%,#881337 65%,#0b1326 100%)",
];

function hash(key: string): number {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Deterministic curated photo URL for a room key (type + number). */
export function roomImage(key: string): string {
  return ROOM_IMAGES[hash(key) % ROOM_IMAGES.length];
}

/** Deterministic gradient fallback for the same key. */
export function roomGradient(key: string): string {
  return PHOTO_GRADIENTS[hash(key) % PHOTO_GRADIENTS.length];
}
