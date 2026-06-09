/* ============================================================
   Fammy Comforts — Mock Data Layer
   Frontend-only. Realistic Kenyan hospitality data.
   Currency: KES. Sender ID: FAMMY.
   ============================================================ */
(function () {
  'use strict';

  const IMG = {
    lounge1: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=900&q=70&auto=format&fit=crop',
    lounge2: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&q=70&auto=format&fit=crop',
    lounge3: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=900&q=70&auto=format&fit=crop',
    lounge4: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=70&auto=format&fit=crop',
    lounge5: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&q=70&auto=format&fit=crop',
    lounge6: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=900&q=70&auto=format&fit=crop',
    hero: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1400&q=70&auto=format&fit=crop'
  };

  /* ---------------- Lounges / Rooms ---------------- */
  const ROOMS = [
    { id: 'SC-101', name: 'Savannah Executive Suite', type: 'Executive', capacity: 2, price: 8500, status: 'available', floor: 1, amenities: ['Wi-Fi', 'AC', 'Mini Bar', 'Smart TV'], rating: 4.9, reviews: 218, image: IMG.lounge1, vip: true },
    { id: 'SC-102', name: 'Tsavo Twin Lounge', type: 'Standard', capacity: 2, price: 4200, status: 'occupied', floor: 1, amenities: ['Wi-Fi', 'AC'], rating: 4.6, reviews: 142, image: IMG.lounge2, vip: false },
    { id: 'SC-103', name: 'Amboseli Garden Room', type: 'Deluxe', capacity: 3, price: 6300, status: 'cleaning', floor: 1, amenities: ['Wi-Fi', 'AC', 'Balcony'], rating: 4.8, reviews: 96, image: IMG.lounge3, vip: false },
    { id: 'SC-201', name: 'Maasai Mara Penthouse', type: 'Penthouse', capacity: 4, price: 14500, status: 'available', floor: 2, amenities: ['Wi-Fi', 'AC', 'Jacuzzi', 'Lounge', 'Smart TV'], rating: 5.0, reviews: 64, image: IMG.lounge4, vip: true },
    { id: 'SC-202', name: 'Nakuru Comfort Room', type: 'Standard', capacity: 2, price: 3800, status: 'maintenance', floor: 2, amenities: ['Wi-Fi'], rating: 4.3, reviews: 188, image: IMG.lounge5, vip: false },
    { id: 'SC-203', name: 'Diani Deluxe Lounge', type: 'Deluxe', capacity: 3, price: 6900, status: 'occupied', floor: 2, amenities: ['Wi-Fi', 'AC', 'Sea View'], rating: 4.7, reviews: 121, image: IMG.lounge6, vip: false },
    { id: 'SC-301', name: 'Kilimanjaro Royal Suite', type: 'Executive', capacity: 2, price: 9200, status: 'available', floor: 3, amenities: ['Wi-Fi', 'AC', 'Mini Bar', 'Workspace'], rating: 4.9, reviews: 77, image: IMG.lounge1, vip: true },
    { id: 'SC-302', name: 'Lamu Heritage Room', type: 'Standard', capacity: 2, price: 4000, status: 'reserved', floor: 3, amenities: ['Wi-Fi', 'AC'], rating: 4.5, reviews: 109, image: IMG.lounge2, vip: false },
    { id: 'SC-104', name: 'Naivasha Garden Suite', type: 'Deluxe', capacity: 3, price: 6100, status: 'available', floor: 1, amenities: ['Wi-Fi', 'AC', 'Balcony', 'Smart TV'], rating: 4.7, reviews: 58, image: IMG.lounge3, vip: false },
    { id: 'SC-204', name: 'Turkana Skyline Room', type: 'Standard', capacity: 2, price: 4400, status: 'available', floor: 2, amenities: ['Wi-Fi', 'AC', 'City View'], rating: 4.4, reviews: 73, image: IMG.lounge5, vip: false },
    { id: 'SC-303', name: 'Watamu Beach Suite', type: 'Executive', capacity: 2, price: 9800, status: 'available', floor: 3, amenities: ['Wi-Fi', 'AC', 'Mini Bar', 'Sea View', 'Workspace'], rating: 4.9, reviews: 41, image: IMG.lounge6, vip: true }
  ];

  /* ---------------- Guests / Customers ---------------- */
  const GUESTS = [
    { id: 'G-1001', name: 'Wanjiru Kamau', phone: '+254 712 345 678', email: 'wanjiru.k@gmail.com', tier: 'Platinum', points: 4820, stays: 23, vip: true, avatar: 'WK' },
    { id: 'G-1002', name: 'Brian Otieno', phone: '+254 723 998 100', email: 'b.otieno@yahoo.com', tier: 'Gold', points: 2150, stays: 11, vip: false, avatar: 'BO' },
    { id: 'G-1003', name: 'Aisha Hassan', phone: '+254 701 442 887', email: 'aisha.h@outlook.com', tier: 'Silver', points: 880, stays: 5, vip: false, avatar: 'AH' },
    { id: 'G-1004', name: 'David Mwangi', phone: '+254 733 220 551', email: 'davidm@gmail.com', tier: 'Gold', points: 1990, stays: 9, vip: false, avatar: 'DM' },
    { id: 'G-1005', name: 'Faith Chebet', phone: '+254 720 776 433', email: 'faith.chebet@gmail.com', tier: 'Platinum', points: 5340, stays: 31, vip: true, avatar: 'FC' },
    { id: 'G-1006', name: 'Samuel Njoroge', phone: '+254 711 009 234', email: 's.njoroge@gmail.com', tier: 'Bronze', points: 320, stays: 2, vip: false, avatar: 'SN' }
  ];

  /* ---------------- Reservations / Bookings ---------------- */
  const BOOKINGS = [
    { code: 'BK-7841', guest: 'G-1001', room: 'SC-101', status: 'confirmed', checkIn: '2026-06-08', checkOut: '2026-06-10', nights: 2, guests: 2, amount: 17000, paid: true, channel: 'App', eta: '14:00' },
    { code: 'BK-7842', guest: 'G-1002', room: 'SC-102', status: 'checked-in', checkIn: '2026-06-07', checkOut: '2026-06-09', nights: 2, guests: 2, amount: 8400, paid: true, channel: 'Walk-in', eta: '—' },
    { code: 'BK-7843', guest: 'G-1003', room: 'SC-302', status: 'pending', checkIn: '2026-06-08', checkOut: '2026-06-11', nights: 3, guests: 1, amount: 12000, paid: false, channel: 'App', eta: '16:30' },
    { code: 'BK-7844', guest: 'G-1005', room: 'SC-201', status: 'confirmed', checkIn: '2026-06-08', checkOut: '2026-06-12', nights: 4, guests: 4, amount: 58000, paid: true, channel: 'App', eta: '12:00' },
    { code: 'BK-7845', guest: 'G-1004', room: 'SC-203', status: 'checked-in', checkIn: '2026-06-06', checkOut: '2026-06-08', nights: 2, guests: 3, amount: 13800, paid: true, channel: 'Booking.com', eta: '—' },
    { code: 'BK-7846', guest: 'G-1006', room: 'SC-103', status: 'checkout-due', checkIn: '2026-06-05', checkOut: '2026-06-08', nights: 3, guests: 2, amount: 18900, paid: true, channel: 'App', eta: '11:00' },
    { code: 'BK-7847', guest: 'G-1003', room: 'SC-301', status: 'cancelled', checkIn: '2026-06-09', checkOut: '2026-06-10', nights: 1, guests: 2, amount: 9200, paid: false, channel: 'App', eta: '—' }
  ];

  /* ---------------- Staff ---------------- */
  const STAFF = [
    { id: 'ST-01', name: 'Grace Achieng', role: 'Receptionist', shift: 'Morning', status: 'active', tasks: 8, rating: 4.8, avatar: 'GA' },
    { id: 'ST-02', name: 'Peter Kariuki', role: 'Lounge Assistant', shift: 'Morning', status: 'active', tasks: 12, rating: 4.6, avatar: 'PK' },
    { id: 'ST-03', name: 'Mary Wambui', role: 'Caretaker', shift: 'Evening', status: 'break', tasks: 6, rating: 4.9, avatar: 'MW' },
    { id: 'ST-04', name: 'John Kiprop', role: 'Operations Manager', shift: 'Full Day', status: 'active', tasks: 4, rating: 4.7, avatar: 'JK' },
    { id: 'ST-05', name: 'Lucy Adhiambo', role: 'Lounge Assistant', shift: 'Evening', status: 'offline', tasks: 0, rating: 4.5, avatar: 'LA' }
  ];

  /* ---------------- Housekeeping / Tasks ---------------- */
  const TASKS = [
    { id: 'TK-01', room: 'SC-103', type: 'Cleaning', priority: 'high', status: 'in-progress', assignee: 'ST-02', due: '11:30', note: 'Deep clean after checkout' },
    { id: 'TK-02', room: 'SC-202', type: 'Maintenance', priority: 'urgent', status: 'pending', assignee: 'ST-03', due: '13:00', note: 'AC not cooling — technician needed' },
    { id: 'TK-03', room: 'SC-201', type: 'Room Prep', priority: 'high', status: 'pending', assignee: 'ST-02', due: '11:45', note: 'VIP arrival — welcome amenities' },
    { id: 'TK-04', room: 'SC-302', type: 'Inspection', priority: 'medium', status: 'pending', assignee: 'ST-05', due: '15:00', note: 'Pre-arrival inspection' },
    { id: 'TK-05', room: 'SC-101', type: 'Cleaning', priority: 'low', status: 'done', assignee: 'ST-02', due: '09:00', note: 'Standard turnover' },
    { id: 'TK-06', room: 'SC-203', type: 'Incident', priority: 'urgent', status: 'in-progress', assignee: 'ST-03', due: '12:15', note: 'Reported leaking tap in bathroom' }
  ];

  /* ---------------- Notifications / Templates ---------------- */
  const NOTIFICATIONS = [
    { id: 'N-1', channel: 'SMS', title: 'Booking Confirmed', to: 'Wanjiru Kamau', time: '2 min ago', read: false, body: 'FAMMY: Hi Wanjiru, your booking BK-7841 for Savannah Executive Suite is CONFIRMED. Check-in 8 Jun, 2PM. Total KES 17,000. Karibu!' },
    { id: 'N-2', channel: 'Push', title: 'Check-In Reminder', to: 'Faith Chebet', time: '1 hr ago', read: false, body: 'Your stay at Maasai Mara Penthouse starts today. Tap to view your QR check-in code.' },
    { id: 'N-3', channel: 'SMS', title: 'Reservation Expiring', to: 'Aisha Hassan', time: '3 hr ago', read: true, body: 'FAMMY: Aisha, complete payment for BK-7843 within 2 hrs to secure your room. Reply or pay via app.' },
    { id: 'N-4', channel: 'Email', title: 'Thank You', to: 'David Mwangi', time: 'Yesterday', read: true, body: 'Thank you for staying with Fammy Comforts. We hope Diani Deluxe Lounge felt like home. Rate your stay for 100 bonus points.' },
    { id: 'N-5', channel: 'SMS', title: 'Feedback Request', to: 'Samuel Njoroge', time: 'Yesterday', read: true, body: 'FAMMY: How was your stay? Reply 1-5 to rate. Your feedback shapes a better Fammy Comforts.' }
  ];

  const TEMPLATES = [
    { id: 'T-1', name: 'Booking Confirmed', channel: 'SMS', trigger: 'On payment success', body: 'FAMMY: Hi {name}, booking {code} for {room} is CONFIRMED. Check-in {date}. Total {amount}. Karibu!', active: true },
    { id: 'T-2', name: 'Check-In Reminder', channel: 'Push', trigger: '3 hrs before arrival', body: 'Hi {name}, your stay at {room} starts soon. Tap for your QR check-in code.', active: true },
    { id: 'T-3', name: 'Reservation Expiring', channel: 'SMS', trigger: 'Unpaid + 2 hrs', body: 'FAMMY: {name}, complete payment for {code} within 2 hrs to secure your room.', active: true },
    { id: 'T-4', name: 'Thank You', channel: 'Email', trigger: 'On checkout', body: 'Thank you for staying with Fammy Comforts, {name}. Rate your stay for 100 bonus points.', active: true },
    { id: 'T-5', name: 'Feedback Request', channel: 'SMS', trigger: '1 day after checkout', body: 'FAMMY: How was your stay, {name}? Reply 1-5 to rate.', active: false }
  ];

  /* ---------------- Audit log ---------------- */
  const AUDIT = [
    { time: '10:42', user: 'Grace Achieng', action: 'Checked in BK-7842 (Brian Otieno)', type: 'checkin' },
    { time: '10:15', user: 'John Kiprop', action: 'Overrode rate on SC-201 (-10% VIP)', type: 'override' },
    { time: '09:50', user: 'System', action: 'Sent SMS "Booking Confirmed" to G-1001', type: 'sms' },
    { time: '09:30', user: 'Peter Kariuki', action: 'Completed cleaning task TK-05 (SC-101)', type: 'task' },
    { time: '08:58', user: 'Admin', action: 'Updated template "Feedback Request" (disabled)', type: 'config' }
  ];

  /* ---------------- Analytics ---------------- */
  const ANALYTICS = {
    kpis: {
      occupancy: 78,
      revenueToday: 184500,
      arrivals: 6,
      departures: 4,
      pendingTasks: 5,
      satisfaction: 4.7
    },
    revenue7d: [128000, 142500, 98000, 176000, 210000, 188000, 184500],
    occupancy7d: [62, 70, 55, 81, 88, 84, 78],
    revenueLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    peakHours: [
      { h: '08:00', v: 20 }, { h: '10:00', v: 35 }, { h: '12:00', v: 55 },
      { h: '14:00', v: 92 }, { h: '16:00', v: 78 }, { h: '18:00', v: 64 }, { h: '20:00', v: 40 }
    ],
    roomMix: [
      { label: 'Standard', value: 38, color: '#38bdf8' },
      { label: 'Deluxe', value: 27, color: '#14b8a6' },
      { label: 'Executive', value: 22, color: '#eab308' },
      { label: 'Penthouse', value: 13, color: '#f43f5e' }
    ],
    retention: [44, 52, 49, 58, 63, 67, 71, 69, 74, 78, 81, 84],
    staffPerf: [
      { name: 'Grace A.', score: 96 },
      { name: 'Peter K.', score: 88 },
      { name: 'Mary W.', score: 92 },
      { name: 'Lucy A.', score: 79 }
    ]
  };

  /* ---------------- Loyalty ---------------- */
  const REWARDS = [
    { id: 'R-1', name: 'Free Night — Standard', cost: 2500, icon: 'hotel' },
    { id: 'R-2', name: 'Room Upgrade', cost: 1200, icon: 'upgrade' },
    { id: 'R-3', name: 'Spa Voucher', cost: 800, icon: 'spa' },
    { id: 'R-4', name: 'Late Checkout', cost: 400, icon: 'schedule' },
    { id: 'R-5', name: 'Welcome Hamper', cost: 600, icon: 'redeem' }
  ];

  /* ---------------- Reviews (per room, keyed by id) ---------------- */
  const REVIEWS = {
    default: [
      { by: 'Wanjiru K.', avatar: 'WK', rating: 5, when: '2 weeks ago', text: 'Spotless room and the staff went above and beyond. The check-in QR made arrival seamless.' },
      { by: 'Brian O.', avatar: 'BO', rating: 4, when: '1 month ago', text: 'Great value and very quiet. Wi-Fi was fast. Would book again on my next Nairobi trip.' },
      { by: 'Aisha H.', avatar: 'AH', rating: 5, when: '1 month ago', text: 'Felt like a boutique hotel. Loved the ambience and the welcome hamper.' }
    ]
  };

  /* ---------------- Live activity feed ---------------- */
  const ACTIVITY = [
    { icon: 'login', tone: 'success', text: 'Brian Otieno checked in to Tsavo Twin Lounge (SC-102)', time: '10:42' },
    { icon: 'payments', tone: 'accent', text: 'Payment received — KES 17,000 for BK-7841', time: '10:31' },
    { icon: 'sms', tone: 'info', text: 'SMS "Booking Confirmed" sent to Wanjiru Kamau', time: '10:30' },
    { icon: 'cleaning_services', tone: 'warning', text: 'Cleaning started on Amboseli Garden Room (SC-103)', time: '10:12' },
    { icon: 'build', tone: 'danger', text: 'Urgent maintenance logged — AC fault SC-202', time: '09:58' },
    { icon: 'star', tone: 'accent', text: 'New 5★ review from Faith Chebet', time: '09:40' },
    { icon: 'how_to_reg', tone: 'success', text: 'Walk-in registered — David Mwangi', time: '09:21' }
  ];

  window.SC_DATA = {
    IMG, ROOMS, GUESTS, BOOKINGS, STAFF, TASKS,
    NOTIFICATIONS, TEMPLATES, AUDIT, ANALYTICS, REWARDS, REVIEWS, ACTIVITY
  };
})();
